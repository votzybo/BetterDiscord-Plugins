/**
 * @name NotificationQuickReply
 * @author votzybo
 * @version 9.9.15
 * @description In-app notifications for Discord with quick reply, actions, customizable colors & bright glow, classic Discord layout. Server/group icon or sender avatar in header. Glow effect works and fades. Notifications clear if thread is opened or the message is marked as read (even on other devices).
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateurl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/refs/heads/main/AtSomeoneRoullette/AtSomeoneRoullette.plugin.js
 */

// Hours Wasted: 225 (and yes, I counted the bajilliion extra hours i wasted adding the glow effect plugin. i sweear i couldnt wrap my head around it.)
// If you see a weird bug, it's probably a feature. If you see a feature, it's probably a bug.
// TODO: Refactor to be more modular in a distant future.

const NQR_SETTINGS_KEY = "NQR_alert_settings";
const NQR_DEFAULTS = {
    quickRespond: true,
    actionSymbols: ["😭", "💀", "???", "LOLL"],
    autoActionSend: true,
    alertFontSize: 15,
    alertWidth: 410,
    alertMaxHeight: 580,
    alertLifetime: 10,
    alertAnchor: "topEnd",
    showCountdown: true,
    backgroundColor: "",
    barColor: "#ad4df0",
    timerColor: "#ad4df0",
    glowIntensity: 0.8,
    glowColor: "#ad4df0",
    showCategoryHeader: false,
    showServerGCProfilePic: true,
    showDMHeaderAvatar: true
};
const NQR_ANCHOR_OPTIONS = [
    { label: "Top End", value: "topEnd" },
    { label: "Top Start", value: "topStart" },
    { label: "Top Center", value: "topMid" },
    { label: "Bottom End", value: "bottomEnd" },
    { label: "Bottom Start", value: "bottomStart" },
    { label: "Bottom Center", value: "bottomMid" }
];
const NQR_ACTIONS_LIMIT = 8;

const { React, Webpack, ReactDOM } = BdApi;
const { useState, useRef, useEffect } = React;
const { createRoot } = ReactDOM;
const AlertUtilModule = BdApi.Webpack.getByStrings("SUPPRESS_NOTIFICATIONS", "SELF_MENTIONABLE_SYSTEM", {searchExports:true});
const UserDB = Webpack.getStore("UserStore");
const ChanDB = Webpack.getStore("ChannelStore");
const GuildDB = Webpack.getStore("GuildStore");
const navTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{searchExports:true});
const MsgDispatcher = BdApi.Webpack.getByKeys("subscribe", "dispatch");
const MessageDB = Webpack.getStore("MessageStore");
const ChanCache = Webpack.getModule(Webpack.Filters.byPrototypeKeys("addCachedMessages"));
const msgStructFactory = Webpack.getModule(Webpack.Filters.byStrings("message_reference", "isProbablyAValidSnowflake"), { searchExports: true });
const SelectedChannelStore = Webpack.getStore("SelectedChannelStore");

// Helper to cache a message. Because Discord sometimes likes to play hide and seek with message objects.
function cacheMsg(msg) {
    const chan = ChanCache.getOrCreate(msg.channel_id);
    const updated = chan.mutate(r => { r.ready = true; r.cached = true; r._map[msg.id] = msg; });
    ChanCache.commit(updated);
}

// ProgressBar: The most stressful countdown ever.
function ProgressBar({ duration, isPaused, onComplete, showTimer, setHeaderTimer, barColor, timerColor, onProgress }) {
    const [remaining, setRemaining] = useState(duration);
    const [userPaused, setUserPaused] = useState(false);

    useEffect(() => {
        setHeaderTimer && setHeaderTimer(remaining);
        if (onProgress && duration > 0) onProgress(remaining / duration);
    }, [remaining, setHeaderTimer, duration, onProgress]);

    useEffect(() => {
        if (isPaused || userPaused) return;
        const interval = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 100) {
                    clearInterval(interval);
                    onComplete && onComplete();
                    return 0;
                }
                return prev - 100;
            });
        }, 100);
        return () => clearInterval(interval);
    }, [isPaused, userPaused, onComplete]);

    function getColor() {
        if (barColor) return barColor;
        const green = [67, 181, 129], orange = [250, 166, 26], red = [240, 71, 71];
        let pct = (remaining / duration) * 100;
        if (pct > 66) return `rgb(${green.join(',')})`;
        if (pct > 33) return `rgb(${orange.join(',')})`;
        return `rgb(${red.join(',')})`;
    }

    function togglePause(e) {
        e.stopPropagation();
        setUserPaused(!userPaused);
    }

    return (
        React.createElement('div', { style: { position: 'relative', width: '100%', minHeight: '12px', marginTop: 8 } },
            React.createElement('div', { style: { position: 'absolute', bottom: 0, left: 0, height: '4px', width: '100%', backgroundColor: 'var(--background-secondary-alt)', borderRadius: '0 0 10px 10px', zIndex: 1 } }),
            React.createElement('div', { style: { position: 'absolute', bottom: 0, left: 0, height: '4px', width: `${(remaining / duration) * 100}%`, backgroundColor: getColor(), borderRadius: '0 0 10px 10px', transition: 'width 0.1s linear, background-color 0.5s ease', zIndex: 2 } }),
            showTimer && React.createElement('div', {
                style: { position: 'absolute', bottom: '8px', right: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer', pointerEvents: 'auto' },
                onClick: togglePause
            },
                React.createElement('div', {
                    style: {
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'var(--background-primary)',
                        borderRadius: '10px',
                        padding: '2px 6px'
                    }
                },
                    React.createElement('span', { style: { fontSize: '12px', fontWeight: 'bold', color: timerColor || getColor() } },
                        `${Math.max(Math.ceil(remaining / 1000), 0)}s`
                    )
                )
            )
        )
    );
}

// Main notification component. If you touch this, you get what you deserve.
function NotificationComponent(props) {
    const {
        message: propMessage,
        channel,
        settings,
        quickReplyEnabled = true,
        quickActions = [],
        autoSendQuickAction = true,
        fontSize = 15,
        width = 400,
        height = 600,
        isKeywordMatch,
        matchedKeyword,
        onClose,
        onClick,
        glowIntensity = 0.8,
        glowColor = "#ad4df0",
        barColor = "#ad4df0",
        timerColor = "#ad4df0",
        showServerGCProfilePic = true,
        showDMHeaderAvatar = true
    } = props;

    const useStateFromStores = Webpack.getModule(Webpack.Filters.byStrings("getStateFromStores"), { searchExports: true });
    const MessageStore = Webpack.getStore("MessageStore");
    const GuildStore = Webpack.getStore("GuildStore");
    const Message = Webpack.getModule(m => String(m.type).includes('.messageListItem,"aria-setsize":-1,children:['));
    const oldMsg = useRef({ message: propMessage, deleted: false });
    let message = useStateFromStores ? useStateFromStores([MessageStore], function () {
        const m = MessageStore.getMessage(propMessage.channel_id, propMessage.id);
        if (m) oldMsg.current = { message: m };
        else oldMsg.current.deleted = true;
        return m;
    }) : propMessage;
    message = message ? message : oldMsg.current.message;

    if (!channel) return null;
    const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
    const isGuild = !!channel.guild_id;
    const isGroupDM = channel.type === 3;
    const isDM = !isGuild && !isGroupDM;

    const [isPaused, setIsPaused] = useState(false);
    const [headerTimer, setHeaderTimer] = useState(settings.duration);
    const [replyFocused, setReplyFocused] = useState(false);
    const [replyValue, setReplyValue] = useState("");
    const [sending, setSending] = useState(false);
    const [quickActionsHover, setQuickActionsHover] = useState(false);
    const [showQuickActionPill, setShowQuickActionPill] = useState(() =>
        !BdApi.Data.load('PingNotification', "votzybo_quickactions_tooltip_shown")
    );
    const [errorBanner, setErrorBanner] = useState("");
    const [progress, setProgress] = useState(1);
    const replyRef = useRef(null);
    const autoSendQuickActionRef = useRef(false);
    const [quickActionsMenuPos, setQuickActionsMenuPos] = useState(null);
    const quickActionBtnRef = useRef(null);

    function dismissQuickActionPill() {
        setShowQuickActionPill(false);
        BdApi.Data.save('PingNotification', "votzybo_quickactions_tooltip_shown", true);
    }
    function stopBubble(e) { e.stopPropagation(); }
    async function sendReply() {
        if (!replyValue.trim()) return;
        setSending(true);
        setErrorBanner("");
        try {
            const SendMessageModule = Webpack.getModule(m => m?.sendMessage && m?.receiveMessage);
            if (SendMessageModule && channel && channel.id) {
                await SendMessageModule.sendMessage(channel.id, {
                    content: replyValue,
                    tts: false
                });
            }
            setReplyValue("");
            onClose && onClose(true);
        } catch (e) {
            let errorMsg =
                typeof e === "object" && e?.message && typeof e.message === "string"
                    ? e.message
                    : String(e);
            if (
                errorMsg.includes("50013") ||
                errorMsg.toLowerCase().includes("missing permissions") ||
                errorMsg.toLowerCase().includes("forbidden") ||
                errorMsg.toLowerCase().includes("not allowed")
            ) {
                setErrorBanner("Failed to Send Message, You Do Not Meet The Requirements to Talk In This Channel");
            } else {
                setErrorBanner("Failed to Send Message" + (errorMsg && errorMsg !== "[object Object]" ? ": " + errorMsg : ""));
            }
        }
        setSending(false);
    }

    function handleQuickAction(action) {
        const val = (replyValue && !replyValue.endsWith(" ") ? replyValue + " " : replyValue) + action;
        setReplyValue(val);
        setQuickActionsHover(false);
        if (replyRef.current) replyRef.current.focus();
        if (autoSendQuickAction) autoSendQuickActionRef.current = true;
    }

    useEffect(() => {
        if (autoSendQuickActionRef.current) {
            autoSendQuickActionRef.current = false;
            sendReply();
        }
    }, [replyValue]);

    const quickActionsTimeoutRef = useRef();
    const safeSetQuickActionsHover = (hover) => {
        if (quickActionsTimeoutRef.current) clearTimeout(quickActionsTimeoutRef.current);
        if (hover) {
            setQuickActionsHover(true);
        } else {
            quickActionsTimeoutRef.current = setTimeout(() => setQuickActionsHover(false), 110);
        }
    };
    useEffect(() => {
        if (!quickActionsHover) setQuickActionsMenuPos(null);
    }, [quickActionsHover]);
    useEffect(() => () => {
        if (quickActionsTimeoutRef.current) clearTimeout(quickActionsTimeoutRef.current);
    }, []);

    const effectiveGlow = Math.max(0, Math.min(1, glowIntensity)) * progress;
    const rgb = glowColor.startsWith("#")
        ? [parseInt(glowColor.slice(1,3),16), parseInt(glowColor.slice(3,5),16), parseInt(glowColor.slice(5,7),16)]
        : [173, 77, 240];
    const boxShadow = effectiveGlow > 0
        ? `0 0 ${72 + 72 * effectiveGlow}px 0 rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.60 + 0.40 * effectiveGlow).toFixed(2)})`
        : "none";

    let showHeaderAvatar = false;
    let headerAvatarUrl = "";
    if (isGuild && showServerGCProfilePic && guild && guild.icon) {
        showHeaderAvatar = true;
        headerAvatarUrl = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
    } else if (isGroupDM && showServerGCProfilePic && channel.icon) {
        showHeaderAvatar = true;
        headerAvatarUrl = `https://cdn.discordapp.com/channel-icons/${channel.id}/${channel.icon}.png?size=64`;
    } else if (isDM && showDMHeaderAvatar) {
        showHeaderAvatar = true;
        headerAvatarUrl = message.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator) % 5}.png`;
    }

    return (
        React.createElement('div', {
            className: `ping-notification-content`,
            onClick: (e) => {
                const isLink = e.target.tagName === 'A' || e.target.closest('a');
                if (isLink) {
                    e.stopPropagation();
                    if (settings.disableMediaInteraction) {
                        e.preventDefault();
                        onClick();
                    }
                    return;
                }
                onClick();
            },
            onContextMenu: (e) => {
                if (settings.closeOnRightClick) {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose(true);
                }
            },
            onMouseEnter: () => setIsPaused(true),
            onMouseLeave: () => setIsPaused(false),
            style: {
                position: 'relative',
                overflow: 'hidden',
                padding: `16px`,
                paddingBottom: `24px`,
                minHeight: 0,
                maxHeight: height || 600,
                width: `${width}px`,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--background-floating, var(--background-secondary))',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                transform: 'translateZ(0)',
                fontSize: `${fontSize}px`,
                transition: 'all 0.3s ease',
                userSelect: 'none',
                WebkitUserDrag: 'none',
                zIndex: settings.disableMediaInteraction ? 2 : 'auto',
                '--ping-notification-content-font-size': `${fontSize}px`,
                boxShadow
            }
        },
            React.createElement('div', {
                className: "ping-notification-header",
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 0 4px 0',
                    borderBottom: '1px solid var(--background-tertiary)',
                    marginBottom: 0,
                    minHeight: 0,
                    position: 'relative'
                }
            },
                showHeaderAvatar && React.createElement('img', {
                    src: headerAvatarUrl,
                    alt: "Avatar",
                    style: {
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        marginRight: 10,
                        flexShrink: 0,
                        display: "block"
                    }
                }),
                React.createElement('div', {
                    style: {
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        minWidth: 0
                    }
                },
                    isGuild ? [
                        React.createElement('span', { key: "guild", style: { fontWeight: 700 } }, guild?.name || "Server"),
                        React.createElement('span', { key: "chan", style: { color: 'var(--text-muted)', fontWeight: 400, fontSize: '13px', marginLeft: 0 } }, `#${channel.name}`)
                    ] :
                        isGroupDM ? [
                            React.createElement('span', { key: "gc", style: { fontWeight: 700 } }, channel.name || "Group DM"),
                            React.createElement('span', { key: "gclabel", style: { color: 'var(--text-muted)', fontWeight: 400, fontSize: '13px', marginLeft: 0 } }, "Group Chat")
                        ] :
                            React.createElement('span', { style: { fontWeight: 700 } }, message.author?.username)
                ),
                settings.showCountdown && React.createElement('span', {
                    style: {
                        position: 'absolute',
                        right: 36,
                        top: 0,
                        color: timerColor || 'var(--brand-experiment)',
                        fontWeight: 500,
                        fontSize: '13px',
                        padding: '0 8px 0 0',
                        letterSpacing: '0.5px'
                    }
                },
                    `${Math.max(Math.ceil(headerTimer / 1000), 0)}s`
                ),
                React.createElement('div', {
                    className: "ping-notification-close",
                    onClick: (e) => {
                        e.stopPropagation();
                        onClose(true);
                    },
                    style: {
                        marginLeft: 'auto',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        backgroundColor: 'var(--background-primary)',
                        color: 'var(--text-normal)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }
                },
                    React.createElement('svg', {
                        width: '14',
                        height: '14',
                        viewBox: '0 0 24 24',
                        fill: 'currentColor'
                    },
                        React.createElement('path', {
                            d: 'M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z'
                        })
                    )
                )
            ),
            errorBanner && React.createElement(
                "div",
                {
                    style: {
                        background: "var(--status-danger-background, #fa777c)",
                        color: "var(--white, #fff)",
                        padding: "6px 10px",
                        borderRadius: 7,
                        margin: "10px 0 5px 0",
                        fontWeight: 700,
                        fontSize: 13,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)"
                    }
                },
                errorBanner
            ),
            React.createElement('div', {
                className: "ping-notification-body",
                style: {
                    flex: 1,
                    marginTop: 4,
                    marginBottom: 8,
                    maxHeight: 'unset',
                    overflowY: 'auto',
                    transition: 'overflow-y 0.2s ease',
                    padding: 0,
                    position: 'relative'
                }
            }, [
                React.createElement('ul', {
                    key: "message-list",
                    style: {
                        listStyle: 'none',
                        margin: 0,
                        padding: 0,
                        pointerEvents: settings.disableMediaInteraction ? 'none' : 'auto'
                    },
                },
                    (() => {
                        const props = {
                            id: `${message.id}-${message.id}`,
                            groupId: message.id,
                            channel: channel,
                            message: message,
                            compact: false,
                            renderContentOnly: false,
                            className: "ping-notification-messageContent",
                            hideAvatar: true, renderAvatar: false, showAvatar: false
                        };
                        return React.createElement(Message, props);
                    })()
                ),
                settings.disableMediaInteraction ? React.createElement('div', {
                    key: "click-overlay",
                    style: {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 10,
                        cursor: 'pointer',
                        backgroundColor: 'transparent'
                    },
                    onClick: onClick
                }) : null
            ]),
            quickReplyEnabled && React.createElement('div', {
                className: 'ping-notification-quickreply-wrapper',
                style: { display: "flex", position: "relative", paddingBottom: 0, minHeight: 52 }
            },
                React.createElement("div", { style: { position: "relative", display: "flex", alignItems: "center" } },
                    React.createElement("button", {
                        ref: quickActionBtnRef,
                        tabIndex: -1,
                        style: {
                            border: "none",
                            background: "none",
                            fontSize: "20px",
                            cursor: "pointer",
                            padding: "0 6px 0 0",
                            zIndex: 10
                        },
                        title: "Quick Actions",
                        onMouseEnter: () => {
                            if (quickActionBtnRef.current) {
                                const rect = quickActionBtnRef.current.getBoundingClientRect();
                                setQuickActionsMenuPos({
                                    left: rect.left,
                                    top: rect.bottom + 4
                                });
                            }
                            safeSetQuickActionsHover(true);
                        },
                        onMouseLeave: () => safeSetQuickActionsHover(false),
                        onClick: (e) => {
                            stopBubble(e);
                            if (quickActionBtnRef.current) {
                                const rect = quickActionBtnRef.current.getBoundingClientRect();
                                setQuickActionsMenuPos({
                                    left: rect.left,
                                    top: rect.bottom + 4
                                });
                            }
                            setQuickActionsHover(v => !v);
                            if (showQuickActionPill) setTimeout(dismissQuickActionPill, 2000);
                        }
                    }, "✨"),
                    showQuickActionPill && quickActionsHover && React.createElement("div", {
                        className: "ping-notification-quickreply-pill"
                    }, "Customize your Quick Actions in settings!")
                ),
                React.createElement("input", {
                    ref: replyRef,
                    type: "text",
                    value: replyValue,
                    maxLength: 2000,
                    autoFocus: !!replyFocused,
                    disabled: sending,
                    onFocus: () => setReplyFocused(true),
                    onBlur: () => setReplyFocused(false),
                    onChange: e => setReplyValue(e.target.value),
                    onClick: stopBubble,
                    onMouseDown: stopBubble,
                    onKeyDown: e => {
                        if (e.key === "Enter" && !e.shiftKey && !sending) {
                            e.preventDefault();
                            sendReply();
                        }
                    },
                    placeholder: "Quick reply...",
                    style: {
                        flex: 1,
                        fontSize: `${fontSize}px`,
                        border: "1px solid var(--background-tertiary)",
                        borderRadius: "8px",
                        outline: "none",
                        padding: "6px 8px"
                    }
                }),
                React.createElement("button", {
                    disabled: sending || !replyValue.trim(),
                    style: {
                        border: "none",
                        background: barColor || "var(--brand-experiment)",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: `${fontSize}px`,
                        borderRadius: "8px",
                        padding: "7px 16px",
                        marginLeft: "8px",
                        cursor: (!replyValue.trim() || sending) ? "not-allowed" : "pointer",
                        opacity: (!replyValue.trim() || sending) ? 0.6 : 1
                    },
                    onClick: (e) => {
                        stopBubble(e);
                        sendReply();
                    }
                }, sending ? "..." : "Send")
            ),
            React.createElement(ProgressBar, {
                duration: settings.duration,
                isPaused: isPaused || replyFocused,
                onComplete: () => onClose(false),
                showTimer: settings.showCountdown,
                setHeaderTimer: setHeaderTimer,
                barColor,
                timerColor,
                onProgress: setProgress
            }),
            isKeywordMatch && matchedKeyword && settings.showKeyword && React.createElement('div', {
                style: {
                    position: 'absolute',
                    bottom: '8px',
                    left: '12px',
                    backgroundColor: 'var(--background-secondary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: 'var(--text-danger)',
                    fontWeight: 'bold',
                    fontSize: '10px'
                }
            }, `Keyword: ${matchedKeyword}`),
            quickActionsHover && quickActionsMenuPos && ReactDOM.createPortal(
                React.createElement("div", {
                    style: {
                        position: "fixed",
                        left: quickActionsMenuPos.left,
                        top: quickActionsMenuPos.top,
                        width: 170,
                        maxHeight: 192,
                        minHeight: 38,
                        background: "var(--background-floating, #23272a)",
                        borderRadius: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        padding: "8px 0",
                        zIndex: 10020,
                        overflowY: "auto",
                        overflowX: "hidden",
                        transition: "all .18s cubic-bezier(.4,1,.7,1.2)"
                    },
                    onMouseEnter: () => safeSetQuickActionsHover(true),
                    onMouseLeave: () => safeSetQuickActionsHover(false)
                },
                    (quickActions || []).map((action, i) =>
                        React.createElement("div", {
                            key: i,
                            style: {
                                padding: "6px 16px",
                                cursor: "pointer",
                                fontSize: `${fontSize + 2}px`,
                                color: "var(--text-normal)",
                                borderBottom: (i < quickActions.length - 1) ? "1px solid var(--background-tertiary)" : "none",
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            },
                            onClick: (e) => { stopBubble(e); handleQuickAction(action); }
                        }, action)
                    )
                ),
                document.body
            )
        )
    );
}

// Sliders, toggles, and dropdowns. Not responsible for your broken mouse wheel.
function NQRSlider({ min, max, step, value, onChange, width = 160, disabled }) {
    return React.createElement("input", {
        type: "range", min, max, step, value, disabled,
        style: { width, accentColor: "#ad4df0", marginRight: 12, verticalAlign: "middle" },
        onChange: e => onChange(Number(e.target.value))
    });
}
function NQRToggle({ checked, onChange }) {
    return React.createElement("label", { style: { display: "inline-block", position: "relative", width: 38, height: 22, verticalAlign: "middle" } },
        React.createElement("input", { type: "checkbox", checked, onChange: e => onChange(e.target.checked), style: { display: "none" } }),
        React.createElement("span", { style: { position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, background: checked ? "#ad4df0" : "#40444b", borderRadius: 22, transition: ".2s" } }),
        React.createElement("span", { style: { position: "absolute", top: 2, left: checked ? 18 : 2, width: 18, height: 18, background: "#fff", borderRadius: "50%", transition: ".2s" } })
    );
}
function NQRDropdown({ options, value, onChange, width = 160 }) {
    return React.createElement("select", {
        value, onChange: e => onChange(e.target.value),
        style: { fontSize: 15, borderRadius: 6, background: "var(--background-secondary)", color: "var(--header-primary)", border: "1px solid #ad4df0", padding: "5px 12px", width, marginLeft: 0 }
    }, options.map(opt => React.createElement("option", { key: opt.value, value: opt.value }, opt.label)));
}

// Settings panel. If you break it, you get to keep both pieces.
function NQRSettingsPanel({ plugin, onClose }) {
    const [state, setState] = React.useState(plugin.nqrUserSettings);
    const [actionInput, setActionInput] = React.useState("");
    const update = (prop, val) => {
        const updated = { ...state, [prop]: val };
        setState(updated);
        plugin.saveNQRSettings(updated);
    };
    const addAction = () => {
        if (!actionInput.trim() || state.actionSymbols.length >= NQR_ACTIONS_LIMIT) return;
        const arr = [...state.actionSymbols, actionInput.trim()];
        update("actionSymbols", arr);
        setActionInput("");
    };
    return (
        React.createElement("div", {
            style: {
                background: "var(--background-tertiary)",
                color: "var(--header-primary)",
                borderRadius: 10,
                padding: 0,
                minWidth: 400,
                maxWidth: 540,
                fontSize: 15,
                boxShadow: "0 8px 32px #ad4df030"
            }
        },
            React.createElement("div", { style: { padding: "28px 38px 0 38px" } },
                React.createElement("div", { style: { fontWeight: 800, fontSize: 22, marginBottom: 10 } }, "NotificationQuickReply Settings"),
                React.createElement("div", { style: { fontWeight: 700, fontSize: 17, margin: "12px 0 3px 0", display: "flex", alignItems: "center" } },
                    React.createElement("span", { style: { marginRight: 9, fontSize: 20 } }, "🔔"),
                    "Customize Your Alert Popups"
                ),
                React.createElement("div", { style: { color: "var(--text-muted)", marginBottom: 24, fontSize: 14 } },
                    "Tailor your popups, quick reply, and more."
                ),
                React.createElement("div", { style: { marginBottom: 16 } },
                    React.createElement("label", { style: { fontWeight: 500 } }, "Alert Lifetime"),
                    React.createElement("div", { style: { display: "flex", alignItems: "center" } },
                        React.createElement(NQRSlider, {
                            min: 3, max: 30, step: 1,
                            value: state.alertLifetime,
                            onChange: v => update("alertLifetime", v)
                        }),
                        React.createElement("input", {
                            type: "number",
                            min: 3, max: 30, step: 1,
                            value: state.alertLifetime,
                            onChange: e => update("alertLifetime", Number(e.target.value) || 10),
                            style: { width: 56, fontSize: 15, borderRadius: 5, border: "1px solid #ad4df0", marginLeft: 6, padding: "2px 6px" }
                        }),
                        React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 6 } }, "seconds")
                    )
                ),
                React.createElement("div", { style: { marginBottom: 14, display: "flex", alignItems: "center" } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 12 } }, "Show Countdown & Progress"),
                    React.createElement(NQRToggle, {
                        checked: state.showCountdown,
                        onChange: v => update("showCountdown", v)
                    })
                ),
                React.createElement("div", { style: { marginBottom: 16 } },
                    React.createElement("label", { style: { fontWeight: 500 } }, "Alert Width"),
                    React.createElement("div", { style: { display: "flex", alignItems: "center" } },
                        React.createElement(NQRSlider, {
                            min: 260, max: 800, step: 10,
                            value: state.alertWidth,
                            onChange: v => update("alertWidth", v)
                        }),
                        React.createElement("input", {
                            type: "number",
                            min: 260, max: 800, step: 10,
                            value: state.alertWidth,
                            onChange: e => update("alertWidth", Number(e.target.value) || 410),
                            style: { width: 56, fontSize: 15, borderRadius: 5, border: "1px solid #ad4df0", marginLeft: 6, padding: "2px 6px" }
                        }),
                        React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 6 } }, "px")
                    )
                ),
                React.createElement("div", { style: { marginBottom: 16 } },
                    React.createElement("label", { style: { fontWeight: 500 } }, "Alert Max Height"),
                    React.createElement("div", { style: { display: "flex", alignItems: "center" } },
                        React.createElement(NQRSlider, {
                            min: 120, max: 900, step: 10,
                            value: state.alertMaxHeight,
                            onChange: v => update("alertMaxHeight", v)
                        }),
                        React.createElement("input", {
                            type: "number",
                            min: 120, max: 900, step: 10,
                            value: state.alertMaxHeight,
                            onChange: e => update("alertMaxHeight", Number(e.target.value) || 580),
                            style: { width: 56, fontSize: 15, borderRadius: 5, border: "1px solid #ad4df0", marginLeft: 6, padding: "2px 6px" }
                        }),
                        React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 6 } }, "px")
                    )
                ),
                React.createElement("div", { style: { marginBottom: 28 } },
                    React.createElement("label", { style: { fontWeight: 500, marginBottom: 3, display: "block" } }, "Alert Anchor"),
                    React.createElement(NQRDropdown, {
                        options: NQR_ANCHOR_OPTIONS,
                        value: state.alertAnchor,
                        onChange: v => update("alertAnchor", v),
                        width: 180
                    })
                ),
                React.createElement("div", { style: { marginBottom: 18 } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 14 } }, "Background Color"),
                    React.createElement("input", {
                        type: "color",
                        value: state.backgroundColor || "#23272a",
                        onChange: e => update("backgroundColor", e.target.value)
                    }),
                    React.createElement("span", { style: { marginLeft: 8, color: "var(--text-muted)", fontSize: 13 } }, "(leave as default for theme)")
                ),
                React.createElement("div", { style: { marginBottom: 18 } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 14 } }, "Progress Bar Color"),
                    React.createElement("input", {
                        type: "color",
                        value: state.barColor || "#ad4df0",
                        onChange: e => update("barColor", e.target.value)
                    })
                ),
                React.createElement("div", { style: { marginBottom: 18 } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 14 } }, "Timer Color"),
                    React.createElement("input", {
                        type: "color",
                        value: state.timerColor || "#ad4df0",
                        onChange: e => update("timerColor", e.target.value)
                    })
                ),
                React.createElement("div", { style: { marginBottom: 18 } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 14 } }, "Glow Color"),
                    React.createElement("input", {
                        type: "color",
                        value: state.glowColor || "#ad4df0",
                        onChange: e => update("glowColor", e.target.value)
                    })
                ),
                React.createElement("div", { style: { marginBottom: 18 } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 14 } }, "Glow Intensity"),
                    React.createElement(NQRSlider, {
                        min: 0, max: 1, step: 0.01,
                        value: state.glowIntensity,
                        onChange: v => update("glowIntensity", Math.max(0, Math.min(1, Number(v))))
                    }),
                    React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 6 } }, (state.glowIntensity * 100).toFixed(0) + "%")
                ),
                React.createElement("div", { style: { marginBottom: 14, display: "flex", alignItems: "center" } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 12 } }, "Show Server / GC Profile Picture"),
                    React.createElement(NQRToggle, {
                        checked: state.showServerGCProfilePic,
                        onChange: v => update("showServerGCProfilePic", v)
                    }),
                    React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 12, fontSize: 14 } }, "Show avatar in header for server/group")
                ),
                React.createElement("div", { style: { marginBottom: 14, display: "flex", alignItems: "center" } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 12 } }, "Show DM Profile Picture (Header)"),
                    React.createElement(NQRToggle, {
                        checked: state.showDMHeaderAvatar,
                        onChange: v => update("showDMHeaderAvatar", v)
                    }),
                    React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 12, fontSize: 14 } }, "Show avatar in header for DMs")
                ),
                React.createElement("button", {
                    onClick: () => {
                        const testMsg = {
                            id: "0",
                            channel_id: "0",
                            author: { id: "0", username: "TestUser", avatar: null, discriminator: "0000", globalName: "TestUser" },
                            content: "This is a test alert! Try quick reply and actions. Adjust settings and test again.",
                            timestamp: new Date().toISOString()
                        };
                        const testChan = { id: "0", name: "test-chat", recipients: [], type: 1, nsfw: false, nsfw_: false };
                        plugin.spawnAlertBox(testMsg, testChan, { test: true });
                    },
                    style: { background: "#ad4df0", color: "#fff", fontWeight: 700, fontSize: 16, padding: "10px 0", border: "none", borderRadius: 7, margin: "0 0 10px 0", width: "240px", boxShadow: "0 2px 8px #ad4df018" }
                }, "Send Test Alert"),
                React.createElement("div", {
                    style: { color: "#ed4245", margin: "0 0 30px 0", fontSize: 13, fontWeight: 700 }
                }, "Test Alert not yet implemented for all features.")
            ),
            React.createElement("div", { style: { borderTop: "1px solid var(--background-tertiary)", padding: "32px 38px 0 38px", marginTop: 6 } },
                React.createElement("div", { style: { fontWeight: 700, fontSize: 17, marginBottom: 8 } }, "Quick Reply & Action Buttons"),
                React.createElement("div", { style: { marginBottom: 16, display: "flex", alignItems: "center" } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 10 } }, "Enable Quick Reply"),
                    React.createElement(NQRToggle, {
                        checked: state.quickRespond,
                        onChange: v => update("quickRespond", v)
                    })
                ),
                React.createElement("div", { style: { marginBottom: 16, display: "flex", alignItems: "center" } },
                    React.createElement("label", { style: { fontWeight: 500, marginRight: 10 } }, "Auto-send Action"),
                    React.createElement(NQRToggle, {
                        checked: state.autoActionSend,
                        onChange: v => update("autoActionSend", v)
                    }),
                    React.createElement("span", { style: { color: "var(--text-muted)", marginLeft: 12, fontSize: 14 } }, "Send action instantly when clicked")
                ),
                React.createElement("div", { style: { fontWeight: 500, marginBottom: 4 } }, `Action Buttons (max ${NQR_ACTIONS_LIMIT}):`),
                state.actionSymbols.length === 0 ?
                    React.createElement("div", { style: { color: "var(--text-muted)", marginBottom: 8, marginTop: 4 } }, "No actions set.") :
                    state.actionSymbols.map((qa, idx) =>
                        React.createElement("div", {
                            key: idx,
                            style: { display: "flex", alignItems: "center", marginBottom: 10, marginTop: 6, gap: 16 }
                        },
                            React.createElement("span", { style: { fontSize: 18, minWidth: 32 } }, qa),
                            React.createElement("button", {
                                onClick: () => {
                                    const arr = state.actionSymbols.slice();
                                    arr.splice(idx, 1);
                                    update("actionSymbols", arr);
                                },
                                style: { color: "#ed4245", background: "none", border: "none", fontWeight: 500, fontSize: 14, cursor: "pointer", marginLeft: 0 }
                            }, "Remove")
                        )
                    ),
                React.createElement("div", { style: { marginTop: 12, display: "flex", alignItems: "center", gap: 10 } },
                    React.createElement("input", {
                        type: "text",
                        value: actionInput,
                        maxLength: 64,
                        placeholder: "Add action...",
                        onChange: e => setActionInput(e.target.value),
                        style: { fontSize: 15, borderRadius: 6, padding: "4px 10px", border: "1px solid #ad4df0", width: 180 },
                        onKeyDown: e => { if (e.key === "Enter") addAction(); }
                    }),
                    React.createElement("button", {
                        onClick: addAction,
                        style: {
                            background: "#ad4df0", color: "#fff", fontWeight: 700, fontSize: 15, padding: "4px 18px",
                            border: "none", borderRadius: 7,
                            cursor: actionInput.trim() && state.actionSymbols.length < NQR_ACTIONS_LIMIT ? "pointer" : "not-allowed",
                            opacity: actionInput.trim() && state.actionSymbols.length < NQR_ACTIONS_LIMIT ? 1 : 0.6
                        },
                        disabled: !actionInput.trim() || state.actionSymbols.length >= NQR_ACTIONS_LIMIT
                    }, "Add")
                ),
                React.createElement("div", { style: { margin: "20px 0 0 0", display: "flex", justifyContent: "flex-end" } },
                    React.createElement("button", {
                        onClick: onClose,
                        style: { background: "#ad4df0", color: "#fff", fontWeight: 700, fontSize: 15, padding: "9px 32px", border: "none", borderRadius: 7, marginTop: 24, boxShadow: "0 2px 8px #ad4df018" }
                    }, "Done")
                )
            )
        )
    );
}

module.exports = class NotificationQuickReply {
    constructor(meta) {
        this.meta = meta;
        this.defaultSettings = { ...NQR_DEFAULTS };
        this.settings = this.loadSettings();
        this.openAlerts = [];
        this._testAlertData = null;
        this.nqrUserSettings = Object.assign({}, this.defaultSettings, BdApi.Data.load('NQR', NQR_SETTINGS_KEY));
        this.nqrUserSettings.autoActionSend = true;
        BdApi.Data.save('NQR', NQR_SETTINGS_KEY, this.nqrUserSettings);
        this.msgHandler = this.msgHandler.bind(this);
    }
    loadNQRSettings() {
        let obj = Object.assign({}, NQR_DEFAULTS, BdApi.Data.load('NQR', NQR_SETTINGS_KEY));
        obj.autoActionSend = true;
        return obj;
    }
    saveNQRSettings(newSet) {
        this.nqrUserSettings = Object.assign({}, this.nqrUserSettings, newSet);
        this.nqrUserSettings.autoActionSend = true;
        BdApi.Data.save('NQR', NQR_SETTINGS_KEY, this.nqrUserSettings);
    }
    loadSettings() {
        const savedSettings = BdApi.Data.load('NQR', 'core_settings');
        return Object.assign({}, this.defaultSettings, savedSettings);
    }
    saveSettings(newSettings) {
        this.settings = Object.assign({}, this.settings, newSettings);
        BdApi.Data.save('NQR', 'core_settings', this.settings);
    }
    start() {
        MsgDispatcher.subscribe("MESSAGE_CREATE", this.msgCreateSub = (event) => {
            if (!event?.message) return;
            this.msgHandler(event);
        });

        // Always clear notification when that message is read (regardless of where)
        MsgDispatcher.subscribe("MESSAGE_ACK", this.msgAckSub = (event) => {
            const toClear = this.openAlerts.filter(alert =>
                alert.chanId === event.channelId
            );
            if (toClear.length > 0) {
                requestAnimationFrame(() => {
                    toClear.forEach(alert => {
                        this.clearAlertBox(alert);
                    });
                });
            }
        });

        // Clear notification when a thread is opened
        this._lastChannelId = SelectedChannelStore.getChannelId && SelectedChannelStore.getChannelId();
        this._channelChangeListener = () => {
            const currentId = SelectedChannelStore.getChannelId && SelectedChannelStore.getChannelId();
            if (currentId !== this._lastChannelId) {
                this._lastChannelId = currentId;
                const channel = ChanDB.getChannel ? ChanDB.getChannel(currentId) : null;
                if (channel && (channel.type === 11 || channel.type === 12)) {
                    this.openAlerts.filter(alert => alert.chanId === currentId)
                        .forEach(alert => this.clearAlertBox(alert));
                }
            }
        };
        if (SelectedChannelStore.addChangeListener)
            SelectedChannelStore.addChangeListener(this._channelChangeListener);

        BdApi.DOM.addStyle("NQRStyles", this.nqrCss);
        BdApi.DOM.addStyle("NQRQuickReply", `
            .ping-notification-quickreply-wrapper {
                position: absolute;
                left: 0; right: 0; bottom: 0;
                background: var(--background-secondary-alt);
                border-radius: 0 0 12px 12px;
                display: flex;
                align-items: center;
                padding: 8px;
                gap: 8px;
                z-index: 10002;
            }
            .ping-notification-quickreply-pill {
                position: absolute;
                top: -32px;
                left: 12px;
                background: var(--brand-experiment);
                color: #fff;
                padding: 6px 18px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 13px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                z-index: 10003;
                pointer-events: none;
            }
        `);
    }
    stop() {
        MsgDispatcher.unsubscribe("MESSAGE_CREATE", this.msgCreateSub);
        MsgDispatcher.unsubscribe("MESSAGE_ACK", this.msgAckSub);
        if (SelectedChannelStore.removeChangeListener && this._channelChangeListener)
            SelectedChannelStore.removeChangeListener(this._channelChangeListener);
        this.removeAllAlerts();
        BdApi.DOM.removeStyle("NQRStyles");
        BdApi.DOM.removeStyle("NQRQuickReply");
    }
    msgHandler(event) {
        if (!event.message?.channel_id) return;
        const chan = ChanDB.getChannel(event.message.channel_id);
        const user = UserDB.getCurrentUser();
        if (!chan || event.message.author.id === user.id) return;
        const allowNotify = AlertUtilModule ? AlertUtilModule(event.message, event.message.channel_id, false) : false;
        if (allowNotify) {
            this.spawnAlertBox(event.message, chan, { notify: true });
        }
    }
    async spawnAlertBox(msgEvt, chanObj, notifyResult) {
        const alertDiv = BdApi.DOM.createElement('div', {
            className: 'ping-notification',
            'data-channel-id': chanObj.id
        });
        if (this.nqrUserSettings.alertAnchor && this.nqrUserSettings.alertAnchor.endsWith("Mid")) {
            alertDiv.classList.add('centre');
        }
        let msgObj = MessageDB.getMessage(chanObj.id, msgEvt.id);
        if (!msgObj) {
            msgObj = msgStructFactory(msgEvt);
            cacheMsg(msgObj);
        }
        alertDiv.creationTime = Date.now();
        alertDiv.chanId = chanObj.id;
        alertDiv.msgId = msgObj.id;
        alertDiv.msgObj = msgObj;
        alertDiv.keywordFlag = false;
        alertDiv.matchedWord = null;
        const isTest = msgObj.id === "0";
        alertDiv.isTest = isTest;
        alertDiv.style.setProperty('--ping-notification-z-index', isTest ? '1003' : '1003');
        let root;
        const settingsToPass = {
            duration: this.nqrUserSettings.alertLifetime * 1000,
            maxWidth: this.nqrUserSettings.alertWidth,
            maxHeight: this.nqrUserSettings.alertMaxHeight,
            showCountdown: this.nqrUserSettings.showCountdown,
            disableMediaInteraction: false,
            closeOnRightClick: true
        };
        const props = {
            message: msgObj,
            channel: chanObj,
            settings: settingsToPass,
            quickReplyEnabled: this.nqrUserSettings.quickRespond,
            quickActions: this.nqrUserSettings.actionSymbols,
            autoSendQuickAction: this.nqrUserSettings.autoActionSend,
            fontSize: this.nqrUserSettings.alertFontSize,
            width: this.nqrUserSettings.alertWidth,
            height: this.nqrUserSettings.alertMaxHeight,
            isKeywordMatch: alertDiv.keywordFlag,
            matchedKeyword: alertDiv.matchedWord,
            glowIntensity: this.nqrUserSettings.glowIntensity,
            glowColor: this.nqrUserSettings.glowColor,
            barColor: this.nqrUserSettings.barColor,
            timerColor: this.nqrUserSettings.timerColor,
            showServerGCProfilePic: this.nqrUserSettings.showServerGCProfilePic,
            showDMHeaderAvatar: this.nqrUserSettings.showDMHeaderAvatar,
            onClose: (isManual) => {
                alertDiv.manualClose = isManual;
                this.clearAlertBox(alertDiv);
            },
            onClick: () => {
                if (!isTest) {
                    this.onAlertNav(chanObj, msgObj);
                }
                this.clearAlertBox(alertDiv);
            }
        };
        if (ReactDOM.createRoot) {
            root = createRoot(alertDiv);
            root.render(React.createElement(NotificationComponent, props));
            alertDiv.root = root;
        } else {
            ReactDOM.render(React.createElement(NotificationComponent, props), alertDiv);
            alertDiv.root = { unmount: () => ReactDOM.unmountComponentAtNode(alertDiv) };
        }
        this.openAlerts.push(alertDiv);
        document.body.prepend(alertDiv);
        void alertDiv.offsetHeight;
        alertDiv.classList.add('show');
        requestAnimationFrame(() => {
            this.positionAlerts();
        });
        const imgs = alertDiv.querySelectorAll('img');
        imgs.forEach(img => {
            img.addEventListener('load', () => this.positionAlerts());
        });
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(() => this.positionAlerts());
            ro.observe(alertDiv);
            alertDiv._resizeObserver = ro;
        }
        return alertDiv;
    }
    clearAlertBox(alertDiv) {
        if (alertDiv._resizeObserver) alertDiv._resizeObserver.disconnect();
        if (document.body.contains(alertDiv)) {
            alertDiv.root.unmount();
            document.body.removeChild(alertDiv);
            this.openAlerts = this.openAlerts.filter(n => n !== alertDiv);
            this.positionAlerts();
        }
    }
    removeAllAlerts() {
        this.openAlerts.forEach(alert => {
            if (alert._resizeObserver) alert._resizeObserver.disconnect();
            if (document.body.contains(alert)) {
                alert.root.unmount();
                document.body.removeChild(alert);
            }
        });
        this.openAlerts = [];
    }
    positionAlerts() {
        const anchor = this.nqrUserSettings.alertAnchor;
        let offset = 30;
        const isTop = anchor && anchor.startsWith("top");
        const isStart = anchor && anchor.endsWith("Start");
        const isCenter = anchor && anchor.endsWith("Mid");
        const sorted = [...this.openAlerts].sort((a, b) => b.creationTime - a.creationTime);
        sorted.forEach((alert) => {
            const h = alert.offsetHeight;
            alert.style.transition = 'all 0.1s cubic-bezier(.4,1,.7,1.2)';
            alert.style.position = 'fixed';
            if (isTop) {
                alert.style.top = `${offset}px`;
                alert.style.bottom = 'auto';
            } else {
                alert.style.bottom = `${offset}px`;
                alert.style.top = 'auto';
            }
            if (isCenter) {
                alert.style.left = '50%';
                alert.style.right = 'auto';
                alert.style.transform = 'translateX(-50%)';
            } else if (isStart) {
                alert.style.left = '20px';
                alert.style.right = 'auto';
                alert.style.transform = 'none';
            } else {
                alert.style.right = '20px';
                alert.style.left = 'auto';
                alert.style.transform = 'none';
            }
            offset += h + 10;
        });
    }
    onAlertNav(chanObj, msgObj) {
        const toRemove = this.openAlerts.filter(alert =>
            alert.chanId === chanObj.id
        );
        toRemove.forEach(alert => {
            this.clearAlertBox(alert);
        });
        navTo(`/channels/${chanObj.guild_id || "@me"}/${chanObj.id}/${msgObj.id}`);
    }
    getSettingsPanel() {
        let panelRoot = document.createElement("div");
        let root = createRoot(panelRoot);
        let done = false;
        let closePanel = () => {
            if (!done) {
                done = true;
                setTimeout(() => root.unmount(), 20);
            }
        };
        root.render(React.createElement(NQRSettingsPanel, { plugin: this, onClose: closePanel }));
        return panelRoot;
    }
    nqrCss = `
        .ping-notification {
            color: var(--text-normal);
            border-radius: 12px;
            box-shadow: 0 0 64px 0 #ad4df099, 0 2px 4px #ad4df022, 0 0 1px #fff1;
            overflow: hidden;
            backdrop-filter: blur(10px);
            transform: translateZ(0);
            opacity: 0;
            z-index: var(--ping-notification-z-index);
        }
        .ping-notification.show { animation: notificationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .ping-notification.centre { left: 50% !important; transform: translateX(-50%) scale(0.9) !important; }
        .ping-notification.centre.show { transform: translateX(-50%) scale(1) !important; }
        @keyframes notificationPop {
            0% { opacity: 0; transform: scale(0.9) translateZ(0);}
            100% { opacity: 1; transform: scale(1) translateZ(0);}
        }
        .ping-notification-content {
            cursor: pointer;
        }
        .ping-notification-header {
            display: flex;
            align-items: center;
        }
        .ping-notification-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
        }
        .ping-notification-title {
            flex-grow: 1;
            font-weight: bold;
            font-size: 19px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ping-notification-close {
            cursor: pointer;
            font-size: 18px;
            padding: 4px;
        }
        .ping-notification-body::-webkit-scrollbar {
            display: none;
        }
        .ping-notification-content.privacy-mode .ping-notification-body,
        .ping-notification-content.privacy-mode .ping-notification-attachment {
            filter: blur(20px);
            transition: filter 0.3s ease;
            position: relative;
        }
        .ping-notification-hover-text {
            position: absolute;
            top: calc(50% + 20px);
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--text-normal);
            font-size: var(--ping-notification-content-font-size);
            font-weight: 500;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.3s ease;
            white-space: nowrap;
            z-index: 100;
            background-color: var(--background-secondary-alt);
            padding: 4px 8px;
            border-radius: 4px;
        }
        .ping-notification-content.privacy-mode:hover .ping-notification-hover-text {
            opacity: 0;
        }
        .ping-notification-content.privacy-mode:hover .ping-notification-body,
        .ping-notification-content.privacy-mode:hover .ping-notification-attachment {
            filter: blur(0);
        }
    `;
};
