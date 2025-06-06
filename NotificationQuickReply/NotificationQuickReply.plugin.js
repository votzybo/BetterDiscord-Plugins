/**
 * @name NotificationQuickReply
 * @author votzybo
 * @version 9.7.2
 * @description In-app notifications for messages/mentions/keywords, with quick reply, quick actions, modern header, visible timer, improved spacing, and a slick, modern settings GUI. Notification height auto-expands to fit message. Progress bar, error handling, scrollable quick panel. Settings allow control of duration, timer, size, position, and more. Notification closes automatically after sending a quick reply.
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateurl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/refs/heads/main/NotificationQuickReply/NotificationQuickReply.plugin.js
 */

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
const Message = Webpack.getModule(m => String(m.type).includes('.messageListItem,"aria-setsize":-1,children:['));
const ChannelAckModule = (() => {
    const filter = BdApi.Webpack.Filters.byStrings("type:\"CHANNEL_ACK\",channelId", "type:\"BULK_ACK\",channels:");
    const module = BdApi.Webpack.getModule((e, m) => filter(BdApi.Webpack.modules[m.id]));
    return Object.values(module).find(m => m.toString().includes("type:\"CHANNEL_ACK\",channelId"));
})();
const updateMessageReferenceStore = (()=>{
    function getActionHandler(){
        const nodes = Dispatcher._actionHandlers._dependencyGraph.nodes;
        const storeHandlers = Object.values(nodes).find(({ name }) => name === "ReferencedMessageStore");
        return storeHandlers.actionHandler["CREATE_PENDING_REPLY"];
    }
    const target = getActionHandler();
    return (message) => target({message});
})();
const constructMessageObj = Webpack.getModule(Webpack.Filters.byStrings("message_reference", "isProbablyAValidSnowflake"), { searchExports: true });
const ChannelConstructor = Webpack.getModule(Webpack.Filters.byPrototypeKeys("addCachedMessages"));
const useStateFromStores = Webpack.getModule(Webpack.Filters.byStrings("getStateFromStores"), { searchExports: true });

const VOTZYBO_SETTINGS_KEY = "notificationquickreply_votzybo_settings";
const VOTZYBO_DEFAULTS = {
    quickReplyEnabled: true,
    quickActions: ["😭", "💀", "???", "LOLL"]
};
const VOTZYBO_TOOLTIP_KEY = "notificationquickreply_quickactions_tooltip_shown";

// --- Modern Switch ---
function ModernSwitch({value, onChange, label, style}) {
    return React.createElement("label", {style: {display: "flex", alignItems: "center", gap: 8, ...style}},
        React.createElement("span", {style: {fontWeight: 500, color: "var(--header-secondary)"}}, label),
        React.createElement("span", {
            style: {
                width: 36, height: 20, borderRadius: 50,
                background: value ? "var(--brand-experiment)" : "var(--background-tertiary)",
                display: "inline-block",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s"
            },
            onClick: () => onChange(!value)
        }, React.createElement("span", {
            style: {
                display: "block",
                position: "absolute",
                left: value ? 18 : 2,
                top: 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#FFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.13)",
                transition: "left 0.17s cubic-bezier(.4,1,.7,1.2)"
            }
        }))
    );
}

function ModernSlider({min, max, value, step=1, onChange, label, style, width=180, unit}) {
    return React.createElement("div", {style: {margin: "14px 0", ...style}},
        React.createElement("div", {style: {fontWeight: 500, color: "var(--header-secondary)", marginBottom: 4}}, label),
        React.createElement("div", {style:{display:"flex",alignItems:"center",gap:14}},
            React.createElement("input", {
                type: "range",
                min, max, value, step,
                onChange: e => onChange(Number(e.target.value)),
                style: {width}
            }),
            React.createElement("input", {
                type: "number",
                min, max, value, step,
                onChange: e => onChange(Number(e.target.value)),
                style: {width: 52, borderRadius: 5, border: "1px solid var(--background-tertiary)", padding: "2px 8px"}
            }),
            unit && React.createElement("span", {style:{fontSize:13, color:"var(--text-muted)"}}, unit)
        )
    );
}

function ModernSelect({label, value, options, onChange, style}) {
    return React.createElement("div", {style: {margin: "14px 0", ...style}},
        React.createElement("div", {style: {fontWeight: 500, color: "var(--header-secondary)", marginBottom: 4}}, label),
        React.createElement("select", {
            value, onChange: e => onChange(e.target.value),
            style: {
                width: 180,
                padding: "6px 10px", borderRadius: 6,
                border: "1px solid var(--background-tertiary)",
                background: "var(--background-primary)",
                color: "var(--text-normal)",
                fontSize: 14
            }
        }, options.map(opt => React.createElement("option", {key:opt.value, value:opt.value}, opt.label)))
    );
}

// --- Modern Settings Panel ---
function ModernSettingsPanel({ settings, updateSettings, testNotification }) {
    const [duration, setDuration] = React.useState(Math.round((settings.duration || 15000) / 1000));
    const [showTimer, setShowTimer] = React.useState(settings.showTimer !== false);
    const [maxWidth, setMaxWidth] = React.useState(settings.maxWidth || 370);
    const [maxHeight, setMaxHeight] = React.useState(settings.maxHeight || 340);
    const [popupLocation, setPopupLocation] = React.useState(settings.popupLocation || "bottomRight");

    React.useEffect(() => {
        updateSettings({
            duration: duration * 1000,
            showTimer,
            maxWidth,
            maxHeight,
            popupLocation,
        });
    }, [duration, showTimer, maxWidth, maxHeight, popupLocation]);

    return React.createElement("div", {style: {
        padding: 32,
        background: "var(--background-secondary)",
        borderRadius: 18,
        boxShadow: "0 4px 24px 0 rgba(0,0,0,0.14)",
        maxWidth: 540,
        margin: "30px auto"
    }},
        React.createElement("div", {
            style: {
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 10
            }
        },
            React.createElement("svg", {width: 30, height: 30, viewBox: "0 0 24 24", fill: "none"},
                React.createElement("rect", {x:4, y:4, width:16, height:16, rx:5, fill:"#5865f2", opacity:0.32}),
                React.createElement("rect", {x:9, y:9, width:6, height:6, rx:3, fill:"#5865F2"}),
                React.createElement("path", {d: "M17.5 7.5l-11 9", stroke:"#5865F2", strokeWidth:2, strokeLinecap:"round"})
            ),
            React.createElement("h1", {style: {
                fontSize: 22,
                fontWeight: 800,
                color: "var(--header-primary)",
                margin: 0
            }}, "NotificationQuickReply Settings")
        ),
        React.createElement("div", {style: {color: "var(--header-secondary)", marginBottom: 18, fontSize: 15}},
            "Personalize your in-app notifications, quick replies, and more."
        ),
        React.createElement(ModernSlider, {
            min: 2, max: 180, value: duration, unit: "seconds",
            onChange: setDuration,
            label: "Notification Duration"
        }),
        React.createElement(ModernSwitch, {
            value: showTimer, onChange: setShowTimer, label: "Show countdown timer and progress bar"
        }),
        React.createElement(ModernSlider, {
            min: 200, max: 700, value: maxWidth, unit: "px", onChange: setMaxWidth, label: "Notification Width"
        }),
        React.createElement(ModernSlider, {
            min: 80, max: 1200, value: maxHeight, unit: "px", onChange: setMaxHeight, label: "Notification Max Height"
        }),
        React.createElement(ModernSelect, {
            value: popupLocation,
            onChange: setPopupLocation,
            label: "Notification Position",
            options: [
                {value:"topLeft", label:"Top Left"},
                {value:"topRight", label:"Top Right"},
                {value:"bottomLeft", label:"Bottom Left"},
                {value:"bottomRight", label:"Bottom Right"},
                {value:"topCentre", label:"Top Center"},
                {value:"bottomCentre", label:"Bottom Center"},
            ]
        }),
        React.createElement("div", {style: {marginTop: 28, marginBottom: 2}},
            React.createElement("button", {
                style: {
                    background: "var(--brand-experiment)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(88,101,242,0.08)"
                },
                onClick: testNotification
            }, "Send Test Notification")
        ),
        React.createElement("div", {style: {
            margin: "32px -32px -32px", background: "var(--background-tertiary)", borderRadius: "0 0 18px 18px", padding: "14px 32px"
        }},
            React.createElement("span", {style: {fontWeight: 700, fontSize: 14, color: "var(--brand-experiment)"}}, "Tip:"),
            " You can also configure your Quick Reply and Quick Actions at the bottom of this page."
        )
    );
}

// --- Modernized Quick Actions Panel ---
function VotzyboSettingsPanel({ settings, onChange }) {
    const [actions, setActions] = React.useState(settings.quickActions.slice());
    const [quickReply, setQuickReply] = React.useState(settings.quickReplyEnabled);

    const [newAction, setNewAction] = React.useState("");
    function saveChanges() {
        onChange({
            quickReplyEnabled: quickReply,
            quickActions: actions.filter(a => a.trim() !== "")
        });
    }

    React.useEffect(saveChanges, [actions, quickReply]);

    function addAction() {
        if (newAction.trim() && actions.length < 8 && !actions.includes(newAction.trim())) {
            setActions(a => [...a, newAction.trim()]);
            setNewAction("");
        }
    }
    function removeAction(idx) {
        setActions(a => a.filter((_, i) => i !== idx));
    }
    function updateAction(idx, value) {
        setActions(arr => arr.map((a, i) => i === idx ? value : a));
    }

    return React.createElement("div", { style: {
        padding: "24px 32px 28px",
        background: "var(--background-secondary)",
        borderRadius: "0 0 18px 18px",
        margin: "32px auto 0",
        maxWidth: 540,
        boxShadow: "0 0 0 0 transparent"
    }},
        React.createElement("h2", {style: {marginTop:0, fontWeight:800, fontSize:18, color:"var(--header-primary)"}}, "Quick Reply & Quick Actions"),
        React.createElement(ModernSwitch, {
            value: quickReply,
            onChange: setQuickReply,
            label: "Enable quick reply box on notifications"
        }),
        React.createElement("div", { style: { margin: "18px 0 10px", color: "var(--header-secondary)", fontWeight:500 } }, "Quick Actions (max 8):"),
        React.createElement("div", {style: {display: "flex", flexDirection: "column", gap: 8, marginBottom: 14}},
            actions.map((action, idx) =>
                React.createElement("div", { key: idx, style: { display: "flex", alignItems: "center", gap: 7 } },
                    React.createElement("input", {
                        type: "text",
                        value: action,
                        maxLength: 24,
                        onChange: e => updateAction(idx, e.target.value),
                        style: {
                            marginRight: 8, flex: "1 1 auto", padding: 6, borderRadius: 6,
                            border: "1px solid var(--background-tertiary)", background: "var(--background-primary)", fontSize: 15
                        }
                    }),
                    React.createElement("button", {
                        onClick: () => removeAction(idx),
                        style: {
                            background: "var(--background-tertiary)",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 12px",
                            cursor: "pointer",
                            color: "var(--text-danger)",
                            fontWeight:700,
                            fontSize: 13
                        }
                    }, "Remove")
                )
            )
        ),
        actions.length < 8 && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 0 } },
            React.createElement("input", {
                type: "text",
                value: newAction,
                maxLength: 24,
                onChange: e => setNewAction(e.target.value),
                placeholder: "Add quick action...",
                style: {
                    marginRight: 8, flex: "1 1 auto", padding: 6, borderRadius: 6,
                    border: "1px solid var(--background-tertiary)", background: "var(--background-primary)", fontSize: 15
                }
            }),
            React.createElement("button", {
                onClick: addAction,
                disabled: !newAction.trim(),
                style: {
                    background: "var(--brand-experiment)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "5px 15px",
                    cursor: newAction.trim() ? "pointer" : "not-allowed",
                    opacity: newAction.trim() ? 1 : 0.5,
                    fontWeight:700,
                    fontSize: 14
                }
            }, "Add")
        )
    );
}

// ... ProgressBar and NotificationComponent remain as in your previous version ...

// --- Helper to add messages for MessageStore ---
function addMessage(message) {
    const channel = ChannelConstructor.getOrCreate(message.channel_id);
    const newChannel = channel.mutate(r => {
        r.ready = true;
        r.cached = true;
        r._map[message.id] = message;
    });
    ChannelConstructor.commit(newChannel);
}

// --- Main Plugin Class ---
module.exports = class NotificationQuickReply {
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
        return Object.assign({}, VOTZYBO_DEFAULTS, BdApi.Data.load('notificationquickreply', VOTZYBO_SETTINGS_KEY));
    }
    saveVotzyboSettings(newSet) {
        this.votzyboSettings = Object.assign({}, this.votzyboSettings, newSet);
        BdApi.Data.save('notificationquickreply', VOTZYBO_SETTINGS_KEY, this.votzyboSettings);
    }
    loadSettings() {
        const savedSettings = BdApi.Data.load('notificationquickreply', 'settings');
        return Object.assign({}, this.defaultSettings, savedSettings);
    }
    saveSettings(newSettings) {
        this.settings = Object.assign({}, this.settings, newSettings);
        BdApi.Data.save('notificationquickreply', 'settings', this.settings);
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
        BdApi.DOM.addStyle("NotificationQuickReplyStyles", this.css);
        BdApi.DOM.addStyle("NotificationQuickReplyQuickReply", `
            .notification-quickreply-quickreply-wrapper {
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
            .notification-quickreply-quickreply-pill {
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
        BdApi.DOM.removeStyle("NotificationQuickReplyStyles");
        BdApi.DOM.removeStyle("NotificationQuickReplyQuickReply");
    }

    onMessageReceived(event) {
        if (!event.message?.channel_id) return;
        const channel = ChannelStore.getChannel(event.message.channel_id);
        const currentUser = UserStore.getCurrentUser();

        if (!channel || event.message.author.id === currentUser.id) return;
        const shouldNotify = NotificationUtils(event.message, event.message.channel_id, false);
        if (shouldNotify) {
            this.showNotification(event.message, channel, {notify:true});
        }
    }

    async showNotification(messageEvent, channel, notifyResult) {
        const notificationElement = BdApi.DOM.createElement('div', {
            className: 'notification-quickreply',
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

        notificationElement.style.setProperty('--notification-quickreply-z-index', isTestNotification ? '1003' : '1003');

        const root = createRoot(notificationElement);
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

        this.activeNotifications.push(notificationElement);
        document.body.prepend(notificationElement);

        void notificationElement.offsetHeight;
        notificationElement.classList.add('show');

        // FIX: Always adjust positions after DOM paint for stacking
        requestAnimationFrame(() => this.adjustNotificationPositions());

        return notificationElement;
    }

    removeNotification(notificationElement) {
        if (document.body.contains(notificationElement)) {
            notificationElement.root.unmount();
            document.body.removeChild(notificationElement);
            this.activeNotifications = this.activeNotifications.filter(n => n !== notificationElement);

            // FIX: Always adjust positions after DOM paint for stacking
            requestAnimationFrame(() => this.adjustNotificationPositions());
        }
    }

    removeAllNotifications() {
        this.activeNotifications.forEach(notification => {
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
            notification.style.transition = 'all 0.2s ease-in-out';
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
        .notification-quickreply {
            color: var(--text-normal);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1);
            overflow: hidden;
            backdrop-filter: blur(10px);
            transform: translateZ(0);
            opacity: 0;
            z-index: var(--notification-quickreply-z-index);
            transition: top 0.22s cubic-bezier(.22,.61,.36,1), bottom 0.22s cubic-bezier(.22,.61,.36,1);
        }
        .notification-quickreply.show { animation: notificationQuickReplyPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .notification-quickreply.centre { left: 50% !important; transform: translateX(-50%) scale(0.9) !important; }
        .notification-quickreply.centre.show { transform: translateX(-50%) scale(1) !important; }
        @keyframes notificationQuickReplyPop {
            0% { opacity: 0; transform: scale(0.9) translateZ(0);}
            100% { opacity: 1; transform: scale(1) translateZ(0);}
        }
        .notification-quickreply-content {
            cursor: pointer;
        }
        .notification-quickreply-header {
            display: flex;
            align-items: center;
        }
        .notification-quickreply-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
        }
        .notification-quickreply-title {
            flex-grow: 1;
            font-weight: bold;
            font-size: 19px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .notification-quickreply-close {
            cursor: pointer;
            font-size: 18px;
            padding: 4px;
        }
        .notification-quickreply-body::-webkit-scrollbar {
            display: none;
        }
        .notification-quickreply-content.privacy-mode .notification-quickreply-body,
        .notification-quickreply-content.privacy-mode .notification-quickreply-attachment {
            filter: blur(20px);
            transition: filter 0.3s ease;
            position: relative;
        }
        .notification-quickreply-hover-text {
            position: absolute;
            top: calc(50% + 20px);
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--text-normal);
            font-size: var(--notification-quickreply-content-font-size);
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
        .notification-quickreply-content.privacy-mode:hover .notification-quickreply-hover-text {
            opacity: 0;
        }
        .notification-quickreply-content.privacy-mode:hover .notification-quickreply-body,
        .notification-quickreply-content.privacy-mode:hover .notification-quickreply-attachment {
            filter: blur(0);
        }
    `;
};
