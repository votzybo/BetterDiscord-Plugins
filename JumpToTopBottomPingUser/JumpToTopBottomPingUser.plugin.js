/**
 * @name JumpToTopBottomPingUser
 * @author votzybo
 * @version 6.4.0
 * @description Navigation widget expands to the right of the upload button. "Jump to top" uses the exact router call as the working JumpToTop plugin. "Jump to present" simulates a click on the native button if visible, otherwise scrolls instantly to bottom. Mention/user jumps are instant. Toasts are centered above chat.
 */

const widgetId = "jump-to-top-bottom-ping-user-widget";
const widgetStyleId = "jump-to-top-bottom-ping-user-style";
const highlightClass = "jump-highlight-temp";
const toastId = "jump-toast";

// Centered toast
function showCenteredToast(message, duration = 2200) {
    const old = document.getElementById(toastId);
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '99999';
    toast.style.background = 'var(--background-floating, #222)';
    toast.style.color = 'var(--text-normal, #fff)';
    toast.style.padding = '14px 32px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 16px #0008';
    toast.style.fontSize = '1.15em';
    toast.style.fontWeight = 'bold';
    toast.style.opacity = 0;
    toast.style.transition = 'opacity 0.25s';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = 1; }, 10);
    setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

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

// Util: Get React instance for a DOM node
function getReactInstance(node) {
    for (const key in node) {
        if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"))
            return node[key];
    }
    return null;
}

// Jump to present: prioritize DOM button click, fallback to instant scroll-to-bottom
function jumpToPresent() {
    // 1. Try clicking the real Jump To Present button in the DOM (most reliable)
    const jumpBtn = Array.from(document.querySelectorAll('button'))
        .find(btn =>
            btn.textContent.trim().toLowerCase() === "jump to present" &&
            btn.offsetParent !== null // visible
        );
    if (jumpBtn) {
        jumpBtn.click();
        setTimeout(() => {
            const allMsgs = findAllMessages();
            if (allMsgs.length > 0) highlightMessage(allMsgs[allMsgs.length - 1]);
        }, 500);
        showCenteredToast("Used native Jump to Present button.", 2000);
        return;
    }

    // 2. Fallback: instant scroll to the bottom and highlight
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

// Jump to top using the exact proven JumpToTop plugin method
function jumpToTopByTransitionTo() {
    let transitionTo;
    try {
        transitionTo = BdApi.Webpack.getByStrings("transitionTo - Transitioning to", {searchExports: true});
    } catch (e) {}
    if (typeof transitionTo !== "function") {
        showCenteredToast("Discord router not found (transitionTo). Try reloading or updating BetterDiscord.", 2500);
        return;
    }
    transitionTo(location.pathname + "/0");
}

// Most recent mention (bottom-most)
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

// Most recent own message (bottom-most)
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

function createWidget() {
    const widget = document.createElement("div");
    widget.id = widgetId;
    widget.className = "jump-nav-widget";
    widget.tabIndex = 0;
    widget.style.display = "flex";
    widget.style.alignItems = "center";
    widget.style.position = "relative";
    widget.style.zIndex = "10";
    widget.style.marginLeft = "8px";
    widget.style.height = "40px";

    // Main button ("Jump to Present")
    const mainBtn = document.createElement("button");
    mainBtn.className = "jump-btn-main";
    mainBtn.title = "Jump to Present";
    mainBtn.setAttribute("type", "button");
    mainBtn.innerHTML = `<span class="jump-btn-icon" style="font-size:22px;color:white;display:flex;align-items:center;justify-content:center;height:100%;width:100%;">⇩</span>`;
    Object.assign(mainBtn.style, {
        background: "var(--background-secondary-alt, #2f3136)",
        color: "white",
        width: "40px",
        height: "40px",
        minWidth: "40px",
        minHeight: "40px",
        borderRadius: "50%",
        border: "1px solid var(--background-tertiary, #4f545c)",
        fontSize: "20px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "none",
        outline: "none",
        zIndex: "2",
        transition: "box-shadow 0.1s, border 0.2s"
    });
    mainBtn.addEventListener("click", jumpToPresent);

    // Button row (flex, expands on hover)
    const btnRow = document.createElement("div");
    btnRow.className = "jump-btn-row";
    btnRow.innerHTML = `
        <button class="jump-btn" title="Jump to Top" type="button">
            <span style="font-size:20px;color:white;">↑</span>
        </button>
        <button class="jump-btn" title="Jump to Most Recent Mention" type="button">
            <span style="font-size:18px;color:white;">@</span>
        </button>
        <button class="jump-btn" title="Jump to Most Recent Own Message" type="button">
            <span style="font-size:19px;color:white;">&#128100;</span>
        </button>
    `;
    btnRow.style.display = "flex";
    btnRow.style.flexDirection = "row";
    btnRow.style.alignItems = "center";
    btnRow.style.gap = "8px";
    btnRow.style.overflow = "hidden";
    btnRow.style.maxWidth = "0px";
    btnRow.style.opacity = "0";
    btnRow.style.pointerEvents = "none";
    btnRow.style.transition = "max-width 0.18s cubic-bezier(.4,1.4,.7,1), opacity 0.18s cubic-bezier(.4,1.4,.7,1)";

    // Add click listeners to each
    const [topBtn, pingBtn, userBtn] = btnRow.querySelectorAll("button");
    topBtn.addEventListener("click", jumpToTopByTransitionTo);
    pingBtn.addEventListener("click", scrollToMostRecentPing);
    userBtn.addEventListener("click", scrollToMostRecentOwnMessage);

    function expandRow() {
        btnRow.style.maxWidth = "120px";
        btnRow.style.opacity = "1";
        btnRow.style.pointerEvents = "all";
        mainBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.10)";
        mainBtn.style.borderColor = "var(--brand-experiment, #5865f2)";
    }
    function collapseRow() {
        btnRow.style.maxWidth = "0px";
        btnRow.style.opacity = "0";
        btnRow.style.pointerEvents = "none";
        mainBtn.style.boxShadow = "none";
        mainBtn.style.borderColor = "var(--background-tertiary, #4f545c)";
    }

    widget.addEventListener("mouseenter", expandRow);
    widget.addEventListener("mouseleave", collapseRow);
    mainBtn.addEventListener("focus", expandRow);
    mainBtn.addEventListener("blur", collapseRow);

    widget.appendChild(mainBtn);
    widget.appendChild(btnRow);
    return widget;
}

function injectStyle() {
    if (document.getElementById(widgetStyleId)) return;
    const style = document.createElement("style");
    style.id = widgetStyleId;
    style.textContent = `
#jump-to-top-bottom-ping-user-widget .jump-btn-main:active,
#jump-to-top-bottom-ping-user-widget .jump-btn-row .jump-btn:active {
    filter: brightness(0.9);
}
#jump-to-top-bottom-ping-user-widget .jump-btn-main:focus {
    outline: 2px solid var(--brand-experiment);
}
#jump-to-top-bottom-ping-user-widget .jump-btn,
#jump-to-top-bottom-ping-user-widget .jump-btn-main {
    background: var(--background-secondary-alt, #2f3136);
    border: 1px solid var(--background-tertiary, #4f545c);
    padding: 0;
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    box-shadow: none;
    transition: filter 0.1s, box-shadow 0.1s, border 0.2s;
}
#jump-to-top-bottom-ping-user-widget .jump-btn span {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white !important;
}
.${highlightClass} {
    outline: 3px solid #ffe066 !important;
    box-shadow: 0 0 0 3px #ffe06699 !important;
    border-radius: 8px !important;
    transition: outline 0.2s, box-shadow 0.2s;
}
#jump-toast {
    pointer-events: none;
}
`;
    document.head.appendChild(style);
}

function insertWidget() {
    if (document.getElementById(widgetId)) return;
    injectStyle();
    const wrapper = document.querySelector(".attachWrapper__0923f");
    const uploadBtn = wrapper && wrapper.querySelector("button");
    if (wrapper && uploadBtn) {
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        const widget = createWidget();
        if (uploadBtn.nextSibling) {
            wrapper.insertBefore(widget, uploadBtn.nextSibling);
        } else {
            wrapper.appendChild(widget);
        }
    }
}

function removeWidget() {
    const widget = document.getElementById(widgetId);
    if (widget && widget.parentElement) {
        widget.parentElement.removeChild(widget);
    }
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
    observer.observe(root, {childList: true, subtree: true});
    return observer;
}

let observerInstance = null;

module.exports = class JumpToTopBottomPingUser {
    getName() { return "JumpToTopBottomPingUser"; }
    getDescription() {
        return "Navigation widget expands to the right of the upload button. 'Jump to top' uses the exact router call as the working JumpToTop plugin. 'Jump to present' simulates a click on the native button if visible, otherwise scrolls instantly to bottom. Mention/user jumps are instant. Toasts are centered above chat.";
    }
    getVersion() { return "6.4.0"; }
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
