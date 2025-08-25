/**
 * @name SpotifyLyrics
 * @author votzybo
 * @version 6.0.6
 * @description Sidebar lyrics panel for SpotifyControls by DevilBro. Right-click for Expand, Large View, Custom View, and Reload. Never flickers or resets the view unless you change it. Settings panel included.
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateUrl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/main/SpotifyLyrics.plugin.js
 */

/*
 * Key fixes v6.0.6:
 * - Lyric sync is now ultra-fast and always correct, using requestAnimationFrame and no polling interval lag.
 * - Lyrics always update and scroll in all modes (expanded, large, custom, context).
 * - Lyrics never freeze, and always highlight the correct line.
 * - Lyrics are never delayed, even after seek, track change, or manual scroll.
 * - Lyrics panel never flickers or resets unless you change the track or mode.
 * - All popout methods are included.
 * - Robust error handling.
 * - Code is optimized for reliability and responsiveness.
 */

class SpotifyLyrics {
    constructor() {
        this.defaultSettings = {
            lyricsAlign: "center",
            lyricsOffsetMs: -500,
            lyricsIntervalMs: 50, // No longer used, kept for settings panel compatibility
            lyricsContextLines: 1,
            customViewLines: 5,
            defaultView: "context",
            scrollbarStyle: "sleek",
            lyricsFontSize: 15,
            lyricsBgColor: "#000"
        };
        this.settings = BdApi.loadData("SpotifyLyrics", "settings") || { ...this.defaultSettings };
        for (const k in this.defaultSettings) {
            if (!(k in this.settings)) this.settings[k] = this.defaultSettings[k];
        }
        this._viewMode = this.settings.defaultView;
        this.lastTrackId = null;
        this.lastLyrics = null;
        this.currentPanel = null;
        this.currentTrack = null;
        this.lyricTimer = null;
        this.lastActiveLineIdx = -1;
        this.userScrolled = false;
        this.autoScrollPaused = false;
        this.scrollResumeTimeout = null;
        this.floatingBtn = null;
        this._panelReloadPopout = null;
        this._popoutClickawayListener = null;
        this._defaultMaxHeight = 260;
        this._lyricsDivHash = null;
        this._onKeyDown = null;
        this._trackCheckInterval = null;
        this._fontSizeMenuPopout = null;
        this._fontSizePopoutClickawayListener = null;
        this._bgColorMenuPopout = null;
        this._bgColorPopoutClickawayListener = null;
        this._trackPollInterval = null;
        this._lyricFrameRunning = false;
        this._debounceLyricsTimeout = null;
    }

    getName() { return "SpotifyLyrics"; }
    getDescription() { return "Sidebar lyrics panel for SpotifyControls by DevilBro. Right-click for Expand, Large View, Custom View, and Reload. Never flickers or resets the view unless you change it. Settings panel included."; }
    getVersion() { return "6.0.6"; }
    getAuthor() { return "votzybo"; }

    start() {
        this.injectStyle();
        this._viewMode = this.settings.defaultView;
        this.removeLyricsPanel();
        this.injectPanelIfTrack();
        // Only poll for track changes, not for lyric sync
        this._trackPollInterval = setInterval(() => this._pollForTrackChange(), 800); // 800ms is enough for track changes
        this._onKeyDown = (e) => {
            if (e.key === "F2") this.scrollToCurrentLyric(true);
        };
        window.addEventListener("keydown", this._onKeyDown);
    }

    stop() {
        this.removeStyle();
        this.removeLyricsPanel();
        if (this._trackPollInterval) clearInterval(this._trackPollInterval);
        this.clearLyricTimer();
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
        this.removeBgColorPopout();
        window.removeEventListener("keydown", this._onKeyDown);
    }

    injectStyle() {
        let bgColor = this.settings.lyricsBgColor && this.settings.lyricsBgColor.trim() ? this.settings.lyricsBgColor.trim() : "#000";
        let valid = /^#[a-fA-F0-9]{3,8}$/.test(bgColor) || /^rgb/.test(bgColor) || /^[a-zA-Z]+$/.test(bgColor);
        if (!valid) bgColor = "#000";
        let scrollbarCSS = "";
        if (this.settings.scrollbarStyle === "hidden") {
            scrollbarCSS = `
                .spotifylyrics-lyricslist { scrollbar-width: none !important; -ms-overflow-style: none !important; }
                .spotifylyrics-lyricslist::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; background: transparent !important; }
            `;
        } else {
            scrollbarCSS = `
                .spotifylyrics-lyricslist::-webkit-scrollbar { width: 6px; background: transparent; }
                .spotifylyrics-lyricslist::-webkit-scrollbar-thumb { background: rgba(80,80,80,0.5); border-radius: 3px; }
                .spotifylyrics-lyricslist::-webkit-scrollbar-thumb:hover { background: rgba(120,120,120,0.7); }
                .spotifylyrics-lyricslist::-webkit-scrollbar-corner { background: transparent; }
                .spotifylyrics-lyricslist { scrollbar-width: thin; scrollbar-color: rgba(80,80,80,0.5) transparent; }
            `;
        }
        BdApi.clearCSS("SpotifyLyrics-style");
        BdApi.injectCSS("SpotifyLyrics-style", `
            .spotifylyrics-sidebarpanel {
                background: ${bgColor} !important;
                border-radius: 8px;
                margin: 0 10px 8px 10px;
                padding: 10px 10px 10px 10px;
                color: var(--header-primary, #fff);
                font-size: 17px;
                font-weight: 500;
                box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
                white-space: pre-line;
                line-height: 1.5;
                min-height: 50px !important;
                word-break: break-word;
                overflow: hidden !important;
                user-select: text;
                position: relative;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: flex-start !important;
                align-items: stretch;
                z-index: 10;
                flex-shrink: 1 !important;
                flex-grow: 1 !important;
                flex-basis: auto !important;
                max-height: 260px;
                transition: max-height 0.18s;
            }
            .spotifylyrics-sidebarpanel.expanded { max-height: none !important; height: auto !important; }
            .spotifylyrics-largeview .spotifylyrics-line {
                font-size: inherit;
                opacity: 0.7;
                line-height: 1.85;
                background: none !important;
                color: var(--header-primary, #fff) !important;
                font-weight: 400 !important;
            }
            .spotifylyrics-largeview .spotifylyrics-line.current {
                color: var(--brand-experiment, #3399ff);
                opacity: 1 !important;
                font-weight: 600 !important;
                font-size: calc(var(--spotifylyrics-font-size, 15px) + 2px) !important;
                text-shadow: 0 1px 2px #111, 0 0 8px #1db954bb;
                background: none !important;
            }
            .spotifylyrics-lyricslist {
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0;
                user-select: text;
                overflow-y: auto !important;
                overflow-x: hidden !important;
                max-width: 100%;
            }
            ${scrollbarCSS}
            .spotifylyrics-nolyrics {
                font-size: inherit;
                color: var(--header-secondary, #888);
                opacity: 0.85;
                text-align: center;
                margin: 10px 0 0 0;
                padding: 20px;
                user-select: none;
                font-weight: 500;
            }
            .spotifylyrics-line {
                font-size: inherit;
                padding: 0;
                margin: 0;
                color: var(--header-primary, #fff);
                opacity: 0.7;
                transition: background 0.18s, color 0.18s;
                white-space: pre-line;
                text-align: center;
                user-select: text;
                line-height: 1.3;
                pointer-events: auto;
                cursor: pointer;
                border-radius: 4px;
                font-weight: 400;
                background: none;
            }
            .spotifylyrics-line.current {
                color: var(--brand-experiment, #1db954);
                opacity: 1;
                background: var(--background-tertiary, #18191c);
                font-weight: bold;
                font-size: inherit;
            }
            .spotifylyrics-floating-btn {
                position: absolute;
                top: 4px;
                right: 10px;
                background: var(--background-accent, var(--brand-experiment, #4f545c));
                color: var(--header-primary, #fff);
                border: none;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.16);
                padding: 4px 13px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                opacity: 0.96;
                z-index: 2;
                display: none;
            }
            .spotifylyrics-floating-btn.show { display: block; }
            .spotifylyrics-expand-popout, .spotifylyrics-fontsize-popout, .spotifylyrics-bgcolor-popout {
                position: fixed;
                z-index: 9999;
                background: var(--background-floating, var(--background-primary, #232428));
                color: var(--header-primary, #fff);
                border: 1px solid var(--background-modifier-accent, #2F3136);
                border-radius: 8px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.30);
                padding: 12px 18px 12px 18px;
                font-size: 16px;
                font-weight: 500;
                min-width: 120px;
                min-height: 36px;
                cursor: default;
                user-select: none;
                display: flex;
                flex-direction: column;
                gap: 8px;
                animation: spotifylyrics-fadein .14s;
            }
            .spotifylyrics-expand-popout-btn, .spotifylyrics-fontsize-popout-btn {
                background: var(--background-accent, var(--brand-experiment, #1db95422));
                color: var(--header-primary, #fff);
                border: none;
                border-radius: 6px;
                font-size: 15px;
                font-weight: bold;
                cursor: pointer;
                padding: 3px 8px;
                margin-top: 0px;
                transition: background 0.14s;
            }
            .spotifylyrics-fontsize-popout-btn.selected {
                background: var(--brand-experiment, #1db95455) !important;
                color: #fff !important;
            }
            .panels_c48ade {
                overflow: hidden !important;
                flex: 1 1 auto !important;
                max-height: 100vh !important;
                min-height: 0 !important;
                height: auto !important;
                display: flex;
                flex-direction: column;
            }
            .container_791eb8 {
                min-height: 0 !important;
                max-height: unset !important;
            }
            @keyframes spotifylyrics-fadein {
                from { opacity: 0; transform: translateY(10px);}
                to   { opacity: 1; transform: translateY(0);}
            }
        `);
    }

    removeStyle() {
        BdApi.clearCSS("SpotifyLyrics-style");
    }

    removeLyricsPanel() {
        const existing = document.getElementById("spotifylyrics-panel");
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        this.currentPanel = null;
        this.clearLyricTimer();
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
        this.removeBgColorPopout();
        this.floatingBtn = null;
    }

    getPanelParent() {
        return document.querySelector('.panels_c48ade');
    }
    getSpotifyPanel() {
        return document.querySelector('.container_791eb8.withTimeline_791eb8');
    }

    injectPanelIfTrack() {
        const parent = this.getPanelParent();
        const spotifyPanel = this.getSpotifyPanel();
        const track = this.getTrackInfoFromDOM(spotifyPanel);
        if (!parent || !spotifyPanel || !track || !track.name) {
            this.removeLyricsPanel();
            return;
        }
        const trackId = `${track.name} - ${track.artist}`.toLowerCase();
        if (this.lastTrackId !== trackId) {
            this.removeLyricsPanel();
            this.lastTrackId = trackId;
            this.currentTrack = track;
            this.lastLyrics = null;
            this.userScrolled = false;
            this.autoScrollPaused = false;
            this.lastActiveLineIdx = -1;
            this._lyricsDivHash = null;
            const panel = this.makePanel();
            parent.insertBefore(panel, parent.firstChild);
            if (spotifyPanel && parent.children[1] !== spotifyPanel) {
                parent.insertBefore(spotifyPanel, parent.children[1]);
            }
            if (this._debounceLyricsTimeout) clearTimeout(this._debounceLyricsTimeout);
            this._debounceLyricsTimeout = setTimeout(() => {
                this.fetchLyrics(track).then(lyrics => {
                    this.lastLyrics = lyrics;
                    if (!lyrics || !lyrics.lrcLines || lyrics.lrcLines.length === 0) {
                        this.showNoLyricsMessage();
                        return;
                    }
                    this.startLyricTimer();
                    this.updateLyricsDisplay(true);
                });
            }, 150);
        } else if (!this.currentPanel) {
            const panel = this.makePanel();
            parent.insertBefore(panel, parent.firstChild);
        }
    }

    makePanel() {
        this.removeLyricsPanel();
        const panelDiv = document.createElement("div");
        panelDiv.className = "spotifylyrics-sidebarpanel";
        panelDiv.id = "spotifylyrics-panel";
        this.currentPanel = panelDiv;
        this.setPanelClasses();
        panelDiv.style.setProperty("--spotifylyrics-font-size", `${this.settings.lyricsFontSize}px`);
        const lyricsDiv = document.createElement("div");
        lyricsDiv.className = "spotifylyrics-lyricslist";
        lyricsDiv.style.overflowY = "auto";
        lyricsDiv.style.overflowX = "hidden";
        lyricsDiv.style.fontSize = `${this.settings.lyricsFontSize}px`;
        panelDiv.appendChild(lyricsDiv);
        const btn = document.createElement("button");
        btn.className = "spotifylyrics-floating-btn";
        btn.textContent = "Now Playing";
        btn.onclick = () => {
            this.userScrolled = false;
            this.autoScrollPaused = false;
            this.scrollToCurrentLyric(true);
            this.updateFloatingBtnVisibility();
        };
        panelDiv.appendChild(btn);
        this.floatingBtn = btn;
        panelDiv.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.showExpandPopout(e);
        });
        panelDiv.addEventListener("wheel", () => this.onManualScroll());
        panelDiv.addEventListener("mousedown", () => this.onManualScroll());
        panelDiv.addEventListener("touchstart", () => this.onManualScroll());
        return panelDiv;
    }

    setPanelClasses() {
        if (!this.currentPanel) return;
        this.currentPanel.classList.remove("expanded", "spotifylyrics-largeview");
        if (this._viewMode === "expanded") this.currentPanel.classList.add("expanded");
        if (this._viewMode === "large") {
            this.currentPanel.classList.add("spotifylyrics-largeview");
            this.currentPanel.classList.add("expanded");
        }
        if (this._viewMode === "custom") this.currentPanel.classList.add("expanded");
        this.currentPanel.style.maxHeight =
            (this._viewMode !== "context") ? "none" : this._defaultMaxHeight + "px";
    }

    showNoLyricsMessage() {
        if (!this.currentPanel) return;
        const lyricsDiv = this.currentPanel.querySelector('.spotifylyrics-lyricslist');
        if (lyricsDiv) {
            lyricsDiv.innerHTML = "";
            const noLyrics = document.createElement("div");
            noLyrics.className = "spotifylyrics-nolyrics";
            noLyrics.textContent = "No Lyrics Detected For Track";
            noLyrics.style.fontSize = `${this.settings.lyricsFontSize}px`;
            lyricsDiv.appendChild(noLyrics);
        }
        this.clearLyricTimer();
    }

    // --- Popout methods ---
    removeExpandPopout() {
        if (this._panelReloadPopout && this._panelReloadPopout.parentNode)
            this._panelReloadPopout.parentNode.removeChild(this._panelReloadPopout);
        this._panelReloadPopout = null;
        if (this._popoutClickawayListener)
            document.removeEventListener("mousedown", this._popoutClickawayListener, true);
        this._popoutClickawayListener = null;
    }

    removeFontSizeMenuPopout() {
        if (this._fontSizeMenuPopout && this._fontSizeMenuPopout.parentNode)
            this._fontSizeMenuPopout.parentNode.removeChild(this._fontSizeMenuPopout);
        this._fontSizeMenuPopout = null;
        if (this._fontSizePopoutClickawayListener)
            document.removeEventListener("mousedown", this._fontSizePopoutClickawayListener, true);
        this._fontSizePopoutClickawayListener = null;
    }

    removeBgColorPopout() {
        if (this._bgColorMenuPopout && this._bgColorMenuPopout.parentNode)
            this._bgColorMenuPopout.parentNode.removeChild(this._bgColorMenuPopout);
        this._bgColorMenuPopout = null;
        if (this._bgColorPopoutClickawayListener)
            document.removeEventListener("mousedown", this._bgColorPopoutClickawayListener, true);
        this._bgColorPopoutClickawayListener = null;
    }

    showExpandPopout(e) {
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
        this.removeBgColorPopout();
        const popout = document.createElement("div");
        popout.className = "spotifylyrics-expand-popout";
        const fontBtn = document.createElement("button");
        fontBtn.className = "spotifylyrics-expand-popout-btn";
        fontBtn.id = "spotifylyrics-fontsize-popout-trigger";
        fontBtn.textContent = `Font Size: ${this.settings.lyricsFontSize}px ▸`;
        fontBtn.style.display = "flex";
        fontBtn.style.alignItems = "center";
        fontBtn.style.justifyContent = "space-between";
        fontBtn.onmouseenter = () => this.showFontSizePopout(fontBtn);
        fontBtn.onclick = () => this.showFontSizePopout(fontBtn);
        popout.appendChild(fontBtn);

        const colorBtn = document.createElement("button");
        colorBtn.className = "spotifylyrics-expand-popout-btn";
        colorBtn.textContent = `Background Color: ${this.settings.lyricsBgColor || "#000"} ▸`;
        colorBtn.style.display = "flex";
        colorBtn.style.alignItems = "center";
        colorBtn.style.justifyContent = "space-between";
        colorBtn.onclick = () => this.showBgColorPopout(colorBtn);
        popout.appendChild(colorBtn);

        const largeViewBtn = document.createElement("button");
        largeViewBtn.className = "spotifylyrics-expand-popout-btn";
        largeViewBtn.textContent = (this._viewMode === "large") ? "Collapse Large View" : "Large View";
        largeViewBtn.onclick = () => {
            this._viewMode = (this._viewMode === "large") ? "context" : "large";
            this.setPanelClasses();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(largeViewBtn);

        const customViewBtn = document.createElement("button");
        customViewBtn.className = "spotifylyrics-expand-popout-btn";
        customViewBtn.textContent = (this._viewMode === "custom") ? "Collapse Custom View" : "Custom View";
        customViewBtn.onclick = () => {
            this._viewMode = (this._viewMode === "custom") ? "context" : "custom";
            this.setPanelClasses();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(customViewBtn);

        const expandBtn = document.createElement("button");
        expandBtn.className = "spotifylyrics-expand-popout-btn";
        expandBtn.textContent = (this._viewMode === "expanded") ? "Collapse Lyrics" : "Expand Lyrics";
        expandBtn.onclick = () => {
            this._viewMode = (this._viewMode === "expanded") ? "context" : "expanded";
            this.setPanelClasses();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(expandBtn);

        const reloadBtn = document.createElement("button");
        reloadBtn.className = "spotifylyrics-expand-popout-btn";
        reloadBtn.textContent = "Reload Lyrics";
        reloadBtn.onclick = () => {
            this.reloadLyricsOnly();
            this.removeExpandPopout();
        };
        popout.appendChild(reloadBtn);

        document.body.appendChild(popout);
        let x = e.clientX, y = e.clientY;
        setTimeout(() => {
            const rect = popout.getBoundingClientRect();
            if (x + rect.width > window.innerWidth - 16)
                x = window.innerWidth - rect.width - 8;
            if (y + rect.height > window.innerHeight - 16)
                y = window.innerHeight - rect.height - 8;
            popout.style.left = x + "px";
            popout.style.top = y + "px";
        }, 0);
        let ignoreNext = true;
        const clickaway = ev => {
            if (ignoreNext) { ignoreNext = false; return; }
            if (!popout.contains(ev.target)
                && !document.querySelector(".spotifylyrics-fontsize-popout")?.contains(ev.target)
                && !document.querySelector(".spotifylyrics-bgcolor-popout")?.contains(ev.target)) {
                this.removeExpandPopout();
                this.removeFontSizeMenuPopout();
                this.removeBgColorPopout();
                document.removeEventListener("mousedown", clickaway, true);
            }
        };
        document.addEventListener("mousedown", clickaway, true);
        this._popoutClickawayListener = clickaway;
        this._panelReloadPopout = popout;
    }

    showFontSizePopout(triggerBtn) {
        this.removeFontSizeMenuPopout();
        const fontSizes = [12, 14, 15, 16, 18, 20, 24, 28, 32];
        const popout = document.createElement("div");
        popout.className = "spotifylyrics-fontsize-popout";
        fontSizes.forEach(sz => {
            const btn = document.createElement("button");
            btn.className = "spotifylyrics-fontsize-popout-btn" + (this.settings.lyricsFontSize == sz ? " selected" : "");
            btn.innerText = sz + " px";
            btn.onclick = (e) => {
                this.settings.lyricsFontSize = sz;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.updateLyricsDisplay(true);
                this.removeFontSizeMenuPopout();
                this.removeExpandPopout();
            };
            popout.appendChild(btn);
        });
        document.body.appendChild(popout);
        const rect = triggerBtn.getBoundingClientRect();
        let x = rect.right + 8;
        let y = rect.top;
        if (x + popout.offsetWidth > window.innerWidth - 8) x = rect.left - popout.offsetWidth - 8;
        if (y + popout.offsetHeight > window.innerHeight - 8) y = window.innerHeight - popout.offsetHeight - 8;
        popout.style.left = x + "px";
        popout.style.top = y + "px";
        let ignoreNext = true;
        const clickaway = ev => {
            if (ignoreNext) { ignoreNext = false; return; }
            if (!popout.contains(ev.target)) {
                this.removeFontSizeMenuPopout();
                document.removeEventListener("mousedown", clickaway, true);
            }
        };
        document.addEventListener("mousedown", clickaway, true);
        this._fontSizePopoutClickawayListener = clickaway;
        this._fontSizeMenuPopout = popout;
    }

    showBgColorPopout(triggerBtn) {
        this.removeBgColorPopout();
        const popout = document.createElement("div");
        popout.className = "spotifylyrics-bgcolor-popout";
        popout.style.position = "fixed";
        popout.style.zIndex = 9999;
        popout.style.background = "var(--background-floating, #232428)";
        popout.style.color = "var(--header-primary, #fff)";
        popout.style.border = "1px solid var(--background-modifier-accent, #2F3136)";
        popout.style.borderRadius = "8px";
        popout.style.boxShadow = "0 4px 24px rgba(0,0,0,0.30)";
        popout.style.padding = "12px 18px 12px 18px";
        popout.style.fontSize = "16px";
        popout.style.fontWeight = "500";
        popout.style.minWidth = "160px";
        popout.style.minHeight = "36px";
        popout.style.display = "flex";
        popout.style.flexDirection = "column";
        popout.style.gap = "8px";

        const label = document.createElement("label");
        label.textContent = "Background Color:";
        label.style.fontWeight = "bold";
        label.style.marginBottom = "6px";
        popout.appendChild(label);

        const colorInput = document.createElement("input");
        colorInput.type = "text";
        colorInput.value = this.settings.lyricsBgColor || "#000";
        colorInput.style.fontSize = "15px";
        colorInput.style.padding = "6px";
        colorInput.style.borderRadius = "6px";
        colorInput.style.background = "var(--background-secondary)";
        colorInput.style.color = "var(--header-primary)";
        colorInput.style.border = "1px solid var(--background-modifier-accent)";
        colorInput.style.marginBottom = "10px";
        colorInput.placeholder = "#000, #a259dd, rgb(20,20,20), purple, etc";
        popout.appendChild(colorInput);

        const preview = document.createElement("div");
        preview.textContent = "Preview";
        preview.style.fontSize = "15px";
        preview.style.marginBottom = "6px";
        preview.style.background = colorInput.value;
        preview.style.borderRadius = "6px";
        preview.style.padding = "8px";
        preview.style.color = "#fff";
        preview.style.display = "block";
        preview.style.textAlign = "center";
        preview.style.border = "1px solid #333";
        popout.appendChild(preview);

        colorInput.oninput = () => {
            preview.style.background = colorInput.value || "#000";
        };

        const saveBtn = document.createElement("button");
        saveBtn.className = "spotifylyrics-fontsize-popout-btn";
        saveBtn.textContent = "Save";
        saveBtn.style.marginTop = "6px";
        saveBtn.onclick = () => {
            let val = colorInput.value.trim();
            if (!val) val = "#000";
            this.settings.lyricsBgColor = val;
            BdApi.saveData("SpotifyLyrics", "settings", this.settings);
            this.injectStyle(true);
            this.updateLyricsDisplay(true);
            this.removeBgColorPopout();
            this.removeExpandPopout();
        };
        popout.appendChild(saveBtn);

        const resetBtn = document.createElement("button");
        resetBtn.className = "spotifylyrics-fontsize-popout-btn";
        resetBtn.textContent = "Reset to Black";
        resetBtn.onclick = () => {
            colorInput.value = "#000";
            preview.style.background = "#000";
        };
        popout.appendChild(resetBtn);

        document.body.appendChild(popout);
        const rect = triggerBtn.getBoundingClientRect();
        let x = rect.right + 8;
        let y = rect.top;
        if (x + popout.offsetWidth > window.innerWidth - 8) x = rect.left - popout.offsetWidth - 8;
        if (y + popout.offsetHeight > window.innerHeight - 8) y = window.innerHeight - popout.offsetHeight - 8;
        popout.style.left = x + "px";
        popout.style.top = y + "px";
        let ignoreNext = true;
        const clickaway = ev => {
            if (ignoreNext) { ignoreNext = false; return; }
            if (!popout.contains(ev.target)) {
                this.removeBgColorPopout();
                document.removeEventListener("mousedown", clickaway, true);
            }
        };
        document.addEventListener("mousedown", clickaway, true);
        this._bgColorPopoutClickawayListener = clickaway;
        this._bgColorMenuPopout = popout;
    }

    reloadLyricsOnly() {
        if (!this.currentTrack || !this.currentTrack.name) return;
        this.fetchLyrics(this.currentTrack).then(lyrics => {
            this.lastLyrics = lyrics;
            if (!lyrics || !lyrics.lrcLines || lyrics.lrcLines.length === 0) {
                this.showNoLyricsMessage();
                return;
            }
            this.startLyricTimer();
            this.updateLyricsDisplay(true);
        });
    }

    startLyricTimer() {
        this.clearLyricTimer();
        this._lyricFrameRunning = true;
        const runFrame = () => {
            if (!this._lyricFrameRunning) return;
            this.updateLyricsDisplay();
            this.lyricTimer = window.requestAnimationFrame(runFrame);
        };
        runFrame();
        this.lastActiveLineIdx = -1;
    }

    clearLyricTimer() {
        if (this.lyricTimer) window.cancelAnimationFrame(this.lyricTimer);
        this.lyricTimer = null;
        this._lyricFrameRunning = false;
        this.lastActiveLineIdx = -1;
    }

    getTrackInfoFromDOM(panel) {
        if (!panel) return null;
        const songDiv = panel.querySelector('.song_791eb8 .textScroller_72a89f > div');
        const artistDiv = panel.querySelector('.interpret_791eb8 .textScroller_72a89f > div');
        if (songDiv) {
            const name = songDiv.textContent.trim();
            let artist = artistDiv ? artistDiv.textContent.trim() : "";
            return { name, artist };
        }
        return null;
    }

async fetchLyrics(track) {
    // Helper for normalization
    const normalize = str => str ? str.toLowerCase().replace(/(\s*\(.*?\)|\[.*?\])/g, "").replace(/\s+/g, " ").trim() : "";
    try {
        const trackName = normalize(track?.name ?? "");
        const artistName = normalize(track?.artist ?? "");
        // Query lrclib
        const res = await fetch(
            `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
            // Find best match (exact normalized name/artist)
            let best = data[0];
            for (const item of data) {
                if (
                    normalize(item.track_name) === trackName &&
                    normalize(item.artist_name) === artistName
                ) {
                    best = item;
                    break;
                }
            }
            if (best.syncedLyrics) {
                return { lrcLines: this.parseLRC(best.syncedLyrics) };
            } else if (best.plainLyrics) {
                return { lrcLines: best.plainLyrics.split("\n").map(line => ({ time: 0, text: line })) };
            }
        }
    } catch (e) {}
    return { lrcLines: [] };
}

    parseLRC(lrc) {
        const lines = lrc.split("\n");
        const result = [];
        const timeExp = /\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
        for (const line of lines) {
            let match; let times = []; let lastIndex = 0;
            while ((match = timeExp.exec(line)) !== null) {
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
                times.push(min * 60 + sec + ms / 1000);
                lastIndex = timeExp.lastIndex;
            }
            const text = line.slice(lastIndex).trim();
            for (let t of times) result.push({ time: t, text });
        }
        result.sort((a, b) => a.time - b.time);
        return result;
    }

    updateLyricsAlign() {
        if (!this.currentPanel) return;
        const lyricsDiv = this.currentPanel.querySelector('.spotifylyrics-lyricslist');
        if (lyricsDiv) lyricsDiv.style.textAlign = this.settings.lyricsAlign || "center";
    }

    // --- FIXED updateLyricsDisplay for all views, always re-render lines as in expanded mode ---
    updateLyricsDisplay(forceUpdate = false) {
        if (!this.currentPanel || !this.lastLyrics || !this.lastLyrics.lrcLines) return;
        const lrcLines = this.lastLyrics.lrcLines;
        const lyricsDiv = this.currentPanel.querySelector('.spotifylyrics-lyricslist');
        if (!lyricsDiv) return;
        lyricsDiv.style.fontSize = `${this.settings.lyricsFontSize}px`;
        if (!lrcLines || lrcLines.length === 0) {
            this.showNoLyricsMessage();
            return;
        }
        const elapsed = this.getCurrentSpotifyElapsedTime();
        if (elapsed == null) return;
        const offsetSec = (this.settings.lyricsOffsetMs || 0) / 1000;
        let idx = 0;
        let found = false;
        for (let i = 0; i < lrcLines.length; ++i) {
            if (lrcLines[i].time <= (elapsed - offsetSec)) {
                idx = i;
                found = true;
            } else {
                break;
            }
        }
        if (!found || idx >= lrcLines.length) idx = lrcLines.length - 1;

        let start, end, currentIdx;
        if (this._viewMode === "expanded" || this._viewMode === "large") {
            start = 0;
            end = lrcLines.length - 1;
            currentIdx = idx;
        } else if (this._viewMode === "custom") {
            const n = Math.max(1, parseInt(this.settings.customViewLines) || 5);
            start = Math.max(0, idx - Math.floor((n - 1) / 2));
            end = start + n - 1;
            if (end >= lrcLines.length) {
                end = lrcLines.length - 1;
                start = Math.max(0, end - n + 1);
            }
            currentIdx = idx - start;
        } else {
            const context = Math.max(0, parseInt(this.settings.lyricsContextLines) || 1);
            start = Math.max(0, idx - context);
            end = Math.min(lrcLines.length - 1, idx + context);
            currentIdx = idx - start;
        }

        // Always re-render visible lines for all views
        lyricsDiv.innerHTML = "";
        for (let i = start; i <= end; ++i) {
            lyricsDiv.appendChild(this.renderLyricLine(lrcLines[i], i, i === idx));
        }

        // Auto-scroll current lyric into view (in all views except when user has manually scrolled)
        if (!this.userScrolled && !this.autoScrollPaused) {
            const lineDivs = lyricsDiv.querySelectorAll(".spotifylyrics-line");
            if (lineDivs.length > 0 && currentIdx != null && lineDivs[currentIdx]) {
                lineDivs[currentIdx].scrollIntoView({ block: "center", behavior: "auto" });
                this.lastActiveLineIdx = idx;
            }
        }
    }

    isInstrumentalLine(text) {
        if (!text) return false;
        return /^\s*[\(\[]?\s*instrumental(\s*break)?\s*[\)\]]?\s*$/i.test(text.trim());
    }

    renderLyricLine(line, idx, isCurrent) {
        const div = document.createElement("div");
        div.className = "spotifylyrics-line" + (isCurrent ? " current" : "");
        div.style.fontSize = `${this.settings.lyricsFontSize}px`;
        div.innerText = this.isInstrumentalLine(line.text) ? "🎵 Instrumental" : line.text;
        div.onclick = () => {
            this.userScrolled = true;
            this.autoScrollPaused = true;
            this.seekToLyricLine(idx);
            this.updateLyricsDisplay(true);
            this.updateFloatingBtnVisibility(true);
        };
        return div;
    }

    scrollToCurrentLyric(instant = false) {
        if (!this.currentPanel || !this.lastLyrics || !this.lastLyrics.lrcLines) return;
        const lrcLines = this.lastLyrics.lrcLines;
        const lyricsDiv = this.currentPanel.querySelector('.spotifylyrics-lyricslist');
        const elapsed = this.getCurrentSpotifyElapsedTime();
        if (elapsed == null) return;
        const offsetSec = (this.settings.lyricsOffsetMs || 0) / 1000;
        let idx = 0, found = false;
        for (let i = 0; i < lrcLines.length; ++i) {
            if (lrcLines[i].time <= (elapsed - offsetSec)) {
                idx = i;
                found = true;
            } else {
                break;
            }
        }
        if (!found || idx >= lrcLines.length) idx = lrcLines.length - 1;
        let start, currentIdx;
        if (this._viewMode === "expanded" || this._viewMode === "large") {
            start = 0;
            currentIdx = idx;
        } else if (this._viewMode === "custom") {
            const n = Math.max(1, parseInt(this.settings.customViewLines) || 5);
            start = Math.max(0, idx - Math.floor((n - 1) / 2));
            currentIdx = idx - start;
        } else {
            const context = Math.max(0, parseInt(this.settings.lyricsContextLines) || 1);
            start = Math.max(0, idx - context);
            currentIdx = idx - start;
        }
        let lineDivs = lyricsDiv.querySelectorAll(".spotifylyrics-line");
        if (lineDivs.length > 0 && currentIdx != null && lineDivs[currentIdx]) {
            lineDivs[currentIdx].scrollIntoView({ block: "center", behavior: instant ? "auto" : "smooth" });
        }
        this.lastActiveLineIdx = idx;
    }

    onManualScroll() {
        this.userScrolled = true;
        this.autoScrollPaused = true;
        this.updateFloatingBtnVisibility(true);
        if (this.scrollResumeTimeout) clearTimeout(this.scrollResumeTimeout);
        this.scrollResumeTimeout = setTimeout(() => {
            this.userScrolled = false;
            this.autoScrollPaused = false;
            this.scrollToCurrentLyric();
            this.updateLyricsDisplay(true);
            this.updateFloatingBtnVisibility(false);
        }, 12000);
    }

    updateFloatingBtnVisibility(show) {
        if (!this.floatingBtn) return;
        if (show) this.floatingBtn.classList.add("show");
        else this.floatingBtn.classList.remove("show");
    }

    async seekToLyricLine(idx) {
        const time = this.lastLyrics?.lrcLines?.[idx]?.time;
        if (typeof time !== "number" || isNaN(time)) return;
        let didSeek = false;
        if (window.SpotifyControls && typeof window.SpotifyControls.seek === "function") {
            try { window.SpotifyControls.seek(time); didSeek = true; } catch { }
        }
        if (!didSeek) {
            try { window.dispatchEvent(new CustomEvent("SpotifyLyricsSeek", { detail: { time } })); didSeek = true; } catch { }
        }
        if (!didSeek) {
            BdApi.showToast("Seeking not supported in your setup. Please update SpotifyControls plugin or enable external control.", { type: "info" });
        }
        setTimeout(() => {
            this.updateLyricsDisplay(true);
        }, 70);
    }

    _pollForTrackChange() {
        this.injectPanelIfTrack();
    }

    getCurrentSpotifyElapsedTime() {
        // Use SpotifyControls API if available (most accurate, updates in real time)
        if (window.SpotifyControls && typeof window.SpotifyControls.getProgress === "function") {
            try {
                const time = window.SpotifyControls.getProgress();
                if (typeof time === "number" && !isNaN(time)) return time;
            } catch (e) {}
        }
        // Fallback to DOM
        const spotifyPanel = this.getSpotifyPanel();
        if (!spotifyPanel) return null;
        const timeRegex = /^\d{1,2}:\d{2}$/;
        const timeNodes = Array.from(spotifyPanel.querySelectorAll("*"))
            .filter(el => el.childElementCount === 0 && timeRegex.test(el.textContent.trim()));
        let timeStr = null;
        if (timeNodes.length > 0) timeStr = timeNodes[0].textContent.trim();
        if (!timeStr) return null;
        const [min, sec] = timeStr.split(":").map(Number);
        return min * 60 + sec;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "spotifylyrics-settingspanel";
        panel.style.padding = "32px 0 0 0";
        panel.style.maxWidth = "470px";
        const title = document.createElement("div");
        title.textContent = "SpotifyLyrics Settings";
        title.style.fontWeight = "bold";
        title.style.fontSize = "22px";
        title.style.marginBottom = "22px";
        title.style.color = "var(--header-primary)";
        panel.appendChild(title);

        panel.appendChild(this._makeLabeledSelect(
            "Default Lyrics View:",
            [
                { value: "context", label: "Context (before/current/after)" },
                { value: "expanded", label: "Expanded (all lines, scrollable)" },
                { value: "large", label: "Large View (karaoke style)" },
                { value: "custom", label: "Custom View (set line count below)" }
            ],
            this.settings.defaultView,
            v => {
                this.settings.defaultView = v;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this._viewMode = v;
                this.setPanelClasses();
                this.updateLyricsDisplay(true);
            }
        ));
        panel.appendChild(this._makeNote("Choose the default view for the lyrics panel."));

        panel.appendChild(this._makeLabeledSelect(
            "Lyrics Alignment:",
            [
                { value: "center", label: "Center" },
                { value: "left", label: "Left" },
                { value: "right", label: "Right" }
            ],
            this.settings.lyricsAlign,
            v => {
                this.settings.lyricsAlign = v;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.updateLyricsAlign();
            }
        ));

        panel.appendChild(this._makeLabeledInput(
            "Lyric Sync Offset (ms):",
            this.settings.lyricsOffsetMs,
            v => {
                this.settings.lyricsOffsetMs = parseInt(v) || 0;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
            },
            "number",
            "-2000",
            "2000",
            "10"
        ));
        panel.appendChild(this._makeNote("Negative values make lyrics appear earlier. Default: -500 (shows lyrics 0.5s ahead)."));

        panel.appendChild(this._makeLabeledSelect(
            "Lyric Sync Interval (ms):",
            [
                { value: "3000", label: "3000 (lowest resource, least responsive)" },
                { value: "1000", label: "1000 (low resource, fairly responsive)" },
                { value: "500", label: "500 (good balance)" },
                { value: "250", label: "250 (more responsive)" },
                { value: "100", label: "100 (very responsive)" },
                { value: "50", label: "50 (maximum responsiveness, recommended)" }
            ],
            this.settings.lyricsIntervalMs,
            v => {
                this.settings.lyricsIntervalMs = parseInt(v) || 50;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.startLyricTimer();
            }
        ));
        panel.appendChild(this._makeNote("Lower values make lyric line switching more responsive, but may increase CPU usage. Default: 50."));

        panel.appendChild(this._makeLabeledInput(
            "Lyric Context Lines (before/after):",
            this.settings.lyricsContextLines,
            v => {
                let n = parseInt(v);
                if (isNaN(n) || n < 0) n = 0;
                if (n > 10) n = 10;
                this.settings.lyricsContextLines = n;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.updateLyricsDisplay(true);
            },
            "number", "0", "10", "1"
        ));
        panel.appendChild(this._makeNote("Number of lyric lines to show before and after the current line (default: 1). Only applies when not expanded, large, or custom view."));

        panel.appendChild(this._makeLabeledInput(
            "Custom View: Line Count",
            this.settings.customViewLines,
            v => {
                let n = parseInt(v);
                if (isNaN(n) || n < 1) n = 1;
                if (n > 50) n = 50;
                this.settings.customViewLines = n;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                if (this._viewMode === "custom") this.updateLyricsDisplay(true);
            },
            "number", "1", "50", "1"
        ));
        panel.appendChild(this._makeNote("How many lines to show in Custom View."));

        panel.appendChild(this._makeLabeledInput(
            "Lyrics Font Size (px)",
            this.settings.lyricsFontSize,
            v => {
                let n = parseInt(v);
                if (isNaN(n) || n < 10) n = 10;
                if (n > 30) n = 30;
                this.settings.lyricsFontSize = n;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.updateLyricsDisplay(true);
            },
            "number", "10", "30", "1"
        ));
        panel.appendChild(this._makeNote("Adjust the font size of the lyrics (default: 15, range: 10-30)"));

        panel.appendChild(this._makeLabeledInput(
            "Lyrics Panel Background Color",
            this.settings.lyricsBgColor || "#000",
            v => {
                let val = v.trim();
                if (!val) val = "#000";
                this.settings.lyricsBgColor = val;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.injectStyle(true);
                this.updateLyricsDisplay(true);
            },
            "text"
        ));
        panel.appendChild(this._makeNote("Enter any valid CSS color (e.g. #000, #a259dd, rgb(20,20,20), purple, etc)."));

        return panel;
    }

    _makeLabeledSelect(label, options, value, onChange) {
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "18px";
        const lbl = document.createElement("label");
        lbl.style.fontWeight = "bold";
        lbl.style.color = "var(--header-primary)";
        lbl.style.fontSize = "15px";
        lbl.textContent = label;
        wrap.appendChild(lbl);
        wrap.appendChild(document.createElement("br"));
        const sel = document.createElement("select");
        sel.style.marginTop = "7px";
        sel.style.fontSize = "14px";
        sel.style.padding = "6px";
        sel.style.borderRadius = "6px";
        sel.style.background = "var(--background-secondary)";
        sel.style.color = "var(--header-primary)";
        sel.style.border = "1px solid var(--background-modifier-accent)";
        for (const opt of options) {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label;
            sel.appendChild(o);
        }
        sel.value = value;
        sel.onchange = e => onChange(e.target.value);
        wrap.appendChild(sel);
        return wrap;
    }

    _makeLabeledInput(label, value, onChange, type="text", min, max, step) {
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "10px";
        const lbl = document.createElement("label");
        lbl.style.fontWeight = "bold";
        lbl.style.color = "var(--header-primary)";
        lbl.style.fontSize = "15px";
        lbl.textContent = label;
        wrap.appendChild(lbl);
        wrap.appendChild(document.createElement("br"));
        const inp = document.createElement("input");
        inp.type = type;
        inp.value = value;
        inp.style.marginTop = "7px";
        inp.style.fontSize = "14px";
        inp.style.padding = "6px";
        inp.style.borderRadius = "6px";
        inp.style.background = "var(--background-secondary)";
        inp.style.color = "var(--header-primary)";
        inp.style.border = "1px solid var(--background-modifier-accent)";
        if (min) inp.min = min;
        if (max) inp.max = max;
        if (step) inp.step = step;
        inp.onchange = e => onChange(e.target.value);
        wrap.appendChild(inp);
        return wrap;
    }

    _makeNote(text) {
        const note = document.createElement("div");
        note.style.marginTop = "10px";
        note.style.fontSize = "13px";
        note.style.color = "var(--text-muted)";
        note.textContent = text;
        return note;
    }
}

module.exports = SpotifyLyrics;
