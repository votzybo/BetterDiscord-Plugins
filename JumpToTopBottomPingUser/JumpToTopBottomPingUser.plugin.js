/**
 * @name JumpToTopBottomPingUser
 * @author votzybo
 * @version 6.6.0
 * @description Navigation widget mounts inside the chat input button container. "Jump to top" uses the exact router call as the working JumpToTop plugin. "Jump to present" clicks the native button if visible, otherwise scrolls instantly to bottom. Mention/user jumps are instant. Toasts are centered above chat.
 */

const widgetId = "jump-to-top-bottom-ping-user-widget";
const widgetStyleId = "jump-to-top-bottom-ping-user-style";
const highlightClass = "jump-highlight-temp";
const toastId = "jump-toast";

/* ---------------- Toast ---------------- */
function showCenteredToast(message, duration = 2200) {
    const old = document.getElementById(toastId);
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.textContent = message;
    Object.assign(toast.style, {
        position: "fixed",
        top: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "99999",
        background: "var(--background-floating, #222)",
        color: "var(--text-normal, #fff)",
        padding: "14px 32px",
        borderRadius: "8px",
        boxShadow: "0 4px 16px #0008",
        fontSize: "1.15em",
        fontWeight: "bold",
        opacity: 0,
        transition: "opacity 0.25s"
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = 1));
    setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/* ---------------- Helpers ---------------- */
function highlightMessage(node) {
    if (!node) return;
    node.classList.add(highlightClass);
    setTimeout(() => node.classList.remove(highlightClass), 2000);
}

function findScroller() {
    return (
        document.querySelector('[class*="chatContent"] [class*="scroller"], [class*="scrollerInner-"], [class*="scrollerBase-"], .scroller__89969, main[tabindex="-1"]') ||
        document.querySelector('[role="main"] [class*="scroller"]')
    );
}

function findAllMessages() {
    return Array.from(document.querySelectorAll('div[data-list-item-id^="chat-messages_"][data-author-id]'));
}
function findOwnMessages() {
    return Array.from(document.querySelectorAll('div[data-list-item-id^="chat-messages_"][data-author-id][data-is-self="true"]'));
}
function findMentioned() {
    return Array.from(document.querySelectorAll(
        [
            'div[data-list-item-id^="chat-messages_"][data-author-id][class*="mention"]',
            'div[data-list-item-id^="chat-messages_"][data-author-id][class*="Mention"]',
            'div[data-list-item-id^="chat-messages_"][data-author-id].mentioned_fa6fd2',
            'div[data-list-item-id^="chat-messages_"][data-author-id].mentioned__58017',
            'div[data-list-item-id^="chat-messages_"][data-author-id].highlighted__7bba7',
            'div[data-list-item-id^="chat-messages_"][data-author-id].replyMention__1b686'
        ].join(", ")
    ));
}

/* ---------------- Actions ---------------- */
function jumpToPresent() {
    // Prefer clicking Discord's native "Jump to Present" button if it is visible.
    const jumpBtn = Array.from(document.querySelectorAll('button'))
        .find(btn => btn.textContent.trim().toLowerCase() === "jump to present" && btn.offsetParent !== null);
    if (jumpBtn) {
        jumpBtn.click();
        setTimeout(() => {
            const allMsgs = findAllMessages();
            if (allMsgs.length > 0) highlightMessage(allMsgs[allMsgs.length - 1]);
        }, 500);
        showCenteredToast("Used native Jump to Present button.", 2000);
        return;
    }

    // Fallback: instant scroll to bottom.
    const scroller = findScroller();
    if (scroller) {
        scroller.scrollTop = scroller.scrollHeight;
        setTimeout(() => {
            const allMsgs = findAllMessages();
            if (allMsgs.length > 0) highlightMessage(allMsgs[allMsgs.length - 1]);
        }, 200);
        showCenteredToast("Native Jump to Present not available, used scroll-to-bottom fallback.", 2600);
    } else {
        showCenteredToast("Unable to jump to present.", 2200);
    }
}

function jumpToTopByTransitionTo() {
    let transitionTo;
    try {
        transitionTo = BdApi.Webpack.getByStrings("transitionTo - Transitioning to", { searchExports: true });
    } catch (e) {}
    if (typeof transitionTo !== "function") {
        showCenteredToast("Discord router not found (transitionTo). Try reloading or updating BetterDiscord.", 2500);
        return;
    }
    transitionTo(location.pathname + "/0");
}

function scrollToMostRecentPing() {
    const pings = findMentioned();
    if (pings.length > 0) {
        const found = pings[pings.length - 1];
        found.scrollIntoView({ behavior: "smooth", block: "center" });
        highlightMessage(found);
    } else {
        showCenteredToast("No mentioned messages found in view.", 2200);
    }
}

function scrollToMostRecentOwnMessage() {
    const ownMsgs = findOwnMessages();
    if (ownMsgs.length > 0) {
        const found = ownMsgs[ownMsgs.length - 1];
        found.scrollIntoView({ behavior: "smooth", block: "center" });
        highlightMessage(found);
    } else {
        showCenteredToast("No own messages found in view.", 2200);
    }
}

/* ---------------- UI ---------------- */
function createWidget() {
    // Wrapper matches the pattern in the container (keeps spacing consistent)
    const wrapper = document.createElement("div");
    wrapper.id = widgetId;
    wrapper.className = "buttonContainer__74017"; // harmless if class changes; our CSS still applies
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.height = "44px";
    wrapper.style.margin = "0 2px";

    // Main button — same size & shape as Send
    const mainBtn = document.createElement("button");
    mainBtn.className = "jump-btn-main";
    mainBtn.type = "button";
    mainBtn.title = "Jump to Present";
    mainBtn.setAttribute("aria-label", "Jump to Present");
    mainBtn.innerHTML = `<span class="jump-btn-icon">⇩</span>`;
    mainBtn.addEventListener("click", jumpToPresent);

    // Collapsible row
    const row = document.createElement("div");
    row.className = "jump-btn-row";
    row.innerHTML = `
        <button class="jump-btn" title="Jump to Top" type="button"><span>↑</span></button>
        <button class="jump-btn" title="Jump to Most Recent Mention" type="button"><span>@</span></button>
        <button class="jump-btn" title="Jump to Most Recent Own Message" type="button"><span>&#128100;</span></button>
    `;
    Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "0px",
        opacity: "0",
        pointerEvents: "none",
        transition: "max-width 0.18s cubic-bezier(.4,1.4,.7,1), opacity 0.18s cubic-bezier(.4,1.4,.7,1)",
        overflow: "hidden"
    });

    const [topBtn, pingBtn, userBtn] = row.querySelectorAll("button");
    topBtn.addEventListener("click", jumpToTopByTransitionTo);
    pingBtn.addEventListener("click", scrollToMostRecentPing);
    userBtn.addEventListener("click", scrollToMostRecentOwnMessage);

    function expand() {
        row.style.maxWidth = "180px";
        row.style.opacity = "1";
        row.style.pointerEvents = "auto";
    }
    function collapse() {
        row.style.maxWidth = "0px";
        row.style.opacity = "0";
        row.style.pointerEvents = "none";
    }

    wrapper.addEventListener("mouseenter", expand);
    wrapper.addEventListener("mouseleave", collapse);
    mainBtn.addEventListener("focus", expand);
    mainBtn.addEventListener("blur", collapse);

    wrapper.appendChild(mainBtn);
    wrapper.appendChild(row);
    return wrapper;
}

function injectStyle() {
    if (document.getElementById(widgetStyleId)) return;
    const style = document.createElement("style");
    style.id = widgetStyleId;
    style.textContent = `
#${widgetId} {
    height: 44px;
    flex-shrink: 0;
}
#${widgetId} .jump-btn-main {
    background: var(--brand-experiment);
    border: none;
    height: 44px;
    min-height: 44px;
    width: 44px;
    min-width: 44px;
    border-radius: 50%; /* match Send button roundness */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 22px;
    line-height: 1;
    transition: background 0.2s;
}
#${widgetId} .jump-btn-main:hover {
    background: var(--brand-experiment-560);
}
#${widgetId} .jump-btn-main:active {
    filter: brightness(0.95);
}

/* Main & sub buttons styled like Send (size/shape) */
#${widgetId} .jump-btn-main,
#${widgetId} .jump-btn {
    background: var(--brand-experiment);
    border: none;
    padding: 0 16px;
    height: 44px;
    min-height: 44px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
    line-height: 1;
    outline: none;
    transition: background 0.2s;
}
#${widgetId} .jump-btn-main:hover,
#${widgetId} .jump-btn:hover {
    background: var(--brand-experiment-560);
}
#${widgetId} .jump-btn-main:active,
#${widgetId} .jump-btn:active {
    filter: brightness(0.95);
}
#${widgetId} .jump-btn-main span,
#${widgetId} .jump-btn span {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white !important;
    font-size: 20px;
}

/* Message highlight */
.${highlightClass} {
    outline: 3px solid #ffe066 !important;
    box-shadow: 0 0 0 3px #ffe06699 !important;
    border-radius: 8px !important;
    transition: outline 0.2s, box-shadow 0.2s;
}

/* Toast */
#${toastId} { pointer-events: none; }
`;
    document.head.appendChild(style);
}

/* ---------------- Mounting inside the button container ---------------- */
function findButtonsContainer() {
    // Prefer exact class if present
    let el = document.querySelector('.buttons__74017');
    if (el) return el;

    // Fallbacks: any likely chat-input buttons container with known children
    const candidates = Array.from(document.querySelectorAll('div[class*="buttons__"], div[class^="buttons_"]'));
    return candidates.find(c =>
        c.querySelector('.buttonContainer__74017') ||
        c.querySelector('[aria-label="Open GIF picker"]') ||
        c.querySelector('.emojiButton__74017') ||
        c.querySelector('.channelAppLauncher_e6e74f')
    ) || null;
}

function insertWidget() {
    if (document.getElementById(widgetId)) return;
    injectStyle();

    const container = findButtonsContainer();
    if (!container) return;

    const widget = createWidget();

    // Find the Send button inside the container
    const sendBtn = container.querySelector('button[type="submit"]');
    if (sendBtn) {
        // Insert Jump button directly *before* the Send button
        container.insertBefore(widget, sendBtn);
    } else {
        // Fallback: append at the end
        container.appendChild(widget);
    }

    function insertWidget() {
    if (document.getElementById("jumpToBottomBtn")) return;

    injectStyle();

    // Find the send button wrapper
    let sendBtnWrapper = document.querySelector(
        ".buttonContainer__67645 > button"
    );

    if (sendBtnWrapper) {
        // Create Jump to Bottom button
        let jumpBtn = document.createElement("button");
        jumpBtn.id = "jumpToBottomBtn";
        jumpBtn.className = sendBtnWrapper.className; // Match Discord's button styles
        jumpBtn.setAttribute("aria-label", "Jump to Bottom");
        jumpBtn.style.marginLeft = "4px"; // Small gap from send button

        // Add Discord-style icon (chevron down circle)
        jumpBtn.innerHTML = `
            <svg x="0" y="0" class="icon_f6f7d8" aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 22C6.48 22 2 17.52 2 12S6.48 2 
                    12 2s10 4.48 10 10-4.48 10-10 10zm0-18C7.59 
                    4 4 7.59 4 12s3.59 8 8 8 8-3.59 8-8-3.59-8-8-8zm0 
                    11l-5-5h10l-5 5z"></path>
            </svg>
        `;

        // Insert after send button
        sendBtnWrapper.parentElement.insertBefore(
            jumpBtn,
            sendBtnWrapper.nextSibling
        );

        // Add scroll-to-bottom behavior
        jumpBtn.addEventListener("click", () => {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: "smooth",
            });
        });
    }
}
    if (document.getElementById("jumpToBottomStyle")) return;

    const style = document.createElement("style");
    style.id = "jumpToBottomStyle";
    style.textContent = `
        #jumpToBottomBtn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--background-primary);
            color: var(--interactive-normal);
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease;
        }
        #jumpToBottomBtn:hover {
            background: var(--background-modifier-selected);
            color: var(--interactive-hover);
        }
        #jumpToBottomBtn svg {
            width: 24px;
            height: 24px;
        }
    `;
    document.head.appendChild(style);


insertWidget();

}

function removeWidget() {
    const widget = document.getElementById(widgetId);
    if (widget) widget.remove();
    const style = document.getElementById(widgetStyleId);
    if (style) style.remove();
    const toast = document.getElementById(toastId);
    if (toast) toast.remove();
}

function observeAttachWrapper() {
    const root = document.getElementById("app-mount");
    if (!root) return null;
    const observer = new MutationObserver(() => {
        if (!document.getElementById(widgetId)) insertWidget();
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
}

/* ---------------- Plugin API ---------------- */
let observerInstance = null;

module.exports = class JumpToTopBottomPingUser {
    getName() { return "JumpToTopBottomPingUser"; }
    getDescription() {
        return "Navigation widget mounts in the chat input button container. 'Jump to top' uses router transitionTo. 'Jump to present' prefers the native button; otherwise scrolls instantly.";
    }
    getVersion() { return "6.6.0"; }
    getAuthor() { return "votzybo"; }

    start() {
        insertWidget();
        observerInstance = observeAttachWrapper();
    }

    stop() {
        removeWidget();
        if (observerInstance) {
            observerInstance.disconnect();
            observerInstance = null;
        }
    }
};
