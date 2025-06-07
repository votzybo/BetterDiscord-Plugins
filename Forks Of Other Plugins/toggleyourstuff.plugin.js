//META{ "name": "toggleYourStuff", "website": "https://inve1951.github.io/BetterDiscordStuff/" }*//
/*
 * Toggle-Your-Stuff (with Focus and Global Hotkey Modes)
 * Now allows user to toggle between Discord-focused-only and global hotkeys using Discord's native input event API.
 * Hotkeys, plugins, and themes are set up as in the original.
 * Settings UI allows choosing plugins/themes and hotkeys per item.
 * 
 * CRASH FIX: All .toLowerCase() on hotkey strings are guarded.
 */

const DiscordUtils = DiscordNative.nativeModules.requireModule("discord_utils");

const keybindModule = {
    'ctrl': 0xA2, 'shift': 0xA0, 'alt': 0xA4, 'meta': 0x5B,
    'right ctrl': 0xA3, 'right shift': 0xA1, 'right alt': 0xA5, 'right meta': 0x5C,
    ...Object.fromEntries('abcdefghijklmnopqrstuvwxyz'.split('').map((l, i) => [l, 0x41 + i])),
    ...Object.fromEntries('0123456789'.split('').map((n, i) => [n, 0x30 + i])),
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i + 1}`, 0x70 + i])),
    'comma': 0xBC, 'period': 0xBE, 'slash': 0xBF, 'space': 0x20, 'tab': 0x09, 'backspace': 0x08,
    'enter': 0x0D, 'escape': 0x1B,
};

const PLUGIN_ID_BASE = 0x9000;
const THEME_ID_BASE = 0xB000;

class toggleYourStuff {
    constructor() {
        this.hotkeyIds = [];
        this.settings = null;
        this.Plugins = null;
        this.Themes = null;
        this.listener = this.domListener.bind(this);
    }

    getName() { return "Toggle-Your-Stuff"; }
    getDescription() { return "Toggle your plugins and themes using hotkeys. You can choose to use global hotkeys (work even when Discord is unfocused) or only when Discord is focused."; }
    getVersion() { return "2.2.1"; }
    getAuthor() { return "square (global hotkey patch by votzybo)"; }

    start() {
        this.Plugins = BdApi.Plugins;
        this.Themes = BdApi.Themes;
        this.readSettings();
        this.registerKeybinds();
    }
    stop() {
        this.unregisterKeybinds();
    }

    getSettingsPanel() {
        this.readSettings();
        // Build original style settings panel with plugin/theme hotkey fields and toggle for global/focused mode.
        let plugins = this.Plugins.getAll();
        let themes = this.Themes.getAll();
        const settings = this.settings;
        let panel = `<div id="tys_settings">
        <style>
        #tys_settings, #tys_settings * { color: #b0b6b9 !important; }
        #tys_settings div { margin-top: 10px !important; }
        #tys_settings span { display: block; width: 90%; margin: 0 auto; text-align: center; }
        #tys_settings h2 { font-size: 1.1em; font-weight: bold; text-decoration: underline; }
        #tys_settings input:not([value=""]) { background: rgb(32,196,64); }
        #tys_settings > div { margin-bottom: 20px; }
        </style>
        <span style="font-size:2em;text-decoration:none;margin-top:-30px;">Toggle-Your-Stuff</span><br>
        <label><input name="globalHotkeys" type="checkbox"${settings.globalHotkeys ? " checked" : ""}>Global Hotkeys (work even when Discord not focused)</label><br>
        <label><input name="cancelDefault" type="checkbox"${settings.cancelDefault ? " checked" : ""}>Cancel Default. Prevents default actions for these hotkeys.</label>
        <br><span>Numpad may not work with Shift key.</span>
        <div id="tys-plugin-hotkeys"><h2>Plugins:</h2>`;
        for (let plugin of plugins) {
            let name = typeof plugin.getName === "function" ? plugin.getName() : plugin.name;
            if (!name) continue;
            let bind = settings.plugins[name] || { hotkey: "", ctrl: false, shift: false, alt: false, meta: false };
            panel += `<div id="tys-${name}">
                <b>${name}</b><br>
                <input name="hotkey" type="text" placeholder="Hotkey" style="width:100px"
                    onkeydown="if(['Shift','Control','Alt','Meta'].indexOf(event.key)===-1){this.value = event.code.replace('Key','').replace('Digit','').replace('Numpad','numpad'); this.parentNode.querySelector('[name=keycode]').value = event.keyCode; window.tys_capture = {target:this};} event.preventDefault(); return false;"
                    value="${bind.hotkey}">
                <label><input name="ctrl" type="checkbox"${bind.ctrl ? " checked" : ""}>Ctrl</label>
                <label><input name="shift" type="checkbox"${bind.shift ? " checked" : ""}>Shift</label>
                <label><input name="alt" type="checkbox"${bind.alt ? " checked" : ""}>Alt</label>
                <label><input name="meta" type="checkbox"${bind.meta ? " checked" : ""}>Meta</label>
                <input name="keycode" type="hidden" value="${bind.keycode||""}">
                <button type="button" onclick="this.parentNode.querySelector('[name=hotkey]').value=''; window.BdApi.Plugins.get('toggleYourStuff').instance.updateSettingsUI()">Clear</button>
            </div>`;
        }
        panel += `</div><div id="tys-theme-hotkeys"><h2>Themes:</h2>`;
        for (let theme of themes) {
            let name = theme.name;
            if (!name) continue;
            let bind = settings.themes[name] || { hotkey: "", ctrl: false, shift: false, alt: false, meta: false };
            panel += `<div id="tys-${name}">
                <b>${name}</b><br>
                <input name="hotkey" type="text" placeholder="Hotkey" style="width:100px"
                    onkeydown="if(['Shift','Control','Alt','Meta'].indexOf(event.key)===-1){this.value = event.code.replace('Key','').replace('Digit','').replace('Numpad','numpad'); this.parentNode.querySelector('[name=keycode]').value = event.keyCode; window.tys_capture = {target:this};} event.preventDefault(); return false;"
                    value="${bind.hotkey}">
                <label><input name="ctrl" type="checkbox"${bind.ctrl ? " checked" : ""}>Ctrl</label>
                <label><input name="shift" type="checkbox"${bind.shift ? " checked" : ""}>Shift</label>
                <label><input name="alt" type="checkbox"${bind.alt ? " checked" : ""}>Alt</label>
                <label><input name="meta" type="checkbox"${bind.meta ? " checked" : ""}>Meta</label>
                <input name="keycode" type="hidden" value="${bind.keycode||""}">
                <button type="button" onclick="this.parentNode.querySelector('[name=hotkey]').value=''; window.BdApi.Plugins.get('toggleYourStuff').instance.updateSettingsUI()">Clear</button>
            </div>`;
        }
        panel += `</div>
        <br><button type="button" onclick="window.BdApi.Plugins.get('toggleYourStuff').instance.saveSettingsUI()">Save</button>
        <span style="font-size:0.9em;display:block;margin-top:10px;">You must press Save after making changes.</span>
        </div>
        <script>
        tys_capture = null;
        </script>`;
        // Attach instance for use in inline handlers
        setTimeout(() => {
            try {
                window.BdApi.Plugins.get('toggleYourStuff').instance = this;
            } catch (e) {}
        }, 50);
        return panel;
    }

    updateSettingsUI() {
        // Just a trigger for Save to pick up UI changes
    }

    saveSettingsUI() {
        // Read the DOM and update settings object
        const html = document.getElementById("tys_settings");
        let settings = { plugins: {}, themes: {} };
        settings.globalHotkeys = html.querySelector(`input[name="globalHotkeys"]`).checked;
        settings.cancelDefault = html.querySelector(`input[name="cancelDefault"]`).checked;
        // Plugins
        const pluginDivs = html.querySelector("#tys-plugin-hotkeys").children;
        for (let div of pluginDivs) {
            if (!div.id) continue;
            let id = div.id.slice(4);
            let hotkey = div.querySelector(`input[name="hotkey"]`).value;
            if (!hotkey) continue;
            let ctrl = div.querySelector(`input[name="ctrl"]`).checked;
            let shift = div.querySelector(`input[name="shift"]`).checked;
            let alt = div.querySelector(`input[name="alt"]`).checked;
            let meta = div.querySelector(`input[name="meta"]`).checked;
            let keycode = parseInt(div.querySelector(`input[name="keycode"]`).value || 0, 10);
            settings.plugins[id] = { hotkey, ctrl, shift, alt, meta, keycode };
        }
        // Themes
        const themeDivs = html.querySelector("#tys-theme-hotkeys").children;
        for (let div of themeDivs) {
            if (!div.id) continue;
            let id = div.id.slice(4);
            let hotkey = div.querySelector(`input[name="hotkey"]`).value;
            if (!hotkey) continue;
            let ctrl = div.querySelector(`input[name="ctrl"]`).checked;
            let shift = div.querySelector(`input[name="shift"]`).checked;
            let alt = div.querySelector(`input[name="alt"]`).checked;
            let meta = div.querySelector(`input[name="meta"]`).checked;
            let keycode = parseInt(div.querySelector(`input[name="keycode"]`).value || 0, 10);
            settings.themes[id] = { hotkey, ctrl, shift, alt, meta, keycode };
        }
        this.settings = settings;
        this.saveSettings();
        this.registerKeybinds();
        BdApi.showToast("Toggle-Your-Stuff: Settings saved!", {type:"success"});
    }

    readSettings() {
        let settings = BdApi.getData("toggleYourStuff", "settings") || {};
        if (!settings.plugins) settings.plugins = {};
        if (!settings.themes) settings.themes = {};
        if (settings.cancelDefault == null) settings.cancelDefault = false;
        if (settings.globalHotkeys == null) settings.globalHotkeys = false;
        this.settings = settings;
    }
    saveSettings() {
        BdApi.setData("toggleYourStuff", "settings", this.settings);
    }

    registerKeybinds() {
        this.unregisterKeybinds();
        const settings = this.settings;
        if (settings.globalHotkeys) {
            let idx = 0;
            for (const [plugin, bind] of Object.entries(settings.plugins || {})) {
                if (!bind || !bind.hotkey) continue;
                const keybind = this._toKeybindArray(bind);
                if (!keybind) continue;
                const id = PLUGIN_ID_BASE + idx;
                DiscordUtils.inputEventRegister(
                    id, keybind,
                    (isDown) => { if (isDown) this.togglePlugin(plugin); },
                    { blurred: true, focused: true, keydown: true, keyup: false }
                );
                this.hotkeyIds.push(id);
                idx++;
            }
            idx = 0;
            for (const [theme, bind] of Object.entries(settings.themes || {})) {
                if (!bind || !bind.hotkey) continue;
                const keybind = this._toKeybindArray(bind);
                if (!keybind) continue;
                const id = THEME_ID_BASE + idx;
                DiscordUtils.inputEventRegister(
                    id, keybind,
                    (isDown) => { if (isDown) this.toggleTheme(theme); },
                    { blurred: true, focused: true, keydown: true, keyup: false }
                );
                this.hotkeyIds.push(id);
                idx++;
            }
        } else {
            document.body.addEventListener("keydown", this.listener, true);
        }
    }
    unregisterKeybinds() {
        if (this.settings && this.settings.globalHotkeys) {
            for (const id of this.hotkeyIds) {
                DiscordUtils.inputEventUnregister(id);
            }
            this.hotkeyIds = [];
        } else {
            document.body.removeEventListener("keydown", this.listener, true);
        }
    }

    _toKeybindArray(bind) {
        let arr = [];
        if (bind.ctrl) arr.push([0, keybindModule['ctrl']]);
        if (bind.shift) arr.push([0, keybindModule['shift']]);
        if (bind.alt) arr.push([0, keybindModule['alt']]);
        if (bind.meta) arr.push([0, keybindModule['meta']]);
        let keyName = (typeof bind.hotkey === "string" && bind.hotkey) ? bind.hotkey.toLowerCase() : null;
        if (!keyName) return null;
        if (!(keyName in keybindModule)) return null;
        arr.push([0, keybindModule[keyName]]);
        return arr;
    }

    domListener(ev) {
        let handled = false;
        let keycode = ev.keyCode;
        let ctrl = ev.ctrlKey;
        let shift = ev.shiftKey;
        let alt = ev.altKey;
        let meta = ev.metaKey;
        for (const [plugin, bind] of Object.entries(this.settings.plugins || {})) {
            if (!bind || !bind.hotkey) continue;
            let keyName = (typeof bind.hotkey === "string" && bind.hotkey) ? bind.hotkey.toLowerCase() : null;
            if (!keyName || !(keyName in keybindModule)) continue;
            if (
                keycode === keybindModule[keyName]
                && !!ctrl === !!bind.ctrl
                && !!shift === !!bind.shift
                && !!alt === !!bind.alt
                && !!meta === !!bind.meta
            ) {
                this.togglePlugin(plugin);
                handled = true;
            }
        }
        for (const [theme, bind] of Object.entries(this.settings.themes || {})) {
            if (!bind || !bind.hotkey) continue;
            let keyName = (typeof bind.hotkey === "string" && bind.hotkey) ? bind.hotkey.toLowerCase() : null;
            if (!keyName || !(keyName in keybindModule)) continue;
            if (
                keycode === keybindModule[keyName]
                && !!ctrl === !!bind.ctrl
                && !!shift === !!bind.shift
                && !!alt === !!bind.alt
                && !!meta === !!bind.meta
            ) {
                this.toggleTheme(theme);
                handled = true;
            }
        }
        if (handled && this.settings.cancelDefault) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return false;
        }
    }

    togglePlugin(pluginName) {
        const Plugins = this.Plugins;
        if (Plugins.isEnabled(pluginName)) {
            Plugins.disable(pluginName);
            BdApi.showToast(`Plugin "${pluginName}" disabled!`, { type: "info" });
        } else {
            Plugins.enable(pluginName);
            BdApi.showToast(`Plugin "${pluginName}" enabled!`, { type: "success" });
        }
    }
    toggleTheme(themeName) {
        const Themes = this.Themes;
        if (Themes.isEnabled(themeName)) {
            Themes.disable(themeName);
            BdApi.showToast(`Theme "${themeName}" disabled!`, { type: "info" });
        } else {
            Themes.enable(themeName);
            BdApi.showToast(`Theme "${themeName}" enabled!`, { type: "success" });
        }
    }
}

module.exports = toggleYourStuff;
