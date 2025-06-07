/**
 * @name NotificationQuickReply
 * @author votzybo
 * @version 9.7.3-autosize-modernsettings
 * @description In-app notifications for messages/mentions/keywords, with quick reply, quick actions, modern header, visible timer, improved spacing, and a slick, modern settings GUI. Notification height auto-expands to fit message. Progress bar, error handling, scrollable quick panel. Settings allow control of duration, timer, size, position, and more. Notification closes automatically after sending a quick reply.
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateurl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/refs/heads/main/AtSomeoneRoullette/AtSomeoneRoullette.plugin.js
 */

// ------------------ COMPONENTS FIRST: ProgressBar, NotificationComponent, ModernSwitch, ModernSlider, ModernSelect, ModernSettingsPanel, VotzyboSettingsPanel -----------------

function ProgressBar({ duration, isPaused, onComplete, showTimer, setHeaderTimer }) {
    const [remainingTime, setRemainingTime] = React.useState(duration);
    const [localPause, setLocalPause] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    React.useEffect(() => {
        setHeaderTimer && setHeaderTimer(remainingTime);
    }, [remainingTime, setHeaderTimer]);

    React.useEffect(() => {
        let interval;
        if (!isPaused && !localPause) {
            interval = setInterval(() => {
                setRemainingTime(prev => {
                    if (prev <= 100) {
                        clearInterval(interval);
                        onComplete && onComplete();
                        return 0;
                    }
                    return prev - 100;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPaused, onComplete, duration, localPause]);

    const progress = (remainingTime / duration) * 100;

    const getProgressColor = () => {
        const green = [67, 181, 129];
        const orange = [250, 166, 26];
        const red = [240, 71, 71];
        let color;
        if (progress > 66) {
            color = interpolateColor(orange, green, (progress - 66) / 34);
        } else if (progress > 33) {
            color = interpolateColor(red, orange, (progress - 33) / 33);
        } else {
            color = red;
        }
        return color;
    };
    const interpolateColor = (color1, color2, factor) => color1.map((channel, index) =>
        Math.round(channel + (color2[index] - channel) * factor)
    );

    const toggleLocalPause = (e) => {
        e.stopPropagation();
        setLocalPause(!localPause);
    };

    const progressColor = getProgressColor();
    const progressColorString = `rgb(${progressColor[0]}, ${progressColor[1]}, ${progressColor[2]})`;

    const shouldShowControl = isHovered || localPause;

    return React.createElement('div', {
        style: {
            position: 'relative',
            width: '100%',
            minHeight: '12px',
            marginTop: 8
        }
    },
        React.createElement('div', { 
            style: { 
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '4px',
                width: '100%',
                backgroundColor: 'var(--background-secondary-alt)',
                borderRadius: '0 0 10px 10px',
                zIndex: 1
            }
        }),
        React.createElement('div', { 
            style: { 
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '4px',
                width: `${progress}%`,
                backgroundColor: progressColorString,
                borderRadius: '0 0 10px 10px',
                transition: 'width 0.1s linear, background-color 0.5s ease',
                zIndex: 2
            }
        }),
        React.createElement('div', {
            style: {
                position: 'absolute',
                bottom: '8px',
                right: '12px',
                display: showTimer ? 'flex' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto'
            },
            onClick: toggleLocalPause,
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false)
        }, 
            React.createElement('div', {
                style: {
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--background-primary)',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    overflow: 'visible'
                }
            },
                React.createElement('div', {
                    style: {
                        position: 'absolute',
                        right: '100%',
                        marginRight: '4px',
                        opacity: shouldShowControl ? 1 : 0,
                        transform: shouldShowControl ? 'translateX(0)' : 'translateX(10px)',
                        transition: 'opacity 0.2s ease, transform 0.2s ease, color 0.2s ease',
                        color: localPause ? progressColorString : 'var(--text-normal)',
                        width: '14px',
                        height: '14px'
                    }
                }, 
                    React.createElement('svg', {
                        width: '14',
                        height: '14',
                        viewBox: '0 0 24 24',
                        fill: 'currentColor'
                    },
                        React.createElement('path', {
                            d: 'M19.38 11.38a3 3 0 0 0 4.24 0l.03-.03a.5.5 0 0 0 0-.7L13.35.35a.5.5 0 0 0-.7 0l-.03.03a3 3 0 0 0 0 4.24L13 5l-2.92 2.92-3.65-.34a2 2 0 0 0-1.6.58l-.62.63a1 1 0 0 0 0 1.42l9.58 9.58a1 1 0 0 0 1.42 0l.63-.63a2 2 0 0 0 .58-1.6l-.34-3.64L19 11l.38.38ZM9.07 17.07a.5.5 0 0 1-.08.77l-5.15 3.43a.5.5 0 0 1-.63-.06l-.42-.42a.5.5 0 0 1-.06-.63L6.16 15a.5.5 0 0 1 .77-.08l2.14 2.14Z'
                        })
                    )
                ),
                React.createElement('span', {
                    style: {
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: progressColorString,
                        transition: 'color 0.5s ease'
                    }
                }, `${Math.max(Math.ceil(remainingTime / 1000), 0)}s`)
            )
        )
    );
}

// ...ModernSwitch, ModernSlider, ModernSelect, ModernSettingsPanel, VotzyboSettingsPanel unchanged...

function addMessage(message) {
    const ChannelConstructor = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byPrototypeKeys("addCachedMessages"));
    const channel = ChannelConstructor.getOrCreate(message.channel_id);
    const newChannel = channel.mutate(r => {
        r.ready = true;
        r.cached = true;
        r._map[message.id] = message;
    });
    ChannelConstructor.commit(newChannel);
}

function NotificationComponent({
    message:propMessage, channel, settings,
    votzyboQuickReplyEnabled = true,
    votzyboQuickActions = [],
    isKeywordMatch, matchedKeyword,
    onClose, onClick
}) {
    const useStateFromStores = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byStrings("getStateFromStores"), { searchExports: true });
    const MessageStore = BdApi.Webpack.getStore("MessageStore");
    const GuildStore = BdApi.Webpack.getStore("GuildStore");
    const Message = BdApi.Webpack.getModule(m => String(m.type).includes('.messageListItem,"aria-setsize":-1,children:['));
    const oldMsg = React.useRef({
        message: propMessage,
        deleted: false
    });
    let message = useStateFromStores ? useStateFromStores([MessageStore], function () {
        const message = MessageStore.getMessage(propMessage.channel_id, propMessage.id);
        if (message) 
            oldMsg.current = {
                message: message
            };
        else
            oldMsg.current.deleted = true;
        return message;
    }) : propMessage;
    message = message ? message : oldMsg.current.message;

    if (!channel) return null;
    
    const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;

    const [isPaused, setIsPaused] = React.useState(false);
    const [headerTimer, setHeaderTimer] = React.useState(settings.duration);

    // Quick Reply/Actions logic
    const [replyHovered, setReplyHovered] = React.useState(false);
    const [replyFocused, setReplyFocused] = React.useState(false);
    const [replyValue, setReplyValue] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const [quickActionsExpanded, setQuickActionsExpanded] = React.useState(false);
    const [showQuickActionPill, setShowQuickActionPill] = React.useState(() =>
        !BdApi.Data.load('PingNotification', "votzybo_quickactions_tooltip_shown")
    );
    const [errorBanner, setErrorBanner] = React.useState("");
    const replyRef = React.useRef(null);

    function dismissQuickActionPill() {
        setShowQuickActionPill(false);
        BdApi.Data.save('PingNotification', "votzybo_quickactions_tooltip_shown", true);
    }
    function stopBubble(e) { e.stopPropagation(); }
    async function sendReply() {
        if (!replyValue.trim()) return;
        setSending(true);
        setErrorBanner(""); // Reset error
        try {
            const SendMessageModule = BdApi.Webpack.getModule(m => m?.sendMessage && m?.receiveMessage);
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
        setReplyValue(v => v + (v && !v.endsWith(" ") ? " " : "") + action);
        setQuickActionsExpanded(false);
        if (replyRef.current) replyRef.current.focus();
    }

    const baseWidth = 370;
    const baseHeight = 300;
    const scaleFactor = Math.min(
        Math.max(0.8, settings.maxWidth / baseWidth),
        Math.max(0.8, settings.maxHeight / baseHeight)
    );
    const getDynamicScale = (scale) => 1 + (Math.log1p(scale - 1) * 0.5);
    const dynamicScale = getDynamicScale(scaleFactor);

    return React.createElement('div', {
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
            padding: `${Math.round(16 * dynamicScale)}px`,
            paddingBottom: `${Math.round(24 * dynamicScale)}px`,
            minHeight: 0,
            maxHeight: settings.maxHeight || 600,
            width: `${settings.maxWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--activity-card-background)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            transform: 'translateZ(0)',
            transition: 'all 0.3s ease',
            userSelect: 'none',
            WebkitUserDrag: 'none',
            zIndex: settings.disableMediaInteraction ? 2: 'auto',
            '--ping-notification-content-font-size': `${Math.round(14 * dynamicScale)}px`
        }
    },
        // Header
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
            React.createElement('div', {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    fontSize: '15px',
                    color: 'var(--brand-experiment)'
                }
            },
                channel.guild_id
                    ? [
                        React.createElement('span', { style: {fontWeight:700}}, guild?.name || "Server"),
                        React.createElement('span', { style: { color: 'var(--text-muted)', fontWeight: 400, fontSize: '13px', marginLeft: 8 } }, `#${channel.name}`)
                    ]
                    : [
                        React.createElement('svg', {
                            width: 18,
                            height: 18,
                            viewBox: "0 0 24 24",
                            fill: "currentColor",
                            style: { marginRight: 4, verticalAlign: 'middle', color: 'var(--brand-experiment)' }
                        }, React.createElement('path', { d: "M3 4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6l3 3 3-3h6c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H3zm0 2h18v11h-6.17L12 20.17 9.17 17H3V6zm2 2v2h14V8H5zm0 4v2h9v-2H5z"})),
                        React.createElement('span', { style: {fontWeight:700}}, "Direct Message")
                    ]
            ),
            settings.showTimer && React.createElement('span', {
                style: {
                    position: 'absolute',
                    right: 36,
                    top: 0,
                    color: 'var(--brand-experiment)',
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
            },
            onMouseEnter: (e) => {
                e.currentTarget.style.overflowY = 'auto';
            },
            onMouseLeave: (e) => {
                e.currentTarget.style.overflowY = 'hidden';
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
                React.createElement(Message, {
                    id: `${message.id}-${message.id}`,
                    groupId: message.id,
                    channel: channel,
                    message: message,
                    compact: false,
                    renderContentOnly: false,
                    className: "ping-notification-messageContent"
                })
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
        votzyboQuickReplyEnabled && React.createElement('div', {
            className: 'ping-notification-quickreply-wrapper',
            style: { display: "flex", position: "relative", paddingBottom: 0, minHeight: 52 }
        },
            React.createElement("div", { style: { position: "relative", display: "flex", alignItems: "center" } },
                React.createElement("button", {
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
                    onMouseEnter: () => setQuickActionsExpanded(true),
                    onMouseLeave: () => setQuickActionsExpanded(false),
                    onClick: (e) => {
                        stopBubble(e);
                        setQuickActionsExpanded(v => !v);
                        if (showQuickActionPill) setTimeout(dismissQuickActionPill, 2000);
                    }
                }, "✨"),
                React.createElement("div", {
                    style: {
                        position: "absolute",
                        left: 38,
                        bottom: 44,
                        width: quickActionsExpanded ? 170 : 38,
                        maxHeight: quickActionsExpanded ? 192 : 38,
                        minHeight: 38,
                        background: "var(--background-floating, #23272a)",
                        borderRadius: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                        padding: quickActionsExpanded ? "8px 0" : "0",
                        zIndex: 10004,
                        overflowY: "auto",
                        overflowX: "hidden",
                        display: quickActionsExpanded ? "block" : "none",
                        transition: "all .18s cubic-bezier(.4,1,.7,1.2)",
                    },
                    onMouseEnter: () => setQuickActionsExpanded(true),
                    onMouseLeave: () => setQuickActionsExpanded(false)
                },
                    (votzyboQuickActions || []).map((action, i) =>
                        React.createElement("div", {
                            key: i,
                            style: {
                                padding: "6px 16px",
                                cursor: "pointer",
                                fontSize: "17px",
                                color: "var(--text-normal)",
                                borderBottom: (i < votzyboQuickActions.length - 1) ? "1px solid var(--background-tertiary)" : "none",
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            },
                            onClick: (e) => { stopBubble(e); handleQuickAction(action); }
                        }, action)
                    )
                ),
                showQuickActionPill && quickActionsExpanded && React.createElement("div", {
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
                    fontSize: "14px",
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
                    background: "var(--brand-experiment)",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "14px",
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
            isPaused: isPaused || replyFocused || replyHovered,
            onComplete: () => onClose(false),
            showTimer: settings.showTimer,
            setHeaderTimer: setHeaderTimer
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
        }, `Keyword: ${matchedKeyword}`)
    );
}

// --- Constants ---
const VOTZYBO_SETTINGS_KEY = "votzybo_settings";
const VOTZYBO_DEFAULTS = {
    quickReplyEnabled: true,
    quickActions: ["😭", "💀", "???", "LOLL"]
};
const VOTZYBO_TOOLTIP_KEY = "votzybo_quickactions_tooltip_shown";

const { React, Webpack, ReactDOM, UI } = BdApi;
const { createRoot } = ReactDOM;
const NotificationUtils = BdApi.Webpack.getByStrings("SUPPRESS_NOTIFICATIONS", "SELF_MENTIONABLE_SYSTEM", {searchExports:true});
const NotificationSoundModule = Webpack.getModule(m => m?.playNotificationSound);
const UserStore = Webpack.getStore("UserStore");
const ChannelStore = Webpack.getStore("ChannelStore"); 
const GuildStore = Webpack.getStore("GuildStore");
const transitionTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{searchExports:true});
const GuildMemberStore = Webpack.getStore("GuildMemberStore");
const Dispatcher = BdApi.Webpack.getByKeys("subscribe", "dispatch");
const MessageStore = Webpack.getStore("MessageStore");
const ReferencedMessageStore = BdApi.Webpack.getStore("ReferencedMessageStore");
const MessageActions = BdApi.Webpack.getByKeys("fetchMessage", "deleteMessage");
const ChannelConstructor = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byPrototypeKeys("addCachedMessages"));
const constructMessageObj = Webpack.getModule(Webpack.Filters.byStrings("message_reference", "isProbablyAValidSnowflake"), { searchExports: true });

module.exports = class PingNotification {
    constructor(meta) {
        this.meta = meta;
        this.defaultSettings = {
            duration: 15000,
            maxWidth: 370,
            maxHeight: 340,
            popupLocation: "bottomRight",
            showTimer: true
        };
        this.settings = this.loadSettings();
        this.activeNotifications = [];
        this.testNotificationData = null;
        this.votzyboSettings = this.loadVotzyboSettings();
        this.saveVotzyboSettings(this.votzyboSettings);
        this.onMessageReceived = this.onMessageReceived.bind(this);
    }

    loadVotzyboSettings() {
        return Object.assign({}, VOTZYBO_DEFAULTS, BdApi.Data.load('PingNotification', VOTZYBO_SETTINGS_KEY));
    }
    saveVotzyboSettings(newSet) {
        this.votzyboSettings = Object.assign({}, this.votzyboSettings, newSet);
        BdApi.Data.save('PingNotification', VOTZYBO_SETTINGS_KEY, this.votzyboSettings);
    }
    loadSettings() {
        const savedSettings = BdApi.Data.load('PingNotification', 'settings');
        return Object.assign({}, this.defaultSettings, savedSettings);
    }
    saveSettings(newSettings) {
        this.settings = Object.assign({}, this.settings, newSettings);
        BdApi.Data.save('PingNotification', 'settings', this.settings);
    }

    start() {
        Dispatcher.subscribe("MESSAGE_CREATE", this.messageCreateHandler = (event) => {
            if (!event?.message) return;
            this.onMessageReceived(event);
        });
        Dispatcher.subscribe("MESSAGE_ACK", this.messageAckHandler = (event) => {
            if (!this.settings.closeOnRead) return;
            const notificationsToClose = this.activeNotifications.filter(notification =>
                notification.channelId === event.channelId
            );
            if (notificationsToClose.length > 0) {
                requestAnimationFrame(() => {
                    notificationsToClose.forEach(notification => {
                        this.removeNotification(notification);
                    });
                });
            }
        });
        BdApi.DOM.addStyle("PingNotificationStyles", this.css);
        BdApi.DOM.addStyle("PingNotificationQuickReply", `
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
        Dispatcher.unsubscribe("MESSAGE_CREATE", this.messageCreateHandler);
        Dispatcher.unsubscribe("MESSAGE_ACK", this.messageAckHandler);
        this.removeAllNotifications();
        BdApi.DOM.removeStyle("PingNotificationStyles");
        BdApi.DOM.removeStyle("PingNotificationQuickReply");
    }

    onMessageReceived(event) {
        if (!event.message?.channel_id) return;
        const channel = ChannelStore.getChannel(event.message.channel_id);
        const currentUser = UserStore.getCurrentUser();

        if (!channel || event.message.author.id === currentUser.id) return;
        const shouldNotify = NotificationUtils ? NotificationUtils(event.message, event.message.channel_id, false) : false;
        if (shouldNotify) {
            this.showNotification(event.message, channel, {notify:true});
        }
    }

    async showNotification(messageEvent, channel, notifyResult) {
        const notificationElement = BdApi.DOM.createElement('div', {
            className: 'ping-notification',
            'data-channel-id': channel.id
        });

        // Position classes for center support
        if (this.settings.popupLocation && this.settings.popupLocation.endsWith("Centre")) {
            notificationElement.classList.add('centre');
        }

        let message = MessageStore.getMessage(channel.id, messageEvent.id);

        if (!message){
            message = constructMessageObj(messageEvent);
            addMessage(message);
        }

        notificationElement.creationTime = Date.now();
        notificationElement.channelId = channel.id;
        notificationElement.messageId = message.id;
        notificationElement.message = message;

        notificationElement.isKeywordMatch = false;
        notificationElement.matchedKeyword = null;

        const isTestNotification = message.id === "0";
        notificationElement.isTestNotification = isTestNotification;

        notificationElement.style.setProperty('--ping-notification-z-index', isTestNotification ? '1003' : '1003');

        let root;
        if (ReactDOM.createRoot) {
            root = createRoot(notificationElement);
            root.render(
                React.createElement(NotificationComponent, {
                    message: message,
                    channel: channel,
                    settings: this.settings,
                    votzyboQuickReplyEnabled: this.votzyboSettings.quickReplyEnabled,
                    votzyboQuickActions: this.votzyboSettings.quickActions,
                    isKeywordMatch: notificationElement.isKeywordMatch,
                    matchedKeyword: notificationElement.matchedKeyword,
                    onClose: (isManual) => {
                        notificationElement.manualClose = isManual;
                        this.removeNotification(notificationElement);
                    },
                    onClick: () => {
                        if (!isTestNotification) {
                            this.onNotificationClick(channel, message);
                        }
                        this.removeNotification(notificationElement);
                    }
                })
            );
            notificationElement.root = root;
        } else {
            ReactDOM.render(
                React.createElement(NotificationComponent, {
                    message: message,
                    channel: channel,
                    settings: this.settings,
                    votzyboQuickReplyEnabled: this.votzyboSettings.quickReplyEnabled,
                    votzyboQuickActions: this.votzyboSettings.quickActions,
                    isKeywordMatch: notificationElement.isKeywordMatch,
                    matchedKeyword: notificationElement.matchedKeyword,
                    onClose: (isManual) => {
                        notificationElement.manualClose = isManual;
                        this.removeNotification(notificationElement);
                    },
                    onClick: () => {
                        if (!isTestNotification) {
                            this.onNotificationClick(channel, message);
                        }
                        this.removeNotification(notificationElement);
                    }
                }),
                notificationElement
            );
            notificationElement.root = { unmount: () => ReactDOM.unmountComponentAtNode(notificationElement) };
        }

        this.activeNotifications.push(notificationElement);
        document.body.prepend(notificationElement);
        void notificationElement.offsetHeight;
        notificationElement.classList.add('show');

        requestAnimationFrame(() => {
            this.adjustNotificationPositions();
        });

        // Extra robustness: adjust on image load
        const imgs = notificationElement.querySelectorAll('img');
        imgs.forEach(img => {
            img.addEventListener('load', () => this.adjustNotificationPositions());
        });

        // Extra robustness: use ResizeObserver
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(() => this.adjustNotificationPositions());
            ro.observe(notificationElement);
            notificationElement._resizeObserver = ro;
        }

        return notificationElement;
    }

    removeNotification(notificationElement) {
        if (notificationElement._resizeObserver) notificationElement._resizeObserver.disconnect();
        if (document.body.contains(notificationElement)) {
            notificationElement.root.unmount();
            document.body.removeChild(notificationElement);
            this.activeNotifications = this.activeNotifications.filter(n => n !== notificationElement);
            this.adjustNotificationPositions();
        }
    }

    removeAllNotifications() {
        this.activeNotifications.forEach(notification => {
            if (notification._resizeObserver) notification._resizeObserver.disconnect();
            if (document.body.contains(notification)) {
                notification.root.unmount();
                document.body.removeChild(notification);
            }
        });
        this.activeNotifications = [];
    }

    adjustNotificationPositions() {
        const { popupLocation } = this.settings;
        let offset = 30;
        const isTop = popupLocation && popupLocation.startsWith("top");
        const isLeft = popupLocation && popupLocation.endsWith("Left");
        const isCentre = popupLocation && popupLocation.endsWith("Centre");

        const sortedNotifications = [...this.activeNotifications].sort((a, b) => {
            return b.creationTime - a.creationTime;
        });

        sortedNotifications.forEach((notification) => {
            const height = notification.offsetHeight;
            notification.style.transition = 'all 0.1s cubic-bezier(.4,1,.7,1.2)';
            notification.style.position = 'fixed';

            if (isTop) {
                notification.style.top = `${offset}px`;
                notification.style.bottom = 'auto';
            } else {
                notification.style.bottom = `${offset}px`;
                notification.style.top = 'auto';
            }

            if (isCentre) {
                notification.style.left = '50%';
                notification.style.right = 'auto';
                notification.style.transform = 'translateX(-50%)';
            } else if (isLeft) {
                notification.style.left = '20px';
                notification.style.right = 'auto';
                notification.style.transform = 'none';
            } else {
                notification.style.right = '20px';
                notification.style.left = 'auto';
                notification.style.transform = 'none';
            }

            offset += height + 10;
        });
    }

    onNotificationClick(channel, message) {
        const notificationsToRemove = this.activeNotifications.filter(notification =>
            notification.channelId === channel.id
        );
        notificationsToRemove.forEach(notification => {
            this.removeNotification(notification);
        });
        transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
    }

    getSettingsPanel() {
        const plugin = this;
        return function SettingsWrapper() {
            const [settings, setSettings] = React.useState(plugin.settings);
            const testNotification = () => {
                const fakeMsg = {
                    id: "0",
                    channel_id: "0",
                    author: {
                        id: "0",
                        username: "TestUser",
                        avatar: null,
                        discriminator: "0000",
                        globalName: "TestUser"
                    },
                    content: "This is a test notification! Try out the quick reply and quick actions. Adjust settings and test again.",
                    timestamp: new Date().toISOString()
                };
                const fakeChannel = {
                    id: "0",
                    name: "test-channel",
                    recipients: [],
                    type: 1,
                    nsfw: false,
                    nsfw_: false
                };
                plugin.showNotification(fakeMsg, fakeChannel, { notify: true });
            };
            return React.createElement("div", {},
                React.createElement(ModernSettingsPanel, {
                    settings,
                    updateSettings: s => {
                        const merged = Object.assign({}, plugin.settings, s);
                        plugin.saveSettings(merged);
                        setSettings(merged);
                    },
                    testNotification
                }),
                React.createElement(VotzyboSettingsPanel, {
                    settings: plugin.votzyboSettings,
                    onChange: (changes) => {
                        plugin.saveVotzyboSettings(changes);
                    }
                })
            );
        };
    }

    css = `
        .ping-notification {
            color: var(--text-normal);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1);
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
