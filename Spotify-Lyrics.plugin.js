/**
 * @name SpotifyLyrics
 * @author votzybo
 * @version 5.7.7
 * @description SpotifyControls Plugin by DevilBro is needed!!! Sidebar lyrics panel: right-click for Expand (shows all lyrics), Large View (karaoke style), Custom View (set line count in settings), and Reload. You can set your default view in settings. Collapse returns to context lines (before/current/after). If a song is playing but no lyrics are found, displays 'No Lyrics Detected For Track'. Settings panel included. Now supports font size adjustment (right click) and music symbol for instrumental breaks.
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateUrl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/main/SpotifyLyrics.plugin.js
 */

class SpotifyLyrics {
    constructor() {
        this.defaultSettings = {
            lyricsAlign: "center",
            lyricsOffsetMs: -300,
            lyricsIntervalMs: 500,
            lyricsContextLines: 1,
            customViewLines: 5,
            defaultView: "context",
            scrollbarStyle: "sleek",
            lyricsFontSize: 15
        };
        this.settings = BdApi.loadData("SpotifyLyrics", "settings") || { ...this.defaultSettings };
        for (const k in this.defaultSettings) {
            if (!(k in this.settings)) this.settings[k] = this.defaultSettings[k];
        }
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
        this._lyricsExpanded = false;
        this._lyricsLargeView = false;
        this._lyricsCustomView = false;
        this._defaultMaxHeight = 260;
        this._lyricsDivHash = null;
        this._onKeyDown = null;
        this._trackCheckInterval = null;
        this._fontSizeMenuPopout = null;
        this._fontSizePopoutClickawayListener = null;
    }

    getName() { return "SpotifyLyrics"; }
    getDescription() { return "SpotifyControls Plugin by DevilBro is needed!!! Sidebar lyrics panel: right-click for Expand (shows all lyrics), Large View (karaoke style), Custom View (set line count in settings), and Reload. You can set your default view in settings. Collapse returns to context lines (before/current/after). If a song is playing but no lyrics are found, displays 'No Lyrics Detected For Track'. Settings panel included. Now supports font size adjustment (right click) and music symbol for instrumental breaks."; }
    getVersion() { return "5.7.7"; }
    getAuthor() { return "votzybo"; }

    start() {
        this.injectStyle();
        this.removeLyricsPanel();
        this.applyDefaultView();
        this.tryInject();
        this.interval = setInterval(() => this.tryInject(), 1500);
        this._trackCheckInterval = setInterval(() => this._pollForTrackChange(), 400);
        this._onKeyDown = (e) => {
            if (e.key === "F2") {
                this.scrollToCurrentLyric(true);
            }
        };
        window.addEventListener("keydown", this._onKeyDown);
    }

    stop() {
        this.removeStyle();
        this.removeLyricsPanel();
        clearInterval(this.interval);
        clearInterval(this._trackCheckInterval);
        this.clearLyricTimer();
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
        window.removeEventListener("keydown", this._onKeyDown);
    }

    injectStyle(force) {
        let scrollbarCSS = "";
        if (this.settings.scrollbarStyle === "hidden") {
            scrollbarCSS = `
                .spotifylyrics-lyricslist {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                }
                .spotifylyrics-lyricslist::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                    background: transparent !important;
                }
            `;
        } else {
            scrollbarCSS = `
                .spotifylyrics-lyricslist::-webkit-scrollbar {
                    width: 6px;
                    background: transparent;
                }
                .spotifylyrics-lyricslist::-webkit-scrollbar-thumb {
                    background: rgba(80,80,80,0.5);
                    border-radius: 3px;
                }
                .spotifylyrics-lyricslist::-webkit-scrollbar-thumb:hover {
                    background: rgba(120,120,120,0.7);
                }
                .spotifylyrics-lyricslist::-webkit-scrollbar-corner {
                    background: transparent;
                }
                .spotifylyrics-lyricslist {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(80,80,80,0.5) transparent;
                }
            `;
        }
        BdApi.clearCSS("SpotifyLyrics-style");
        BdApi.injectCSS("SpotifyLyrics-style", `
            .spotifylyrics-sidebarpanel {
                background: var(--background-secondary, #232428);
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
            .spotifylyrics-sidebarpanel.expanded {
                max-height: none !important;
                height: auto !important;
            }
            .spotifylyrics-largeview .spotifylyrics-line {
                font-size: inherit;
                opacity: 0.65;
                line-height: 1.85;
                background: none !important;
                color: var(--header-primary, #fff) !important;
                font-weight: 400 !important;
            }
            .spotifylyrics-largeview .spotifylyrics-line.current {
                color: #3399ff !important;
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
                opacity: 0.4;
                transition: opacity 0.12s, color 0.12s, background 0.12s;
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
                background: var(--background-accent, #4f545c);
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
            .spotifylyrics-floating-btn.show {
                display: block;
            }
            .spotifylyrics-expand-popout, .spotifylyrics-fontsize-popout {
                position: fixed;
                z-index: 9999;
                background: var(--background-floating, #232428);
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
                gap: 6px;
                animation: spotifylyrics-fadein .14s;
            }
            .spotifylyrics-expand-popout-btn, .spotifylyrics-fontsize-popout-btn {
                background: var(--background-accent, #1db95422);
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
            .container_debb33 {
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
        if (typeof BdApi !== "undefined" && typeof BdApi.clearCSS === "function")
            BdApi.clearCSS("SpotifyLyrics-style");
    }

    getPanelParent() { return document.querySelector('.panels_c48ade'); }
    getSpotifyPanel() {
        return document.querySelector('.container_791eb8.withTimeline_791eb8') || document.querySelector('.container_debb33');
    }

    applyDefaultView() {
        this._lyricsExpanded = false;
        this._lyricsLargeView = false;
        this._lyricsCustomView = false;
        if (this.settings.defaultView === "expanded") this._lyricsExpanded = true;
        if (this.settings.defaultView === "large") this._lyricsLargeView = true;
        if (this.settings.defaultView === "custom") this._lyricsCustomView = true;
    }

    tryInject() {
        const parent = this.getPanelParent();
        if (!parent) return;
        const spotifyPanel = this.getSpotifyPanel();
        const track = this.getTrackInfoFromDOM(spotifyPanel);
        if (!spotifyPanel || !track || !track.name || !track.artist) {
            this.removeLyricsPanel();
            return;
        }
        let panel = parent.querySelector("#spotifylyrics-panel");
        if (!panel) {
            panel = this.makePanel();
            if (panel) {
                parent.insertBefore(panel, parent.firstChild);
                if (spotifyPanel && parent.children[1] !== spotifyPanel) {
                    parent.insertBefore(spotifyPanel, parent.children[1]);
                }
            }
        } else {
            this.currentPanel = panel;
            this.setPanelMaxHeight();
            this.setLargeViewClass();
            this.updateLyricsDisplay(true);
        }
        if (panel) {
            panel.style.flexShrink = "1";
            panel.style.flexGrow = "1";
            panel.style.flexBasis = "auto";
            panel.style.minHeight = "50px";
            panel.style.maxHeight = (this._lyricsExpanded || this._lyricsLargeView || this._lyricsCustomView)
                ? "none"
                : this._defaultMaxHeight + "px";
            panel.style.overflow = "hidden";
        }
    }

    setPanelMaxHeight() {
        if (!this.currentPanel) return;
        if (this._lyricsExpanded || this._lyricsLargeView || this._lyricsCustomView) {
            this.currentPanel.classList.add("expanded");
            this.currentPanel.style.maxHeight = "none";
        } else {
            this.currentPanel.classList.remove("expanded");
            this.currentPanel.style.maxHeight = this._defaultMaxHeight + "px";
        }
    }

    setLargeViewClass() {
        if (!this.currentPanel) return;
        if (this._lyricsLargeView) {
            this.currentPanel.classList.add("spotifylyrics-largeview");
        } else {
            this.currentPanel.classList.remove("spotifylyrics-largeview");
        }
    }

    makePanel() {
        this.removeLyricsPanel();
        const spotifyPanel = this.getSpotifyPanel();
        const track = this.getTrackInfoFromDOM(spotifyPanel);
        if (!track || !track.name || !track.artist) {
            this.clearLyricTimer();
            return null;
        }
        this.applyDefaultView();
        const panelDiv = document.createElement("div");
        panelDiv.className = "spotifylyrics-sidebarpanel";
        panelDiv.id = "spotifylyrics-panel";
        this.currentPanel = panelDiv;
        this.setPanelMaxHeight();
        this.setLargeViewClass();
        // Set font size for all lyrics lines and no lyrics message
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
        // Custom context menu
        panelDiv.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.showExpandPopout(e);
        });
        // Add right click for font size (submenu)
        panelDiv.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.showExpandPopout(e);
        }, false);

        // Add a listener for the expand popout to show the font size menu
        this._expandPopoutFontHandler = (e) => {
            const fontBtn = document.getElementById("spotifylyrics-fontsize-popout-trigger");
            if (fontBtn) {
                fontBtn.addEventListener("mouseenter", (evt) => {
                    this.showFontSizePopout(fontBtn);
                }, { once: true });
                fontBtn.addEventListener("click", (evt) => {
                    this.showFontSizePopout(fontBtn);
                }, { once: true });
            }
        };
        setTimeout(() => {
            // In case popout is already open
            this._expandPopoutFontHandler();
        }, 0);

        panelDiv.addEventListener("wheel", () => this.onManualScroll());
        panelDiv.addEventListener("mousedown", () => this.onManualScroll());
        panelDiv.addEventListener("touchstart", () => this.onManualScroll());

        const trackName = track && typeof track.name === "string" ? track.name : "";
        const trackArtist = track && typeof track.artist === "string" ? track.artist : "";
        if (!trackName && !trackArtist) {
            this.clearLyricTimer();
            return null;
        }
        const newTrackId = `${trackName} - ${trackArtist}`.toLowerCase();
        if (this.lastTrackId !== newTrackId) {
            this.lastTrackId = newTrackId;
            this.currentTrack = track;
            this.lastLyrics = null;
            this.userScrolled = false;
            this.autoScrollPaused = false;
            this.lastActiveLineIdx = -1;
            this._lyricsDivHash = null;
            this.fetchLyrics(track).then(lyrics => {
                this.lastLyrics = lyrics;
                if (!lyrics || !lyrics.lrcLines || lyrics.lrcLines.length === 0) {
                    this.showNoLyricsMessage();
                    return;
                }
                this.updateLyricsDisplay(true);
            });
        } else if (this.lastLyrics && this.lastLyrics.lrcLines && this.lastLyrics.lrcLines.length > 0) {
            this.startLyricTimer();
            this.updateLyricsDisplay(true);
        } else if (this.lastLyrics && (!this.lastLyrics.lrcLines || this.lastLyrics.lrcLines.length === 0)) {
            this.showNoLyricsMessage();
        } else {
            this.removeLyricsPanel();
            return null;
        }
        return panelDiv;
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
    }

    removeLyricsPanel() {
        const existing = document.getElementById("spotifylyrics-panel");
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
        this.currentPanel = null;
        this.clearLyricTimer();
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
    }

    showExpandPopout(e) {
        this.removeExpandPopout();
        this.removeFontSizeMenuPopout();
        const popout = document.createElement("div");
        popout.className = "spotifylyrics-expand-popout";
        // Font size menu button
        const fontBtn = document.createElement("button");
        fontBtn.className = "spotifylyrics-expand-popout-btn";
        fontBtn.id = "spotifylyrics-fontsize-popout-trigger";
        fontBtn.textContent = `Font Size: ${this.settings.lyricsFontSize}px ▸`;
        fontBtn.style.display = "flex";
        fontBtn.style.alignItems = "center";
        fontBtn.style.justifyContent = "space-between";
        fontBtn.onmouseenter = (ev) => {
            this.showFontSizePopout(fontBtn);
        };
        fontBtn.onclick = (ev) => {
            this.showFontSizePopout(fontBtn);
        };
        popout.appendChild(fontBtn);
        // Large view option
        const largeViewBtn = document.createElement("button");
        largeViewBtn.className = "spotifylyrics-expand-popout-btn";
        largeViewBtn.textContent = this._lyricsLargeView ? "Collapse Large View" : "Large View";
        largeViewBtn.onclick = () => {
            if (!this._lyricsLargeView) {
                this._lyricsLargeView = true;
                this._lyricsExpanded = false;
                this._lyricsCustomView = false;
            } else {
                this._lyricsLargeView = false;
            }
            this.setLargeViewClass();
            this.setPanelMaxHeight();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(largeViewBtn);
        // Custom view option
        const customViewBtn = document.createElement("button");
        customViewBtn.className = "spotifylyrics-expand-popout-btn";
        customViewBtn.textContent = this._lyricsCustomView ? "Collapse Custom View" : "Custom View";
        customViewBtn.onclick = () => {
            if (!this._lyricsCustomView) {
                this._lyricsCustomView = true;
                this._lyricsExpanded = false;
                this._lyricsLargeView = false;
            } else {
                this._lyricsCustomView = false;
            }
            this.setLargeViewClass();
            this.setPanelMaxHeight();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(customViewBtn);
        // Expand/collapse option
        const expandBtn = document.createElement("button");
        expandBtn.className = "spotifylyrics-expand-popout-btn";
        expandBtn.textContent = this._lyricsExpanded ? "Collapse Lyrics" : "Expand Lyrics";
        expandBtn.onclick = () => {
            if (!this._lyricsExpanded) {
                this._lyricsExpanded = true;
                this._lyricsLargeView = false;
                this._lyricsCustomView = false;
            } else {
                this._lyricsExpanded = false;
            }
            this.setPanelMaxHeight();
            this.setLargeViewClass();
            this.updateLyricsDisplay(true);
            this.removeExpandPopout();
        };
        popout.appendChild(expandBtn);
        // Reload option
        const reloadBtn = document.createElement("button");
        reloadBtn.className = "spotifylyrics-expand-popout-btn";
        reloadBtn.textContent = "Reload Lyrics";
        reloadBtn.onclick = () => {
            this.forceFullPluginReload();
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
            if (!popout.contains(ev.target) && !document.querySelector(".spotifylyrics-fontsize-popout")?.contains(ev.target)) {
                this.removeExpandPopout();
                this.removeFontSizeMenuPopout();
                document.removeEventListener("mousedown", clickaway, true);
            }
        };
        document.addEventListener("mousedown", clickaway, true);
        this._popoutClickawayListener = clickaway;
        this._panelReloadPopout = popout;
        setTimeout(() => this._expandPopoutFontHandler && this._expandPopoutFontHandler(), 0);
    }

    removeExpandPopout() {
        if (this._panelReloadPopout && this._panelReloadPopout.parentNode)
            this._panelReloadPopout.parentNode.removeChild(this._panelReloadPopout);
        this._panelReloadPopout = null;
        if (this._popoutClickawayListener)
            document.removeEventListener("mousedown", this._popoutClickawayListener, true);
        this._popoutClickawayListener = null;
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
        // Position next to triggerBtn
        const rect = triggerBtn.getBoundingClientRect();
        let x = rect.right + 8;
        let y = rect.top;
        if (x + popout.offsetWidth > window.innerWidth - 8) x = rect.left - popout.offsetWidth - 8;
        if (y + popout.offsetHeight > window.innerHeight - 8) y = window.innerHeight - popout.offsetHeight - 8;
        popout.style.left = x + "px";
        popout.style.top = y + "px";
        // Remove on click outside
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

    removeFontSizeMenuPopout() {
        if (this._fontSizeMenuPopout && this._fontSizeMenuPopout.parentNode)
            this._fontSizeMenuPopout.parentNode.removeChild(this._fontSizeMenuPopout);
        this._fontSizeMenuPopout = null;
        if (this._fontSizePopoutClickawayListener)
            document.removeEventListener("mousedown", this._fontSizePopoutClickawayListener, true);
        this._fontSizePopoutClickawayListener = null;
    }

    forceFullPluginReload() {
        this.stop();
        setTimeout(() => this.start(), 100);
    }

    getTrackInfoFromDOM(panel) {
        if (!panel) return null;
        const songDiv = panel.querySelector('.song_791eb8 .textScroller_72a89f > div') || panel.querySelector('.song_debb33 .textScroller_debb33 > div');
        const artistDiv = panel.querySelector('.interpret_791eb8 .textScroller_72a89f > div') || panel.querySelector('.artist_debb33 .textScroller_debb33 > div');
        if (songDiv && artistDiv) {
            const name = songDiv.textContent.trim();
            let artist = artistDiv.textContent.trim();
            if (artist.toLowerCase().startsWith('by ')) artist = artist.slice(3).trim();
            return { name, artist };
        }
        return null;
    }

    async fetchLyrics(track) {
        try {
            const res = await fetch(
                `https://lrclib.net/api/search?track_name=${encodeURIComponent(track?.name ?? "")}&artist_name=${encodeURIComponent(track?.artist ?? "")}`
            );
            const data = await res.json();
            if (data && data.length > 0) {
                if (data[0].syncedLyrics) {
                    return { lrcLines: this.parseLRC(data[0].syncedLyrics) };
                } else if (data[0].plainLyrics) {
                    return { lrcLines: data[0].plainLyrics.split("\n").map(line => ({ time: 0, text: line })) };
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

    startLyricTimer() {
        if (this.lyricTimer) clearInterval(this.lyricTimer);
        const interval = Math.max(50, parseInt(this.settings.lyricsIntervalMs) || 400);
        this.lyricTimer = setInterval(() => this.updateLyricsDisplay(), interval);
        this.lastActiveLineIdx = -1;
    }

    clearLyricTimer() {
        if (this.lyricTimer) clearInterval(this.lyricTimer);
        this.lyricTimer = null;
        this.lastActiveLineIdx = -1;
    }

    getCurrentSpotifyElapsedTime() {
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

    updateLyricsAlign() {
        if (!this.currentPanel) return;
        const lyricsDiv = this.currentPanel.querySelector('.spotifylyrics-lyricslist');
        if (lyricsDiv) {
            lyricsDiv.style.textAlign = this.settings.lyricsAlign || "center";
        }
    }

    restartLyricTimer() {
        this.clearLyricTimer();
        this.startLyricTimer();
    }

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
        for (let i = 0; i < lrcLines.length; ++i) {
            if (lrcLines[i].time <= (elapsed - offsetSec)) idx = i;
            else break;
        }
        const hash = (this.lastTrackId || "") + "|" + this._lyricsLargeView + "|" + this._lyricsExpanded + "|" + this._lyricsCustomView + "|" + this.settings.lyricsContextLines + "|" + this.settings.customViewLines + "|" + this.settings.lyricsFontSize;
        if (lyricsDiv._renderedForHash !== hash || forceUpdate) {
            lyricsDiv.innerHTML = "";
            if (this._lyricsLargeView || this._lyricsExpanded) {
                lrcLines.forEach((line, i) => {
                    lyricsDiv.appendChild(this.renderLyricLine(line, i, i === idx));
                });
            } else if (this._lyricsCustomView) {
                const n = Math.max(1, parseInt(this.settings.customViewLines) || 5);
                let start = Math.max(0, idx - Math.floor((n - 1) / 2));
                let end = start + n - 1;
                if (end >= lrcLines.length) {
                    end = lrcLines.length - 1;
                    start = Math.max(0, end - n + 1);
                }
                for (let i = start; i <= end; ++i) {
                    lyricsDiv.appendChild(this.renderLyricLine(lrcLines[i], i, i === idx));
                }
            } else {
                const context = Math.max(0, parseInt(this.settings.lyricsContextLines) || 1);
                const start = Math.max(0, idx - context);
                const end = Math.min(lrcLines.length - 1, idx + context);
                for (let i = start; i <= end; ++i) {
                    lyricsDiv.appendChild(this.renderLyricLine(lrcLines[i], i, i === idx));
                }
            }
            lyricsDiv._renderedForHash = hash;
        } else {
            const lineDivs = lyricsDiv.querySelectorAll(".spotifylyrics-line");
            if (this._lyricsLargeView || this._lyricsExpanded || this._lyricsCustomView) {
                lineDivs.forEach((div, i) => {
                    if (i === idx) div.classList.add("current");
                    else div.classList.remove("current");
                });
            } else {
                const context = Math.max(0, parseInt(this.settings.lyricsContextLines) || 1);
                const start = Math.max(0, idx - context);
                lineDivs.forEach((div, i) => {
                    if ((start + i) === idx) div.classList.add("current");
                    else div.classList.remove("current");
                });
            }
        }
        if ((this._lyricsLargeView || this._lyricsExpanded || this._lyricsCustomView) && !this.userScrolled && !this.autoScrollPaused) {
            const lineDivs = lyricsDiv.querySelectorAll(".spotifylyrics-line");
            if (lineDivs[idx]) {
                lineDivs[idx].scrollIntoView({ block: "center", behavior: "auto" });
            }
            this.lastActiveLineIdx = idx;
        } else if (!(this._lyricsLargeView || this._lyricsExpanded || this._lyricsCustomView)) {
            this.currentPanel.scrollTop = 0;
            this.updateFloatingBtnVisibility(false);
        }
    }

    // Instrumental break detection helper
    isInstrumentalLine(text) {
        if (!text) return false;
        // Allow for lines like "(Instrumental)", "[Instrumental]", "Instrumental", "instrumental break", etc.
        return /^\s*[\(\[]?\s*instrumental(\s*break)?\s*[\)\]]?\s*$/i.test(text.trim());
    }

    renderLyricLine(line, idx, isCurrent) {
        const div = document.createElement("div");
        div.className = "spotifylyrics-line" + (isCurrent ? " current" : "");
        div.style.fontSize = `${this.settings.lyricsFontSize}px`;
        if (this.isInstrumentalLine(line.text)) {
            div.innerText = "🎵 Instrumental";
        } else {
            div.innerText = line.text;
        }
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
        let idx = 0;
        for (let i = 0; i < lrcLines.length; ++i) {
            if (lrcLines[i].time <= (elapsed - offsetSec)) idx = i;
            else break;
        }
        const lineDivs = lyricsDiv.querySelectorAll(".spotifylyrics-line");
        if (lineDivs[idx]) {
            lineDivs[idx].scrollIntoView({ block: "center", behavior: instant ? "auto" : "smooth" });
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
    }

    _pollForTrackChange() {
        const spotifyPanel = this.getSpotifyPanel();
        const track = this.getTrackInfoFromDOM(spotifyPanel);
        if (!track || !track.name || !track.artist) return;
        const newTrackId = `${track.name} - ${track.artist}`.toLowerCase();
        if (this.lastTrackId !== newTrackId) {
            this.removeLyricsPanel();
            this.tryInject();
        }
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
                this.applyDefaultView();
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
        panel.appendChild(this._makeNote("Negative values make lyrics appear earlier. Default: -300 (shows lyrics 0.3s ahead)."));

        panel.appendChild(this._makeLabeledSelect(
            "Lyric Sync Interval (ms):",
            [
                { value: "3000", label: "3000 (lowest resource, least responsive)" },
                { value: "1000", label: "1000 (low resource, fairly responsive)" },
                { value: "500", label: "500 (default, good balance)" },
                { value: "250", label: "250 (more responsive, slightly higher resource)" },
                { value: "100", label: "100 (very responsive, higher resource)" },
                { value: "50", label: "50 (maximum responsiveness, highest resource use)" }
            ],
            this.settings.lyricsIntervalMs,
            v => {
                this.settings.lyricsIntervalMs = parseInt(v) || 500;
                BdApi.saveData("SpotifyLyrics", "settings", this.settings);
                this.restartLyricTimer();
            }
        ));
        panel.appendChild(this._makeNote("Lower values make lyric line switching more responsive, but may increase CPU usage. Default: 500."));

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
                if (this._lyricsCustomView) this.updateLyricsDisplay(true);
            },
            "number", "1", "50", "1"
        ));
        panel.appendChild(this._makeNote("How many lines to show in Custom View."));

        // Adjustable font size
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