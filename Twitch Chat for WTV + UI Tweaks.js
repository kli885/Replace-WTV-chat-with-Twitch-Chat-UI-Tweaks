// ==UserScript==
// @name         w.tv -> Twitch Chat
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Twitch chat for w.tv + other UI tweaks
// @match        https://w.tv/*
// @match        https://www.w.tv/*
// @run-at       document-start
// @grant        GM_addStyle
// @author       PlutoMonkey
// @updateURL    https://github.com/kli885/Replace-WTV-chat-with-Twitch-Chat-UI-Tweaks/raw/refs/heads/main/Twitch%20Chat%20for%20WTV%20+%20UI%20Tweaks.js
// @downloadURL  https://github.com/kli885/Replace-WTV-chat-with-Twitch-Chat-UI-Tweaks/raw/refs/heads/main/Twitch%20Chat%20for%20WTV%20+%20UI%20Tweaks.js
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";

    const TWITCH_CHANNEL = "erobb221";

    const CONFIG = {
        chatWidthPx: 340,
        zIndex: 1,
        addBodyPaddingRight: true,
        tryDeleteBuiltInChat: true,
        watchUrlChanges: true,

        // How many times to retry initial injection while the page is settling.
        initialRetries: 8,
        initialRetryDelayMs: 600,
    };

    const UI = {
        styleId: "tm-twitch-chat-style",
        containerId: "tm-twitch-chat-container",
        iframeId: "tm-twitch-chat-iframe",
        hiddenChatClass: "tm-hide-built-in-chat",
    };

    function addStylesOnce() {
        if (document.getElementById(UI.styleId)) return;

        const css = `
            :root {
                --sidebar-width: 240px!important;
                --header-height: 50px!important;
                --header-height-big: 50px!important;
                --rounding-stream-preview-banner: 0px!important;
            }
            #${UI.containerId} {
                position: fixed;
                top: 0;
                right: 0;
                width: ${CONFIG.chatWidthPx}px;
                height: calc(100vh - var(--header-height));
                z-index: ${CONFIG.zIndex};
                background: #0e0e10;
                border-left: 1px solid rgba(173, 173, 184, 0.35) !important;
                border-top: 1px solid rgba(173, 173, 184, 0.35) !important;
                margin-top: var(--header-height);
            }
            html:has(#tm-wtv-video.fixed) #${UI.containerId} {
                height: 100vh;
                margin-top: 0px;
            }
            #${UI.iframeId} {
                width: 100%;
                height: 100%;
                border: 0;
                display: block;
            }
            .${UI.hiddenChatClass} {
                visibility: hidden !important;
                pointer-events: none !important;
            }

            div[data-reka-popper-content-wrapper] {
                z-index: 999 !important;
            }

            body.tm-twitch-chat-padding {
                padding-right: ${CONFIG.chatWidthPx}px !important;
            }

            a[data-testid="ui-user-menu-link"], div[data-testid="ui-user-menu-action"] {
                color: var(--color-white);
            }

            .tm-no-scrollbar {
                overflow-y: auto !important;
                scrollbar-gutter: auto !important;
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
            }

            .tm-no-scrollbar::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
            }

            #tm-wtv-video-outer {
                gap: 10px !important
            }

            #tm-wtv-video.fixed {
                width: calc(100% - ${CONFIG.chatWidthPx}px) !important;
                top: 0px!important;
            }

            #tm-wtv-video.fixed  video{
                aspect-ratio: 16/10!important;
            }

            [class~="mr-[var(--chat-width)]"] {
                margin-right: 0 !important;
            }
            [class~="lg:w-[calc(100%-16px-var(--chat-width))]"] {
                width: 100% !important;
            }
            main.tm-wtv-main-fix {
                padding-left: 0 !important;
                padding-right: 0 !important;
            }

            /* Only for lg and up (Tailwind lg = 1024px) */
            @media (min-width: 1024px) {
                main.tm-wtv-main-fix {
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                }
            }
            div:has(> div[data-v-70054f52].items-center) {
                padding-left: 5px !important;
                padding-right: 5px !important;
            }

            div[data-v-70054f52].subheading, div[data-v-70054f52].title {
                cursor: auto !important;
            }

            span[data-v-70054f52].subtitle {
                width: fit-content !important;
                cursor: pointer !important;
            }


            a[data-reka-collection-item] {
                padding-right: 0px !important;
            }

            nav[data-reka-navigation-menu], div.layout-sidebar {
                background-color: #1a1a1a!important;
            }

        `;

        const style = document.createElement("style");
        style.id = UI.styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildTwitchChatSrc(channel) {
        const parents = new Set([location.hostname, "w.tv", "www.w.tv"]);
        const qs = new URLSearchParams();
        for (const p of parents) qs.append("parent", p);
        return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${qs.toString()}`;
    }

    function ensureContainer() {
        let container = document.getElementById(UI.containerId);
        if (!container) {
            container = document.createElement("div");
            container.id = UI.containerId;

            const iframe = document.createElement("iframe");
            iframe.id = UI.iframeId;

            iframe.setAttribute(
                "sandbox",
                "allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"
            );

            container.appendChild(iframe);
            document.documentElement.appendChild(container);

            if (CONFIG.addBodyPaddingRight) {
                document.body.classList.add("tm-twitch-chat-padding");
            }
        }
        return container;
    }

    function findBuiltInChatPaneAndDelete() {
        if (!CONFIG.tryDeleteBuiltInChat) return;
        const chat = document.querySelector('div[data-teleport="stream-desktop-chat-target"]');
        const chatParent = chat ? chat.parentElement : null;
        if (chatParent) {
            chatParent.remove();
        }
    }

    function neutralizeWtVChatSpacing() {
        document.documentElement.style.setProperty("--chat-width", "0px", "important");
        if (document.body) document.body.style.setProperty("--chat-width", "0px", "important");
        document.documentElement.style.setProperty("--rounding-stream-preview-banner", "0px", "important");
        if (document.body) document.body.style.setProperty("--rounding-stream-preview-banner", "0px", "important");

        const MR_TOKEN = "mr-[var(--chat-width)]";
        const W_TOKEN = "lg:w-[calc(100%-16px-var(--chat-width))]";

        const nodes = Array.from(document.querySelectorAll('[class*="var(--chat-width)"]'));

        for (const el of nodes) {
            if (!(el instanceof HTMLElement)) continue;

            if (el.classList.contains(MR_TOKEN)) {
                el.classList.remove(MR_TOKEN);
                el.style.setProperty("margin-right", "0px", "important");
            }

            if (el.classList.contains(W_TOKEN)) {
                el.classList.remove(W_TOKEN);
                el.style.setProperty("width", "100%", "important");
            }
        }
    }
    function fixMainTagSpacing() {
        const main = document.querySelector("main");
        if (!main) return;

        const TOKENS_TO_REMOVE = ["px-4", "lg:px-6", "lg:ml-24", "max-lg:px-4"];

        const targets = [main];

        if (main.firstElementChild) targets.push(main.firstElementChild);

        for (const el of targets) {
            if (!(el instanceof HTMLElement)) continue;

            el.classList.add("tm-wtv-main-fix");

            for (const t of TOKENS_TO_REMOVE) {
                if (el.classList.contains(t)) el.classList.remove(t);
            }

            el.style.setProperty("padding-left", "0px", "important");
            el.style.setProperty("padding-right", "0px", "important");
        }
    }

    function fixVideoPlayerSizing() {
        const video = document.querySelector("#videoPlayer");
        if (!video) return null;

        // Stable ancestor in your snippet
        const container =
            video.closest('div[class*="overflow-x-hidden"][class*="not-lg:fixed"]') ||
            video.closest('div[class*="overflow-x-hidden"]');

        if (!container) return null;

        for (const child of container.children) {
            if (child instanceof HTMLElement && child.contains(video)) {
                child.id = "tm-wtv-video";
                child.parentElement?.id = "tm-wtv-video-outer";
                child.children[0]?.children[0]?.id = "tm-wtv-video-inner";
            }
        }
    }

    function hideScrollbarsNoGutter() {
        const el = document.querySelector("div.app-container") ||
            document.querySelector(".app-container") ||
            document.querySelector('[class*="app-container"]') || // fallback
            document.scrollingElement // last resort
        if (!el) return;

        el.classList.add("tm-no-scrollbar");

        const prev = el.style.overflowY;
        el.style.overflowY = "hidden";
        void el.offsetHeight; // force reflow
        el.style.overflowY = prev || "auto";
    }

    const TM_PORTAL_ATTR = "data-tm-ported";
    let tmMenuPortalState = null;

    function portalUserMenuList() {
        const btn = document.querySelector('[data-testid="header-dropdown"]');
        const list = document.querySelector('[data-testid="ui-user-menu-list"]');
        if (!btn || !list) return;

        const cs = getComputedStyle(list);
        const isOpen = cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";

        // Restore when closed
        if (!isOpen) {
            if (list.hasAttribute(TM_PORTAL_ATTR) && tmMenuPortalState?.parent) {
                list.removeAttribute(TM_PORTAL_ATTR);
                list.style.position = "";
                list.style.top = "";
                list.style.left = "";
                list.style.right = "";
                list.style.zIndex = "";
                list.style.transform = "";
                list.style.transition = "";

                const { parent, nextSibling } = tmMenuPortalState;
                if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(list, nextSibling);
                else parent.appendChild(list);

                tmMenuPortalState = null;
            }
            return;
        }

        // Portal once
        if (!list.hasAttribute(TM_PORTAL_ATTR)) {
            tmMenuPortalState = {
                parent: list.parentNode,
                nextSibling: list.nextSibling,
            };

            list.setAttribute(TM_PORTAL_ATTR, "1");
            document.body.appendChild(list);

            list.style.position = "fixed";
            list.style.zIndex = "999";
            list.style.transform = "none";
            list.style.width = "177px";
        }

        const r = btn.getBoundingClientRect();

        const w = list.offsetWidth || 171; // fallback
        const left = Math.max(8, Math.round(r.right - w));

        list.style.left = `${left}px`;
    }


    function injectOrUpdate() {
        addStylesOnce();
        ensureContainer();

        const iframe = document.getElementById(UI.iframeId);
        const desired = buildTwitchChatSrc(TWITCH_CHANNEL);

        const current = iframe.getAttribute("src") || "";
        if (current !== desired) iframe.setAttribute("src", desired);

        findBuiltInChatPaneAndDelete();
        fixVideoPlayerSizing();
        fixMainTagSpacing();
        portalUserMenuList();
        hideScrollbarsNoGutter();
    }

    function runInitialRetries() {
        let remaining = CONFIG.initialRetries;

        const tick = () => {
            injectOrUpdate();
            remaining -= 1;
            if (remaining > 0) setTimeout(tick, CONFIG.initialRetryDelayMs);
        };

        tick();
    }

    function watchUrlChanges() {
        if (!CONFIG.watchUrlChanges) return;

        let last = location.href;
        setInterval(() => {
            if (location.href !== last) {
                last = location.href;
                runInitialRetries();
            }
        }, 500);
    }

    runInitialRetries();
    watchUrlChanges();
    window.addEventListener("resize", portalUserMenuList);
    window.addEventListener("scroll", portalUserMenuList, true);
})();
