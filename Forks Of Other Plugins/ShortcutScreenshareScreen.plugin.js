/**
 * @name ShortcutScreenshareScreen
 * @description Screenshare screen from keyboard shortcut when no game is running, with fast/disconnected hotkey response and toast confirmations.
 * @version 1.2.2
 * @author nicola02nb, (global hotkey and toast confirmation by votzybo)
 * @invite hFuY8DfDGK
 * @authorLink https://github.com/nicola02nb
 * @source https://github.com/nicola02nb/BetterDiscord-Stuff/tree/main/Plugins/ShortcutScreenshareScreen
 */
const config = {
    changelog: [],
    settings: [
        { type: "number", id: "displayNumber", name: "Default Display to Screenshare", note: "Set the default display number to screenshare.", value: 1, min: 1, max: 1, step: 1 },
        { type: "category", id: "keybinds", name: "Keybinds", settings: [
            { type: "keybind", id: "toggleStreamShortcut", name: "Toggle Stream Shortcut", note: "Set the shortcut to toggle the stream.", clearable: true, value: [] },
            { type: "keybind", id: "toggleGameOrScreenShortcut", name: "Toggle Game/Screen Shortcut", note: "Set the shortcut to toggle between sharing game or screen.", clearable: true, value: [] },
            { type: "keybind", id: "toggleAudioShortcut", name: "Toggle Audio Shortcut", note: "Set the shortcut to toggle audio sharing.", clearable: true, value: [] },
        ]},
        { type: "category", id: "streamOptions", name: "Stream Options", settings: [
            { type: "switch", id: "disablePreview", name: "Disable Preview", note: "If enabled, the preview will be disabled.", value: false },
            { type: "switch", id: "shareAudio", name: "Share Audio", note: "If enabled, the audio will be shared.", value: true },
            { type: "switch", id: "shareAlwaysScreen", name: "Share Always Screen", note: "If enabled, when you start a stream, it will always screenshare the screen instead of a game.", value: false },
        ]},
    ]
};

const { Webpack } = BdApi;
const { Filters } = Webpack;

const ApplicationStreamingStore = Webpack.getStore("ApplicationStreamingStore");
const MediaEngineStore = Webpack.getStore("MediaEngineStore");
const RTCConnectionStore = Webpack.getStore("RTCConnectionStore");
const RunningGameStore = Webpack.getStore("RunningGameStore");
const StreamRTCConnectionStore = Webpack.getStore("StreamRTCConnectionStore");

const streamStart = Webpack.getModule(Filters.byStrings("STREAM_START", "GUILD", "CALL", "OVERLAY"), { searchExports: true });
const streamStop = Webpack.getModule(Filters.byStrings("STREAM_STOP"), { searchExports: true });

const DiscordUtils = DiscordNative.nativeModules.requireModule("discord_utils");
const platform = process.platform;
const ctrl = platform === "win32" ? 0xa2 : platform === "darwin" ? 0xe0 : 0x25;
const keybindModule = Webpack.getModule(m => m.ctrl === ctrl, { searchExports: true });

// Provide fallback if not found
const fallbackKeybindModule = {
    'ctrl': 0xA2, 'shift': 0xA0, 'alt': 0xA4, 'meta': 0x5B,
    'right ctrl': 0xA3, 'right shift': 0xA1, 'right alt': 0xA5, 'right meta': 0x5C,
    ...Object.fromEntries('abcdefghijklmnopqrstuvwxyz'.split('').map((l, i) => [l, 0x41 + i])),
    ...Object.fromEntries('0123456789'.split('').map((n, i) => [n, 0x30 + i])),
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, 0x70 + i])),
    'comma': 0xBC, 'period': 0xBE, 'slash': 0xBF, 'space': 0x20, 'tab': 0x09, 'backspace': 0x08,
    'enter': 0x0D, 'escape': 0x1B,
};
const KEYBINDS = keybindModule || fallbackKeybindModule;

const TOGGLE_STREAM_KEYBIND = 3000;

var console = {};

module.exports = class ShortcutScreenshareScreen {
    constructor(meta) {
        this.meta = meta;
        this.BdApi = new BdApi(this.meta.name);
        console = this.BdApi.Logger;

        this.settings = {};
        this.keyBindsIds = [];

        this.streamChannelId = null;
        this.streamGuildId = null;
        this.streamOptions = null;

        this.toggleStreamHandle = this.toggleStream.bind(this);
        this.toggleGameOrScreenHandle = this.toggleGameOrScreen.bind(this);
        this.toggleAudiohandle = this.toggleAudio.bind(this);

        // Hotkey reliability patch: focus/visibility/periodic
        this._focusListener = this._onFocus.bind(this);
        this._visibilityListener = this._onVisibilityChange.bind(this);
        this._rebindInterval = null;
    }

    setConfigSetting(id, newValue) {
        for (const setting of config.settings) {
            if (setting.id === id) {
                this.BdApi.Data.save(id, newValue);
                return setting.value = newValue;
            }
            if (setting.settings) {
                for (const settingInt of setting.settings) {
                    if (settingInt.id === id) {
                        this.BdApi.Data.save(id, newValue);
                        settingInt.value = newValue;
                    }
                }
            }
        }
    }

    initSettingsValues() {
        for (const setting of config.settings) {
            if (setting.type === "category") {
                for (const settingInt of setting.settings) {
                    settingInt.value = this.BdApi.Data.load(settingInt.id) ?? settingInt.value;
                    this.settings[settingInt.id] = settingInt.value;
                }
            } else {
                setting.value = this.BdApi.Data.load(setting.id) ?? setting.value;
                this.settings[setting.id] = setting.value;
            }
        }
    }

    getSettingsPanel() {
        return this.BdApi.UI.buildSettingsPanel({
            settings: config.settings,
            onChange: (category, id, value) => {
                this.settings[id] = value;
                this.setConfigSetting(id, value);
                switch (id) {
                    case "toggleStreamShortcut":
                    case "toggleGameOrScreenShortcut":
                    case "toggleAudioShortcut":
                        this.updateKeybinds();
                        break;
                    case "disablePreview":
                        if (this.streamOptions)
                            this.streamOptions.previewDisabled = value;
                        this.updateStream();
                        break;
                    case "shareAudio":
                        if (this.streamOptions)
                            this.streamOptions.sound = value;
                        this.updateStream();
                        break;
                }
            }
        });
    }

    start() {
        this.initSettingsValues();
        this.updateKeybinds();

        // --- PATCH: Hotkey reliability ---
        window.addEventListener("focus", this._focusListener);
        document.addEventListener("visibilitychange", this._visibilityListener);
        this._rebindInterval = setInterval(() => {
            this.updateKeybinds();
        }, 30000); // every 30 seconds
    }

    stop() {
        this.unregisterKeybinds();
        window.removeEventListener("focus", this._focusListener);
        document.removeEventListener("visibilitychange", this._visibilityListener);
        if (this._rebindInterval) clearInterval(this._rebindInterval);
        this._rebindInterval = null;
    }

    _onFocus() {
        this.updateKeybinds();
    }
    _onVisibilityChange() {
        if (document.visibilityState === "visible") {
            this.updateKeybinds();
        }
    }

    getActiveStreamKey() {
        const activeStream = ApplicationStreamingStore.getCurrentUserActiveStream();
        if (activeStream) {
            return activeStream.streamType+":"+activeStream.guildId+":"+activeStream.channelId+":"+activeStream.ownerId;
        }
        return null;
    }

    isStreamingWindow() {
        let streamkey = this.getActiveStreamKey();
        if (streamkey === null) return false;
        let streamSource = StreamRTCConnectionStore.getStreamSourceId(streamkey);
        return streamSource === null || streamSource.startsWith("window");
    }

    async getPreviews(functionName, width = 376, height = 212) {
        const mediaEngine = MediaEngineStore.getMediaEngine();
        let previews = await mediaEngine[functionName](width, height);
        if (functionName === "getScreenPreviews") {
            config.settings[0].max = previews.length;
        }
        return previews;
    }

    async startStream() {
        await this.initializeStreamSetting();
        streamStart(this.streamGuildId, this.streamChannelId, this.streamOptions);
        this.BdApi.showToast("Screenshare started!", {type: "success"});
    }

    async toggleGameOrScreen() {
        await this.updateStreamSetting();
        this.updateStream();
    }

    toggleAudio() {
        this.settings.shareAudio = !this.settings.shareAudio;
        this.setConfigSetting("shareAudio", this.settings.shareAudio);
        if (this.streamOptions) this.streamOptions.sound = this.settings.shareAudio;
        this.updateStream();
    }

    stopStream() {
        let streamkey = this.getActiveStreamKey();
        if (streamkey === null) return;
        streamStop(streamkey);
        this.streamChannelId = null;
        this.streamGuildId = null;
        this.streamOptions = null;
        this.BdApi.showToast("Screenshare stopped!", {type: "info"});
    }

    toggleStream() {
        if (ApplicationStreamingStore.getCurrentUserActiveStream()) {
            this.stopStream();
        } else {
            this.startStream();
        }
    }

    getStreamOptions(surce) {
        return {
            audioSourceId: null,
            goLiveModalDurationMs: 1858,
            nativePickerStyleUsed: undefined,
            pid: surce?.pid ? surce.pid : null,
            previewDisabled: this.settings.disablePreview,
            sound: this.settings.shareAudio,
            sourceId: surce?.id ? surce.id : null,
            sourceName: surce?.name ? surce.name : null,
        };
    }

    async initializeStreamSetting() {
        await this.updateStreamSetting(true);
    }

    async updateStreamSetting(firstInit = false) {
        let game = RunningGameStore.getVisibleGame();
        let streamGame = firstInit ? !this.settings.shareAlwaysScreen && game !== null : !this.isStreamingWindow() && game !== null;
        let displayIndex = this.settings.displayNumber - 1;
        let screenPreviews = await this.getPreviews("getScreenPreviews");
        let windowPreviews = await this.getPreviews("getWindowPreviews");

        if (!streamGame && game && screenPreviews.length === 0) return;
        if (displayIndex >= screenPreviews.length) {
            this.settings.displayNumber = 1;
            this.setConfigSetting("displayNumber", 1);
            displayIndex = 1;
        }

        let screenPreview = screenPreviews[displayIndex];
        let windowPreview = windowPreviews.find(window => window.id.endsWith(game?.windowHandle));

        this.streamChannelId = RTCConnectionStore.getChannelId();
        this.streamGuildId = RTCConnectionStore.getGuildId(this.streamChannelId);

        this.streamOptions = this.getStreamOptions(windowPreview && streamGame ? windowPreview : screenPreview);
    }

    updateStream() {
        if (ApplicationStreamingStore.getCurrentUserActiveStream()) {
            streamStart(this.streamGuildId, this.streamChannelId, this.streamOptions);
        }
    }

    updateKeybinds() {
        this.unregisterKeybinds();
        let shortcuts = { toggleStreamShortcut: this.toggleStreamHandle, toggleGameOrScreenShortcut: this.toggleGameOrScreenHandle, toggleAudioShortcut: this.toggleAudiohandle };

        let i = 0;
        for (const [shortcutName, shortcutFunction] of Object.entries(shortcuts)) {
            if (Array.isArray(this.settings[shortcutName]) && this.settings[shortcutName].length > 0) {
                const mappedKeybinds = this.mapKeybind(this.settings[shortcutName]);
                for (const keybind of mappedKeybinds) {
                    this.registerKeybind(TOGGLE_STREAM_KEYBIND + i, keybind, shortcutFunction);
                    i++;
                }
            }
        }
    }

    mapKeybind(keybind) {
        const mappedKeybinds = [];

        const specialKeys = [];
        const normalKeys = [];

        for (const key of keybind) {
            if (typeof key !== "string" || !key) continue;
            let keyL = key.toLowerCase();
            if (keyL === "control") keyL = "ctrl";
            if (keyL.startsWith("arrow")) keyL = keyL.replace("arrow", "");
            if (keyL.startsWith("page")) keyL = keyL.replace("page", "page ");

            if (keyL === "ctrl" || keyL === "shift" || keyL === "alt" || keyL === "meta") {
                specialKeys.push(keyL);
            }
            else {
                normalKeys.push(keyL);
            }
        }

        const numberOfCombinations = Math.pow(2, specialKeys.length);
        for (let i = 0; i < numberOfCombinations; i++) {
            const combination = [];
            for (let j = 0; j < specialKeys.length; j++) {
                if ((i & Math.pow(2, j)) > 0) {
                    combination.push([0, KEYBINDS[specialKeys[j]]]);
                }
                else {
                    combination.push([0, KEYBINDS["right " + specialKeys[j]]]);
                }
            }
            mappedKeybinds.push(combination);
        }
        for (const mappedKeybind of mappedKeybinds) {
            for (const key of normalKeys) {
                if (KEYBINDS[key]) mappedKeybind.push([0, KEYBINDS[key]]);
            }
        }

        return mappedKeybinds;
    }

    registerKeybind(id, keybind, toCall) {
        if (!Array.isArray(keybind) || keybind.length === 0) {
            console.error("Keybind keybind is not an array or is empty. Keybind: ", keybind);
            return;
        }
        DiscordUtils.inputEventRegister(
            id,
            keybind,
            (isDown) => { if (isDown) toCall() },
            { blurred: true, focused: true, keydown: true, keyup: false }
        );
        this.keyBindsIds.push(id);
    }

    unregisterKeybinds() {
        for (const id of this.keyBindsIds) {
            DiscordUtils.inputEventUnregister(id);
        }
        this.keyBindsIds = [];
    }
};
