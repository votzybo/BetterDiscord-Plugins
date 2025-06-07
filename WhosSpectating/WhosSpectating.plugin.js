/**
 * @name WhosSpectating
 * @author votzybo
 * @version 4.6.2
 * @description Shows who is watching your screenshare above your call info, avatars wrap to new lines if needed, never overlapping the user panel. F2/F2+Shift add/remove fake users for testing. Toggle to disable/enable usernames. Fake users are counted in the spectator total. Spectator count is always visible. For every 10 spectators, new row is allowed (up to any number).
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateUrl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/refs/heads/main/WhosSpectating/WhosSpectating.plugin.js
 */

class WhosWatching {
    constructor() {
        this.defaultSettings = {
            showUsernames: true,
            enableFakeSpectators: false // Now disabled by default
        };
        this.settings = BdApi.loadData("WhosWatching", "settings") || { ...this.defaultSettings };
        Object.assign(this.settings, this.defaultSettings);
        this._fakeSpectators = [];
        this._fakeUserCounter = 1;
        this._keydownHandler = null;
    }

    getName() { return "WhosSpectating"; }
    getDescription() { return "Shows who is watching your screenshare above your call info, avatars wrap to new lines if needed (1 row per 10 spectators), never overlapping the user panel. F2/F2+Shift add/remove fake users for testing. Toggle to disable/enable usernames. Fake users are counted in the spectator total. Spectator count is always visible."; }
    getVersion() { return "4.6.2"; }
    getAuthor() { return "votzybo"; }

    start() {
        this.injectStyle();
        this.observePanel();
        this.pollLoop();
        this.addFakeSpectatorKeybinds();
    }

    stop() {
        this.removeStyle();
        this.disconnectObserver?.();
        this.removePanel();
        clearInterval(this._pollInterval);
        this.removeFakeSpectatorKeybinds();
        this._fakeSpectators = [];
    }

    injectStyle() {
        BdApi.injectCSS("WhosWatching-style", `
            .whoswatching-panel {
                background: var(--background-secondary);
                border-radius: 8px;
                margin: 0 0 16px 0;
                padding: 0px 16px 12px 7px;
                color: var(--header-primary);
                font-size: 17px;
                font-weight: 500;
                box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
                min-height: 0 !important;
                max-height: unset !important;
                overflow: visible !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                position: relative;
            }
            .whoswatching-users {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 10px;
                overflow: visible;
                max-height: unset;
            }
            .whoswatching-user {
                display: flex;
                align-items: center;
                gap: 5px;
                background: var(--background-tertiary);
                border-radius: 8px;
                padding: 4px 0px;
            }
            .whoswatching-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                box-shadow: 0 1px 4px rgb(0 0 0 / 14%);
                position: relative;
                z-index: 1;
                transition: box-shadow 0.2s;
            }
            .whoswatching-nouser {
                color: var(--text-muted);
                font-style: italic;
                margin-top: 6px;
            }
            .whoswatching-panel { margin-bottom: -15px !important; }

            .whoswatching-panel.collapsed {
                padding: 0px 8px 8px 8px;
                font-size: 14px;
                font-weight: 400;
                margin-bottom: 6px !important;
            }
            .whoswatching-panel.collapsed .whoswatching-users {
                gap: 0;
                margin-top: 0;
                position: relative;
                flex-wrap: wrap;
                overflow-y: no;
                min-height: 32px;
            }
            .whoswatching-panel.collapsed .whoswatching-user {
                background: none;
                padding: 0;
                gap: 0;
                position: relative;
                margin-bottom: 0;
            }
            .whoswatching-panel.collapsed .whoswatching-avatar {
                width: 28px;
                height: 28px;
                margin: 2px 0 2px -8px;
                box-shadow: 0 1px 4px rgb(0 0 0 / 18%);
                border: 2px solid var(--background-secondary, #232428);
                z-index: 1;
                transition: border 0.18s;
            }
            .whoswatching-panel.collapsed .whoswatching-avatar:first-child {
                margin-left: 0;
            }
            .whoswatching-spectator-count {
                margin-right: 6px;
                font-weight: 600;
                font-size: 14px;
                display: inline-block;
                vertical-align: middle;
            }
            /* Settings panel styles */
            .whoswatching-settingspanel {
                background: var(--background-secondary);
                border-radius: 10px;
                padding: 24px 28px 12px 28px;
                margin: 24px auto;
                max-width: 430px;
                color: var(--header-primary);
                box-shadow: 0 2px 12px rgba(0,0,0,0.10);
            }
            .whoswatching-settings-title {
                font-weight: bold;
                font-size: 23px;
                margin-bottom: 20px;
                color: var(--header-primary);
                letter-spacing: 0.5px;
            }
            .whoswatching-settings-group {
                margin-bottom: 18px;
            }
            .whoswatching-settings-label {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 16px;
                margin-bottom: 5px;
                font-weight: 500;
                color: var(--header-primary);
            }
            .whoswatching-settings-desc {
                font-size: 13px;
                color: var(--text-muted);
                margin-left: 32px;
                margin-bottom: 0;
                margin-top: -4px;
                line-height: 1.4;
            }
            .whoswatching-settings-toggle {
                accent-color: var(--brand-experiment);
                width: 20px;
                height: 20px;
                margin-right: 2px;
            }
            .whoswatching-settings-note {
                font-size: 13px;
                color: var(--text-muted);
                margin-top: 18px;
                margin-left: 0;
                padding-left: 0;
            }
            .whoswatching-settings-hr {
                border: none;
                border-top: 1px solid var(--background-modifier-accent);
                margin: 18px 0 18px 0;
            }
        `);
    }

    removeStyle() {
        BdApi.clearCSS("WhosWatching-style");
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "whoswatching-settingspanel";

        // Title
        const title = document.createElement("div");
        title.className = "whoswatching-settings-title";
        title.textContent = "WhosWatching Settings";
        panel.appendChild(title);

        // Show Usernames Toggle
        panel.appendChild(this._makeToggleGroup(
            "Show Usernames",
            "If disabled, only avatars are shown (even if there are few spectators).",
            this.settings.showUsernames,
            checked => {
                this.settings.showUsernames = checked;
                BdApi.saveData("WhosWatching", "settings", this.settings);
            }
        ));

        // Enable Fake Spectators Toggle
        panel.appendChild(this._makeToggleGroup(
            "Enable Fake Spectator Testing",
            "When enabled, press F2 to add a fake spectator or Shift+F2 to remove one. Useful for testing the layout.",
            this.settings.enableFakeSpectators,
            checked => {
                this.settings.enableFakeSpectators = checked;
                BdApi.saveData("WhosWatching", "settings", this.settings);
            }
        ));

        // Separator
        panel.appendChild(document.createElement("hr")).className = "whoswatching-settings-hr";

        // Note
        const note = document.createElement("div");
        note.className = "whoswatching-settings-note";
        note.textContent = "Toggle features above. You can test layout with fake spectators (if enabled) using F2 and Shift+F2.";
        panel.appendChild(note);

        return panel;
    }

    _makeToggleGroup(label, desc, checked, onChange) {
        const group = document.createElement("div");
        group.className = "whoswatching-settings-group";

        const toggleLabel = document.createElement("label");
        toggleLabel.className = "whoswatching-settings-label";
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "whoswatching-settings-toggle";
        toggle.checked = !!checked;
        toggle.onchange = e => onChange(toggle.checked);
        toggleLabel.appendChild(toggle);
        toggleLabel.appendChild(document.createTextNode(label));
        group.appendChild(toggleLabel);

        const descDiv = document.createElement("div");
        descDiv.className = "whoswatching-settings-desc";
        descDiv.textContent = desc;
        group.appendChild(descDiv);

        return group;
    }

    observePanel() {
        this.disconnectObserver?.();
        this.removePanel();
        this.lastSpectatorIds = [];
        this.wrapperSelector = '.wrapper_e131a9';

        this.tryInject();

        const panel = document.querySelector(this.wrapperSelector);
        if (panel) {
            this.mo = new MutationObserver(() => {
                this.tryInject();
            });
            this.mo.observe(panel, { childList: true, subtree: true });
            this.disconnectObserver = () => this.mo?.disconnect();
        } else {
            this.mo = new MutationObserver(() => {
                this.tryInject();
            });
            this.mo.observe(document.body, { childList: true, subtree: true });
            this.disconnectObserver = () => this.mo?.disconnect();
        }
    }

    pollLoop() {
        this._pollInterval = setInterval(() => {
            this.tryInject();
        }, 200);
    }

    addFakeSpectatorKeybinds() {
        this._keydownHandler = (e) => {
            if (!this.settings.enableFakeSpectators) return;
            if (e.keyCode === 113 && !e.altKey && !e.ctrlKey && !e.metaKey) {
                if (e.shiftKey) {
                    // Remove a fake spectator
                    if (this._fakeSpectators.length > 0) {
                        this._fakeSpectators.pop();
                        this.tryInject();
                    }
                } else {
                    // Add a fake spectator
                    const n = this._fakeUserCounter++;
                    const fake = {
                        id: "fake-" + n + "-" + Math.random().toString(36).slice(2),
                        username: "Spectator" + n,
                        globalName: "Spectator" + n,
                        nick: "Spectator" + n,
                        getAvatarURL: () => "https://randomuser.me/api/portraits/lego/" + ((n-1) % 10) + ".jpg"
                    };
                    this._fakeSpectators.push(fake);
                    this.tryInject();
                }
            }
        };
        window.addEventListener("keydown", this._keydownHandler, true);
    }

    removeFakeSpectatorKeybinds() {
        if (this._keydownHandler) {
            window.removeEventListener("keydown", this._keydownHandler, true);
            this._keydownHandler = null;
        }
    }

    async tryInject() {
        const panels = document.querySelector('.panels_c48ade');
        if (!panels) {
            this.removePanel();
            return;
        }
    
        let screensharePanel = null;
        for (const child of panels.children) {
            if (child.textContent.includes("Screen 1") || child.querySelector('svg[aria-label="Screen 1"]')) {
                screensharePanel = child;
                break;
            }
        }
    
        // Get real spectators, then merge with fake spectators for display
        const spectators = await this.fetchSpectators();
        const actualUsers = spectators.users.slice();
        const fakeUsers = this.settings.enableFakeSpectators ? [...this._fakeSpectators] : [];
        const allUsers = actualUsers.concat(fakeUsers);
        const showPanel = spectators.isStreaming || fakeUsers.length > 0;
        const currSpectatorIds = allUsers.map(u => u.id).join(",");
        if (!showPanel) {
            this.removePanel();
            return;
        }
        if (this.lastSpectatorIds === currSpectatorIds && panels.querySelector('.whoswatching-panel')) return;
        this.lastSpectatorIds = currSpectatorIds;
        this.removePanel();

        // Insert panel in correct position
        let insertBeforeElem = null;
        if (screensharePanel && screensharePanel.nextSibling) {
            insertBeforeElem = screensharePanel.nextSibling;
        } else {
            // fallback: above user panel
            const userPanel = panels.querySelector('.panel__5dec7.activityPanel_c48ade');
            if (userPanel) insertBeforeElem = userPanel;
        }
        const panelDiv = this.buildPanel(allUsers);
        if (insertBeforeElem) {
            panels.insertBefore(panelDiv, insertBeforeElem);
        } else {
            panels.appendChild(panelDiv);
        }
        this.applyFlexFixes(panels);
    }

    applyFlexFixes(panels) {
        for (const child of panels.children) {
            if (child.classList.contains("whoswatching-panel")) {
                child.style.flexShrink = "0";
                child.style.flexGrow = "0";
                child.style.minHeight = "0";
                child.style.maxHeight = "unset";
                child.style.overflowY = "visible";
            } else if (child.id === "spotifylyrics-panel") {
                child.style.flexShrink = "1";
                child.style.flexGrow = "1";
                child.style.minHeight = "0";
                child.style.maxHeight = "unset";
                child.style.overflowY = "no";
            } else {
                child.style.flexShrink = "0";
                child.style.flexGrow = "0";
                child.style.minHeight = "0";
                child.style.maxHeight = "unset";
                child.style.overflowY = "no";
            }
        }
    }

    async fetchSpectators() {
        const ApplicationStreamingStore = BdApi.Webpack.getModule(m => m.getCurrentUserActiveStream && m.getViewerIds);
        const UserStore = BdApi.Webpack.getModule(m => m.getUser && m.getCurrentUser);
        if (!ApplicationStreamingStore || !UserStore)
            return { users: [], isStreaming: false };

        const stream = ApplicationStreamingStore.getCurrentUserActiveStream?.();
        if (!stream) return { users: [], isStreaming: false };

        const userIds = ApplicationStreamingStore.getViewerIds?.(stream) || [];
        const users = userIds.map(uid => UserStore.getUser(uid)).filter(Boolean);

        return { users, isStreaming: true };
    }

    buildPanel(users) {
        // Collapse if setting enabled, more than 3 spectators, or showUsernames is false
        const collapsed = (this.settings.overflowShrink && users.length > 0)
            || users.length > 3
            || !this.settings.showUsernames;
        const panelDiv = document.createElement("div");
        panelDiv.className = "whoswatching-panel" + (collapsed ? " collapsed" : "");

        if (users.length > 0) {
            const listDiv = document.createElement("div");
            listDiv.className = "whoswatching-users";

            // -- Avatar multi-row logic for collapsed mode
            if (collapsed) {
                // Calculate number of rows: 1 row per 10 spectators
                const avatarsPerRow = 9;
                const rows = Math.ceil(users.length / avatarsPerRow);
                // Let CSS set max-height for the number of rows
                listDiv.style.maxHeight = `${rows * 32 + (rows-1)*4}px`;
                listDiv.style.overflowY = users.length > avatarsPerRow ? "no" : "visible";
            } else {
                listDiv.style.maxHeight = "";
                listDiv.style.overflowY = "";
            }

            users.forEach((user, i) => {
                const userDiv = document.createElement("div");
                userDiv.className = "whoswatching-user";
                const avatar = document.createElement("img");
                avatar.className = "whoswatching-avatar";
                avatar.src = user.getAvatarURL?.() || "";
                avatar.alt = user.username;
                avatar.title = user.globalName || user.nick || user.username;
                userDiv.appendChild(avatar);
                if (!collapsed) {
                    const name = document.createElement("span");
                    name.textContent = user.globalName || user.nick || user.username;
                    userDiv.appendChild(name);
                }
                listDiv.appendChild(userDiv);
            });

            // Always show the spectator count, even if collapsed
            const countSpan = document.createElement("span");
            countSpan.className = "whoswatching-spectator-count";
            countSpan.textContent = `Spectators: ${users.length}`;
            panelDiv.appendChild(countSpan);
            panelDiv.appendChild(listDiv);
        } else {
            panelDiv.appendChild(document.createTextNode(""));
        }
        return panelDiv;
    }

    removePanel() {
        document.querySelectorAll('.whoswatching-panel').forEach(e => e.remove());
    }
}

module.exports = WhosWatching;
