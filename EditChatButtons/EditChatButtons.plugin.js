/**
 * @name EditChatButtons
 * @author votzybo
 * @version 1.3.2
 * @description Lets you selectively remove Discord chatbar buttons: Gift, GIF, Sticker, and Game buttons. Also ensures all visible buttons are always evenly spaced apart, with customizable gap.
 * @source https://github.com/votzybo/BetterDiscord-Plugins
 * @invite kQfQdg3JgD
 * @donate https://www.paypal.com/paypalme/votzybo
 * @updateUrl https://raw.githubusercontent.com/votzybo/BetterDiscord-Plugins/refs/heads/main/EditChatButtons/EditChatButtons.plugin.js
 */

// total hours wasted making this plugin: 3??
// If Discord changes classnames again, I'm going to lose it

const BUTTON_CONFIG = [
    {
        name: "Gift",
        selector: '.buttons__74017 button', // Robust: all buttons in chatbar
        match: (el) => {
            // Robustly detect the Gift button by aria-label (most stable)
            // You can require a trigger element to exist if you want (see below)
            // if (!document.querySelector("#PersistentGift")) return false;
            return el.getAttribute("aria-label") === "Send a gift";
        }
    },
    {
        name: "GIF",
        selector: '.buttons__74017 button',
        match: (el) => el.getAttribute("aria-label") === "Open GIF picker"
    },
    {
        name: "Sticker",
        selector: '.buttons__74017 button',
        match: (el) => el.getAttribute("aria-label") === "Open sticker picker"
    },
    {
        name: "Game",
        selector: '.channelAppLauncher_e6e74f button',
        match: (el) => el.getAttribute("aria-label") === "Apps"
    }
];

// Clamp for slider, just in case user tries to break it
function clamp(num, min, max) {
    return Math.max(min, Math.min(num, max));
}

module.exports = class EditChatButtons {
    constructor() {
        // If Discord reloads and constructor isn't called, settings might be out of sync
        const saved = BdApi.loadData("EditChatButtons", "settings");
        this.settings = saved ? {...this.defaultSettings(), ...saved} : this.defaultSettings();
        this._observer = null;
        this._styleId = "ecb-even-spacing-style";
    }

    defaultSettings() {
        // I should probably add emoji button here someday
        return {
            Gift: false,
            GIF: false,
            Sticker: false,
            Game: false,
            gap: 8 // px, default
        };
    }

    saveSettings() {
        BdApi.saveData("EditChatButtons", "settings", this.settings);
    }

    start() {
        // Always reload settings on start in case Discord did a full reload
        const saved = BdApi.loadData("EditChatButtons", "settings");
        if (saved) this.settings = {...this.defaultSettings(), ...saved};

        this._observer = new MutationObserver(() => {
            // Sometimes Discord re-renders the chatbar randomly, so run this a lot
            this.removeButtons();
            this.applyEvenSpacing();
        });
        this._observer.observe(document.body, {childList: true, subtree: true, attributes: true});
        this.removeButtons();
        this.applyEvenSpacing();
        this.injectStyle();
    }

    stop() {
        if (this._observer) this._observer.disconnect();
        this.restoreButtons();
        this.removeStyle();
    }

    removeButtons() {
        // Remove selected buttons, if user chose to hide them
        BUTTON_CONFIG.forEach(cfg => {
            if (!this.settings[cfg.name]) return;
            document.querySelectorAll(cfg.selector).forEach(el => {
                if (cfg.match(el)) {
                    // If Discord changes the button wrapper, this will break. Oh well.
                    let btn = el.closest("button") || el.closest("div.channelAppLauncher_e6e74f");
                    if (btn) btn.style.display = "none";
                }
            });
        });
        this.applyEvenSpacing();
    }

    restoreButtons() {
        // Reset display on all potential buttons (even if user didn't hide them)
        BUTTON_CONFIG.forEach(cfg => {
            document.querySelectorAll(cfg.selector).forEach(el => {
                let btn = el.closest("button") || el.closest("div.channelAppLauncher_e6e74f");
                if (btn && cfg.match(el)) btn.style.display = "";
            });
        });
        this.applyEvenSpacing();
    }

    injectStyle() {
        // Remove old style to avoid stacking up a million tags
        this.removeStyle();
        const style = document.createElement("style");
        style.id = this._styleId;
        style.textContent = this._getSpacingCSS();
        document.head.appendChild(style);
    }

    removeStyle() {
        const style = document.getElementById(this._styleId);
        if (style) style.remove();
    }

    applyEvenSpacing() {
        // Update the gap variable on all chatbars
        document.querySelectorAll(".buttons__74017").forEach(toolbar => {
            toolbar.style.setProperty('--ecb-gap', `${this.settings.gap}px`);
        });
        // If user changes the gap, re-inject style for live updating
        this.injectStyle();
    }

    _getSpacingCSS() {
        // I tried "justify-content: space-between" but it looked weird with hidden buttons
        return `
            .buttons__74017 {
                display: flex !important;
                gap: var(--ecb-gap, ${this.settings.gap}px) !important;
                justify-content: flex-start !important;
                align-items: center !important;
            }
            .buttons__74017 > * {
                margin: 0 !important;
                flex: 0 1 auto !important;
            }
            /* Uncomment for strict equal width
            .buttons__74017 > * { flex: 1 1 0 !important; }
            */
        `;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "ecb-settings-root";
        panel.style.maxWidth = "420px";
        panel.style.margin = "32px auto";
        // Please don't judge me for writing HTML in a string
        panel.innerHTML = `
            <style>
                .ecb-settings-root {
                    font-family: var(--font-primary, "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif);
                }
                .ecb-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: var(--header-primary);
                    margin-bottom: 18px;
                }
                .ecb-desc {
                    color: var(--text-normal);
                    font-size: 15px;
                    margin-bottom: 24px;
                }
                .ecb-toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--background-secondary-alt, #2f3136);
                    border-radius: 8px;
                    padding: 16px 20px;
                    margin-bottom: 14px;
                    transition: background 0.13s;
                }
                .ecb-toggle-row:hover {
                    background: var(--background-tertiary, #36393f);
                }
                .ecb-label {
                    font-size: 16px;
                    color: var(--header-secondary);
                    font-weight: 500;
                }
                /* Modern Discord toggle switch */
                .ecb-switch {
                    position: relative;
                    width: 44px;
                    height: 22px;
                    display: inline-block;
                }
                .ecb-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .ecb-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: var(--background-modifier-accent, #4f545c);
                    border-radius: 12px;
                    transition: background 0.2s;
                }
                .ecb-switch input:checked + .ecb-slider {
                    background-color: var(--brand-experiment, #5865f2);
                }
                .ecb-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 2px;
                    bottom: 2px;
                    background-color: var(--background-secondary, #313338);
                    border-radius: 50%;
                    transition: transform 0.2s, background 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.07);
                }
                .ecb-switch input:checked + .ecb-slider:before {
                    transform: translateX(22px);
                    background-color: #fff;
                }
                .ecb-gap-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--background-secondary-alt, #2f3136);
                    border-radius: 8px;
                    padding: 16px 20px;
                    margin-bottom: 20px;
                    transition: background 0.13s;
                    gap: 16px;
                }
                .ecb-gap-row:hover {
                    background: var(--background-tertiary, #36393f);
                }
                .ecb-gap-label {
                    font-size: 16px;
                    color: var(--header-secondary);
                    font-weight: 500;
                }
                .ecb-gap-slider {
                    flex: 1 1 auto;
                    margin-left: 16px;
                    margin-right: 10px;
                }
                .ecb-gap-value {
                    font-size: 16px;
                    color: var(--header-primary);
                    font-weight: 600;
                    min-width: 32px;
                    text-align: right;
                }
            </style>
            <div class="ecb-title">Edit Chat Buttons</div>
            <div class="ecb-desc">
                Select which chatbar buttons to hide.<br>
                Changes apply instantly.<br>
                <b>All visible buttons are always evenly spaced.</b>
            </div>
        `;

        // Gap slider row
        const gapRow = document.createElement("div");
        gapRow.className = "ecb-gap-row";
        const gapLabel = document.createElement("span");
        gapLabel.className = "ecb-gap-label";
        gapLabel.textContent = "Button spacing";
        const gapSlider = document.createElement("input");
        gapSlider.className = "ecb-gap-slider";
        gapSlider.type = "range";
        gapSlider.min = 0;
        gapSlider.max = 32;
        gapSlider.value = this.settings.gap;
        gapSlider.step = 1;
        gapSlider.style.width = "140px";
        const gapValue = document.createElement("span");
        gapValue.className = "ecb-gap-value";
        gapValue.textContent = this.settings.gap + "px";
        gapSlider.oninput = (e) => {
            // Discord will probably break this at some point
            let val = clamp(parseInt(gapSlider.value), 0, 32);
            this.settings.gap = val;
            gapValue.textContent = val + "px";
            this.applyEvenSpacing();
            this.saveSettings();
        };
        gapRow.appendChild(gapLabel);
        gapRow.appendChild(gapSlider);
        gapRow.appendChild(gapValue);
        panel.appendChild(gapRow);

        // Button toggles for each config
        BUTTON_CONFIG.forEach(cfg => {
            const row = document.createElement("div");
            row.className = "ecb-toggle-row";
            const label = document.createElement("span");
            label.className = "ecb-label";
            label.textContent = "Remove " + cfg.name + " button";
            // Toggle switch component
            const switchLabel = document.createElement("label");
            switchLabel.className = "ecb-switch";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = !!this.settings[cfg.name];
            input.onchange = () => {
                this.settings[cfg.name] = input.checked;
                this.saveSettings();
                if (input.checked) this.removeButtons();
                else this.restoreButtons();
            };
            const slider = document.createElement("span");
            slider.className = "ecb-slider";
            switchLabel.appendChild(input);
            switchLabel.appendChild(slider);
            row.appendChild(label);
            row.appendChild(switchLabel);
            panel.appendChild(row);
        });

        return panel;
    }
}

// TODO: Support custom emoji button if Discord ever makes it optional
// let unused = 42; // leftover from testing
// console.log("EditChatButtons loaded"); // For debug, remove in prod
