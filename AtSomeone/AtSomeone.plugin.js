/**
 * @name AtSomeone
 * @author votzybo
 * @version 10.8.3
 * @description Modern @someone roulette: floating, animated, customizable pill above the chat, sound effects, avatars, and full settings UI (panel & right-click menu). Robust sound playback, click-to-copy, and bot exclusion. Now with spin sound on EVERY cycle!
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateUrl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/main/AtSomeone.plugin.js
 */


module.exports = (() => {
    const { ContextMenu } = BdApi;

    // --- Settings defaults ---
    const defaultSettings = {
        animationSpeed: "medium",
        pillPosition: "middle",
        pillWidth: 270,
        pillHeight: 52,
        pillFontSize: 20,
        showAvatar: true,
        soundVolume: 0.7,
        enableSound: true
    };

    let settings = {...defaultSettings};

    // --- Sound assets ---
    const SPIN_SOUND = "https://files.catbox.moe/u7t23h.mp3";
    const STOP_SOUND = "https://files.catbox.moe/5aldy5.mp3";

    let observer = null;
    let buttonId = "atsomeone-btn-" + Math.floor(Math.random()*1e8);

    // --- Webpack modules for super-broad compatibility ---
    function getWebpackModule(filter) {
        return BdApi.Webpack?.getModule?.(filter) || BdApi.findModule?.(filter);
    }
    const GuildMemberStore = getWebpackModule(m => m.getMembers && m.getMember);
    const ChannelStore = getWebpackModule(m => m.getChannel && m.getDMFromUserId);
    const UserStore = getWebpackModule(m => m.getCurrentUser && m.getCurrentUser().id);
    const SelectedChannelStore = getWebpackModule(m => m.getChannelId && m.getVoiceChannelId);
    const UserMod = getWebpackModule(m => m.getUser && m.getUsers);
    const PermissionStore = getWebpackModule(m => m && typeof m.can === "function");
    const Permissions = { VIEW_CHANNEL: 0x400 };

    function saveSettings() { BdApi.saveData("AtSomeone", "settings", settings); }
    function loadSettings() {
        const loaded = BdApi.loadData("AtSomeone", "settings");
        if (loaded) Object.assign(settings, loaded);
    }

    // --- Robust sound playback ---
    function playSound(type) {
        if (!settings.enableSound) return;
        let url = type === "spin" ? SPIN_SOUND : STOP_SOUND;
        if (!url) return;
        try {
            let audio = new Audio(url);
            audio.volume = typeof settings.soundVolume === "number" ? settings.soundVolume : 0.7;
            audio.play().catch(() => {
                BdApi.UI.showToast("Unable to play roulette sound (maybe autoplay is blocked).", {type:"error"});
            });
        } catch (e) {
            BdApi.UI.showToast("Failed to play sound.", {type:"error"});
        }
    }

    // --- User eligibility, cycles all real (non-bot) members in server ---
    function getEligibleUsers() {
        const selfId = UserStore.getCurrentUser().id;
        const channelId = SelectedChannelStore.getChannelId();
        const channel = ChannelStore.getChannel(channelId);
        if (!channel) return [];

        // DMs & Groups
        if (channel.type === 1 || channel.type === 3) {
            return (channel.recipients || []).filter(id => id && id !== selfId);
        } else if (channel.guild_id) {
            const members = GuildMemberStore.getMembers(channel.guild_id) || [];
            // Use UserMod to filter out bots!
            return members
                .map(m => m.userId)
                .filter(uid => {
                    if (!uid || uid === selfId) return false;
                    const user = UserMod.getUser(uid);
                    if (user && user.bot) return false;
                    if (PermissionStore && typeof PermissionStore.can === "function") {
                        try {
                            return PermissionStore.can(Permissions.VIEW_CHANNEL, channel, uid);
                        } catch {
                            return true;
                        }
                    }
                    return true;
                });
        }
        return [];
    }
    function getUserDisplay(userId, guildId) {
        if (UserMod && UserMod.getUser) {
            const user = UserMod.getUser(userId);
            if (guildId) {
                const member = GuildMemberStore.getMember(guildId, userId);
                if (member && member.nick) return member.nick;
            }
            return user?.globalName || user?.username || "Unknown";
        }
        return "Unknown";
    }
    function getUserAvatar(userId) {
        const user = UserMod && UserMod.getUser ? UserMod.getUser(userId) : null;
        if (user?.avatar) {
            return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
        } else if (user?.discriminator) {
            return `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
        }
        return "";
    }

    // --- Clipboard helper (modern+Electron) ---
    function copyToClipboard(text) {
        try {
            if (typeof window.require === "function") {
                const electron = window.require("electron");
                if (electron && electron.clipboard) {
                    electron.clipboard.writeText(String(text));
                    return true;
                }
            }
        } catch (e) {}
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(String(text)).catch(() => fallbackCopy(text));
            return true;
        }
        fallbackCopy(text);
        return true;
        function fallbackCopy(txt) {
            try {
                const temp = document.createElement("textarea");
                temp.value = String(txt);
                temp.setAttribute("readonly", "");
                temp.style.position = "absolute";
                temp.style.left = "-9999px";
                document.body.appendChild(temp);
                temp.select();
                document.execCommand("copy");
                document.body.removeChild(temp);
            } catch (e) {
                BdApi.UI.showToast("Failed to copy to clipboard. Please copy manually.", { type: "error" });
            }
        }
    }

    // --- Floating pill ---
    function getOrCreatePillContainer() {
        let container = document.getElementById("atsomeone-pill-container");
        if (container) return container;
        const inputWrapper = document.querySelector('[class^="channelTextArea_"],[class*=" channelTextArea_"]');
        if (!inputWrapper) return null;
        container = document.createElement("div");
        container.id = "atsomeone-pill-container";
        container.style.position = "absolute";
        let pos = settings.pillPosition;
        if (pos === "top") {
            container.style.bottom = "110px";
        } else if (pos === "middle") {
            container.style.bottom = "64px";
        } else {
            container.style.bottom = "30px";
        }
        container.style.left = "50%";
        container.style.transform = "translateX(-50%)";
        container.style.zIndex = "1001";
        container.style.pointerEvents = "none";
        inputWrapper.appendChild(container);
        return container;
    }
    function clearPillContainer() {
        const container = document.getElementById("atsomeone-pill-container");
        if (container) container.remove();
    }

    // --- Animation timing presets ---
    const speedMap = {
        "instant":   {steps: 3,   baseDelay: 1,   maxDelay: 20},
        "short":     {steps: 14,  baseDelay: 10,  maxDelay: 44},
        "medium":    {steps: 32,  baseDelay: 18,  maxDelay: 320},
        "long":      {steps: 54,  baseDelay: 30,  maxDelay: 420},
        "extra long":{steps: 80,  baseDelay: 48,  maxDelay: 550}
    };

    function showRoulettePill(users, toolbar, onFinish, guildId) {
        clearPillContainer();
        const container = getOrCreatePillContainer();
        if (!container) return;

        // Make pill
        const pill = document.createElement("div");
        pill.style.display = "flex";
        pill.style.alignItems = "center";
        pill.style.gap = "8px";
        pill.style.background = "var(--background-floating, #232428)";
        pill.style.borderRadius = "999px";
        pill.style.boxShadow = "0 2px 12px rgba(0,0,0,0.22)";
        pill.style.padding = "10px 26px";
        pill.style.color = "var(--header-primary)";
        pill.style.fontWeight = "bold";
        pill.style.fontSize = settings.pillFontSize + "px";
        pill.style.border = "2.5px solid var(--brand-experiment)";
        pill.style.pointerEvents = "auto";
        pill.style.transition = "border 0.25s";
        pill.style.userSelect = "none";
        pill.style.minWidth = settings.pillWidth + "px";
        pill.style.maxWidth = (settings.pillWidth + 100) + "px";
        pill.style.height = settings.pillHeight + "px";
        pill.style.justifyContent = "center";
        pill.style.marginBottom = "4px";
        pill.style.cursor = "pointer";

        // Avatar
        const avatar = document.createElement("img");
        avatar.style.width = (settings.pillHeight-8) + "px";
        avatar.style.height = (settings.pillHeight-8) + "px";
        avatar.style.borderRadius = "50%";
        avatar.style.boxShadow = "0 1px 7px rgba(0,0,0,0.10)";
        avatar.style.border = "2px solid #aaa";
        avatar.style.background = "#222";
        avatar.style.display = settings.showAvatar ? "" : "none";
        pill.appendChild(avatar);

        // Username
        const nameElem = document.createElement("span");
        nameElem.style.fontSize = settings.pillFontSize + "px";
        nameElem.style.fontWeight = "bold";
        nameElem.style.overflow = "hidden";
        nameElem.style.textOverflow = "ellipsis";
        nameElem.style.whiteSpace = "nowrap";
        pill.appendChild(nameElem);

        // Status text
        const descElem = document.createElement("span");
        descElem.style.fontSize = Math.max(settings.pillFontSize-5, 12) + "px";
        descElem.style.fontWeight = "normal";
        descElem.style.color = "var(--text-muted)";
        descElem.style.marginLeft = "12px";
        pill.appendChild(descElem);

        container.appendChild(pill);

        const speed = speedMap[settings.animationSpeed] || speedMap.medium;
        let steps = speed.steps, baseDelay = speed.baseDelay, maxDelay = speed.maxDelay;
        let chosen = Math.floor(Math.random() * users.length);
        let current = 0;

        function setDisplay(idx, rollingState) {
            const userId = users[idx];
            avatar.src = getUserAvatar(userId) || "";
            avatar.style.display = settings.showAvatar ? "" : "none";
            avatar.style.filter = rollingState ? "grayscale(60%) blur(0.5px)" : "none";
            avatar.style.width = rollingState ? (settings.pillHeight - 8) + "px" : (settings.pillHeight) + "px";
            avatar.style.height = rollingState ? (settings.pillHeight - 8) + "px" : (settings.pillHeight) + "px";
            avatar.style.border = rollingState ? "2px solid #aaa" : "3px solid var(--brand-experiment)";
            nameElem.textContent = (rollingState ? "🎲 " : "🎯 ") + getUserDisplay(userId, guildId);
            descElem.textContent = rollingState ? "Rolling..." : "Click to copy mention!";
            pill.style.border = `2.5px solid ${rollingState ? "var(--brand-experiment)" : "var(--green-360, #3ba55c)"}`;
        }

        let stopped = false;
        function roll(step) {
            if (stopped) return;
            playSound("spin"); // <-- Play spin sound EVERY cycle!
            if (step >= steps) {
                setDisplay(chosen, false);
                setTimeout(() => playSound("stop"), 100);
                let pillTimeout = setTimeout(() => { clearPillContainer(); }, 10000);
                pill.onclick = () => {
                    clearTimeout(pillTimeout);
                    const userId = users[chosen];
                    const userName = getUserDisplay(userId, guildId);
                    if (userId && userName) {
                        copyToClipboard(`<@${userId}>`);
                        BdApi.UI.showToast(`@${userName} mention copied to clipboard! Paste it in chat.`, {type: "success"});
                    } else {
                        BdApi.UI.showToast("Could not copy mention. Try again.", {type: "error"});
                    }
                    clearPillContainer();
                };
                return;
            }
            let idx = step < steps - users.length ? (current++ % users.length) : ((chosen + step) % users.length);
            setDisplay(idx, true);
            let delay = baseDelay + ((maxDelay - baseDelay) * Math.pow(step / steps, 2));
            setTimeout(() => roll(step + 1), delay);
        }
        roll(0);
    }

    function makeContextMenu(toolbar) {
        return ContextMenu.buildMenu([
            {
                label: "Roulette Speed",
                type: "submenu",
                items: Object.keys(speedMap).map(speed => ({
                    type: "radio",
                    checked: settings.animationSpeed === speed,
                    label: speed[0].toUpperCase()+speed.slice(1),
                    action: () => { settings.animationSpeed = speed; saveSettings(); }
                }))
            },
            {
                label: "Volume",
                type: "submenu",
                items: [0,0.2,0.4,0.6,0.8,1].map(v => ({
                    type: "radio",
                    checked: Math.abs(settings.soundVolume - v) < 0.01,
                    label: Math.round(v*100) + "%",
                    action: () => { settings.soundVolume = v; saveSettings(); }
                }))
            },
            {
                label: "Enable Sound",
                type: "toggle",
                checked: settings.enableSound,
                action: () => { settings.enableSound = !settings.enableSound; saveSettings(); }
            },
            {
                label: "Show Avatars",
                type: "toggle",
                checked: settings.showAvatar,
                action: () => { settings.showAvatar = !settings.showAvatar; saveSettings(); }
            },
            {
                label: "Pill Position",
                type: "submenu",
                items: [
                    {label:"Top", type:"radio", checked:settings.pillPosition==="top", action:()=>{settings.pillPosition="top";saveSettings();}},
                    {label:"Middle (above chat box)", type:"radio", checked:settings.pillPosition==="middle", action:()=>{settings.pillPosition="middle";saveSettings();}},
                    {label:"Bottom", type:"radio", checked:settings.pillPosition==="bottom", action:()=>{settings.pillPosition="bottom";saveSettings();}}
                ]
            },
            {
                label: "Pill Size",
                type: "submenu",
                items: [
                    {label:"Small", type:"radio", checked:settings.pillHeight===36, action:()=>{settings.pillHeight=36;settings.pillFontSize=15;settings.pillWidth=180;saveSettings();}},
                    {label:"Medium", type:"radio", checked:settings.pillHeight===52, action:()=>{settings.pillHeight=52;settings.pillFontSize=20;settings.pillWidth=270;saveSettings();}},
                    {label:"Large", type:"radio", checked:settings.pillHeight===68, action:()=>{settings.pillHeight=68;settings.pillFontSize=28;settings.pillWidth=360;saveSettings();}}
                ]
            }
        ]);
    }

    function addToolbarButtonTo(toolbar) {
        if (toolbar.querySelector("#" + buttonId)) return;
        const btn = document.createElement("button");
        btn.id = buttonId;
        btn.type = "button";
        btn.className = "button__201d5 lookBlank__201d5 colorBrand__201d5 grow__201d5";
        btn.style.background = "transparent";
        btn.style.border = "none";
        btn.style.borderRadius = "6px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.width = "40px";
        btn.style.height = "40px";
        btn.style.cursor = "pointer";
        btn.style.margin = "0 2px";
        btn.title = "Mention someone randomly (roulette!)";
        btn.innerHTML = `
<svg width="32" height="32" viewBox="0 0 32 32" style="opacity:0.85;">
  <circle cx="16" cy="16" r="14" fill="none"/>
  <text x="16" y="23" text-anchor="middle" font-size="24" fill="#fff" font-family="gg sans,Segoe UI,sans-serif" opacity="1" font-weight="bold" style="user-select:none;">@</text>
</svg>`;

        btn.onmouseenter = () => { btn.style.background = "var(--background-modifier-hover, #393c41)"; };
        btn.onmouseleave = () => { btn.style.background = "transparent"; };
        btn.onclick = () => showRoulette(toolbar);
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            ContextMenu.open(e.clientX, e.clientY, makeContextMenu(toolbar));
        };
        toolbar.insertBefore(btn, toolbar.firstChild);
    }

    function addToolbarButtons() {
        document.querySelectorAll(".buttons__74017").forEach(toolbar => addToolbarButtonTo(toolbar));
    }

    function startObservingToolbar() {
        addToolbarButtons();
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.classList?.contains("buttons__74017")) {
                            addToolbarButtonTo(node);
                        } else {
                            node.querySelectorAll?.(".buttons__74017").forEach(toolbar => addToolbarButtonTo(toolbar));
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    function stopObservingToolbar() {
        if (observer) observer.disconnect();
        observer = null;
        document.querySelectorAll("#" + buttonId).forEach(btn => btn.remove());
        clearPillContainer();
    }
    function showRoulette(toolbar) {
        clearPillContainer();
        const channelId = SelectedChannelStore.getChannelId();
        const channel = ChannelStore.getChannel(channelId);
        const guildId = channel && channel.guild_id ? channel.guild_id : null;
        const users = getEligibleUsers();
        if (!users.length) {
            BdApi.UI.showToast("No users available to mention!", { type: "error" });
            return;
        }
        showRoulettePill(users, toolbar, () => {}, guildId);
    }

    // --- Settings Panel ---
    function getSettingsPanel() {
        const styleId = "atsomeone-settings-style";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.innerText = `
.atsomeone-modern-panel {
    font-family: var(--font-primary);
    color: var(--header-primary);
    background: transparent;
    max-width: 540px;
}
.atsomeone-modern-panel h2 {
    font-size: 1.25em;
    font-weight: 700;
    margin: 26px 0 8px 0;
    letter-spacing: 0.01em;
}
.atsomeone-modern-panel label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-size: 1em;
    font-weight: 500;
}
.atsomeone-modern-panel .ats-row {
    display: flex; align-items: center; gap: 16px; margin-bottom: 12px;
}
.atsomeone-modern-panel select, .atsomeone-modern-panel input[type="range"] {
    background: var(--background-tertiary);
    border: none;
    border-radius: 5px;
    color: var(--header-primary);
    padding: 6px 12px;
    font-size: 1em;
}
.atsomeone-modern-panel input[type="range"] {
    flex:1 1 100px; margin-right:10px;
}
.atsomeone-modern-panel .ats-toggle {
    width: 40px; height: 20px; background: var(--background-tertiary);
    border-radius: 12px; position: relative; cursor: pointer; transition: background 0.15s;
    display: inline-block; margin-right: 6px;
}
.atsomeone-modern-panel .ats-toggle.checked { background: var(--brand-experiment); }
.atsomeone-modern-panel .ats-toggle .ats-knob {
    position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    background: #fff; border-radius: 50%; transition: left 0.15s;
}
.atsomeone-modern-panel .ats-toggle.checked .ats-knob { left: 22px; }
.atsomeone-modern-panel .ats-pill-preview {
    margin: 32px 0 0 0; display: flex; justify-content: center;
}
.atsomeone-modern-panel .ats-pill {
    display: flex; align-items: center; gap: 10px;
    background: var(--background-floating, #232428);
    border-radius: 999px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.20);
    padding: 7px 22px;
    color: var(--header-primary);
    font-weight: bold;
    font-size: 18px;
    border: 2px solid var(--brand-experiment);
    min-width: 180px; min-height: 36px;
    justify-content: center;
    pointer-events: none;
    user-select: none;
}
.atsomeone-modern-panel .ats-pill img {
    width: 32px; height: 32px; border-radius: 50%; background: #24263a; border: 2px solid #aaa;
}
.atsomeone-modern-panel .ats-pill .ats-pill-username {
    font-size: 18px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.atsomeone-modern-panel .ats-pill .ats-pill-status {
    font-size: 13px; color: var(--text-muted); margin-left: 10px; font-weight: 400;
}
.atsomeone-modern-panel .ats-sound-test-btn {
    background: var(--brand-experiment);
    color: #fff !important;
    border: none;
    border-radius: 6px;
    padding: 6px 20px;
    font-size: 1em;
    font-weight: 600;
    margin-left: 14px;
    cursor: pointer;
    transition: background .15s;
}
.atsomeone-modern-panel .ats-sound-test-btn:hover {
    background: var(--brand-experiment-560);
}
            `;
            document.head.appendChild(style);
        }
        function makeToggle(checked, onChange) {
            const toggle = document.createElement("div");
            toggle.className = "ats-toggle" + (checked ? " checked" : "");
            const knob = document.createElement("div");
            knob.className = "ats-knob";
            toggle.appendChild(knob);
            toggle.onclick = () => {
                toggle.classList.toggle("checked");
                onChange(!checked);
            };
            return toggle;
        }
        function pillPreview() {
            const pill = document.createElement("div");
            pill.className = "ats-pill";
            if (settings.showAvatar) {
                const img = document.createElement("img");
                img.src = "https://cdn.discordapp.com/embed/avatars/4.png";
                pill.appendChild(img);
            }
            const name = document.createElement("span");
            name.className = "ats-pill-username";
            name.innerText = "🎲 votzybo";
            pill.appendChild(name);
            const status = document.createElement("span");
            status.className = "ats-pill-status";
            status.innerText = "Rolling...";
            pill.appendChild(status);
            pill.style.fontSize = settings.pillFontSize + "px";
            pill.style.minWidth = settings.pillWidth + "px";
            pill.style.minHeight = settings.pillHeight + "px";
            pill.querySelector("img") && (pill.querySelector("img").style.width = (settings.pillHeight-8) + "px");
            pill.querySelector("img") && (pill.querySelector("img").style.height = (settings.pillHeight-8) + "px");
            return pill;
        }
        const panel = document.createElement("div");
        panel.className = "atsomeone-modern-panel";
        panel.innerHTML = `
<h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em;margin-bottom:10px;">AtSomeone Plugin</h1>
<div style="color:var(--text-muted);margin-bottom:16px;">
    Adds a floating, animated @someone roulette above your chat. Sleek, modern, and fully customizable.
</div>
<h2>Animation</h2>
<div class="ats-row">
    <label for="atsomeone-speed">Speed</label>
    <select id="atsomeone-speed">
        <option value="instant">Instant</option>
        <option value="short">Short</option>
        <option value="medium">Medium</option>
        <option value="long">Long</option>
        <option value="extra long">Extra Long</option>
    </select>
</div>
<div class="ats-row">
    <label for="atsomeone-pos">Pill Position</label>
    <select id="atsomeone-pos">
        <option value="top">Top</option>
        <option value="middle">Middle (above chat box)</option>
        <option value="bottom">Bottom</option>
    </select>
</div>
<div class="ats-row">
    <label for="atsomeone-size">Pill Size</label>
    <select id="atsomeone-size">
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
    </select>
</div>
<h2>Sound</h2>
<div class="ats-row">
    <label>Enable Sound</label>
</div>
<div class="ats-row" id="atsomeone-sound-toggle-row"></div>
<div class="ats-row">
    <label for="atsomeone-volume">Volume</label>
    <input type="range" min="0" max="1" step="0.01" id="atsomeone-volume" style="width:120px;">
    <span id="atsomeone-volume-num">${Math.round(settings.soundVolume*100)}</span>%
    <button class="ats-sound-test-btn" id="atsomeone-sound-test">Test Sound & Animation</button>
</div>
<h2>Pill UI</h2>
<div class="ats-row">
    <label>Show Avatars</label>
</div>
<div class="ats-row" id="atsomeone-avatar-toggle-row"></div>
<div class="ats-pill-preview"></div>
`;
        panel.querySelector("#atsomeone-speed").value = settings.animationSpeed;
        panel.querySelector("#atsomeone-pos").value = settings.pillPosition;
        panel.querySelector("#atsomeone-size").value =
            settings.pillHeight === 36 ? "small" :
            settings.pillHeight === 52 ? "medium" : "large";
        panel.querySelector("#atsomeone-volume").value = settings.soundVolume;
        const soundToggle = makeToggle(settings.enableSound, checked => {
            settings.enableSound = checked;
            saveSettings();
        });
        panel.querySelector("#atsomeone-sound-toggle-row").appendChild(soundToggle);
        const avatarToggle = makeToggle(settings.showAvatar, checked => {
            settings.showAvatar = checked;
            saveSettings();
            panel.querySelector(".ats-pill-preview").innerHTML = "";
            panel.querySelector(".ats-pill-preview").appendChild(pillPreview());
        });
        panel.querySelector("#atsomeone-avatar-toggle-row").appendChild(avatarToggle);
        panel.querySelector("#atsomeone-speed").onchange = e => {
            settings.animationSpeed = e.target.value;
            saveSettings();
        };
        panel.querySelector("#atsomeone-volume").oninput = e => {
            settings.soundVolume = parseFloat(e.target.value);
            saveSettings();
            panel.querySelector("#atsomeone-volume-num").innerText = Math.round(settings.soundVolume*100);
        };
        panel.querySelector("#atsomeone-sound-test").onclick = () => {
            // Play spin sound on every cycle in settings test as well!
            const previewDiv = panel.querySelector(".ats-pill-preview");
            previewDiv.innerHTML = "";
            const pill = pillPreview();
            previewDiv.appendChild(pill);
            const speed = speedMap[settings.animationSpeed] || speedMap.medium;
            let steps = speed.steps, baseDelay = speed.baseDelay, maxDelay = speed.maxDelay;
            const testNames = [
                "votzybo", "your mom", "Fredrick", "Hans Ferdinand", "You Lose", "Otzdarva"
            ];
            let chosen = 4, current = 0;
            function setDisplay(idx, rollingState) {
                if (pill.querySelector("img"))
                    pill.querySelector("img").src = "https://cdn.discordapp.com/embed/avatars/" + (idx % 5) + ".png";
                pill.querySelector(".ats-pill-username").innerText = (rollingState ? "🎲 " : "🎯 ") + testNames[idx];
                pill.querySelector(".ats-pill-status").innerText = rollingState ? "Rolling..." : "You Lose!";
                pill.style.border = `2.5px solid ${rollingState ? "var(--brand-experiment)" : "var(--red-400,#ed4245)"}`;
            }
            let stopped = false;
            function roll(step) {
                if (stopped) return;
                playSound("spin");
                if (step >= steps) {
                    setDisplay(chosen, false);
                    setTimeout(() => playSound("stop"), 100);
                    setTimeout(() => {}, 1000);
                    return;
                }
                let idx = step < steps - testNames.length ? (current++ % testNames.length) : ((chosen + step) % testNames.length);
                setDisplay(idx, true);
                let delay = baseDelay + ((maxDelay - baseDelay) * Math.pow(step / steps, 2));
                setTimeout(() => roll(step + 1), delay);
            }
            roll(0);
            pill.onclick = () => { stopped = true; previewDiv.innerHTML = ""; previewDiv.appendChild(pillPreview()); };
        };
        panel.querySelector("#atsomeone-pos").onchange = e => {
            settings.pillPosition = e.target.value;
            saveSettings();
        };
        panel.querySelector("#atsomeone-size").onchange = e => {
            if (e.target.value === "small") { settings.pillHeight=36;settings.pillFontSize=15;settings.pillWidth=180; }
            if (e.target.value === "medium") { settings.pillHeight=52;settings.pillFontSize=20;settings.pillWidth=270; }
            if (e.target.value === "large") { settings.pillHeight=68;settings.pillFontSize=28;settings.pillWidth=360; }
            saveSettings();
            panel.querySelector(".ats-pill-preview").innerHTML = "";
            panel.querySelector(".ats-pill-preview").appendChild(pillPreview());
        };
        panel.querySelector(".ats-pill-preview").appendChild(pillPreview());
        return panel;
    }

    return class AtSomeone {
        getName() { return "AtSomeone"; }
        getAuthor() { return "votzybo"; }
        getDescription() { return "Adds an @someone button, with a floating customizable roulette animation above the chat bar cycling pingable users."; }
        getVersion() { return "10.8.3"; }

        load() { loadSettings(); }
        start() { loadSettings(); startObservingToolbar(); }
        stop() { stopObservingToolbar(); }
        getSettingsPanel() { return getSettingsPanel(); }
    };
})();
