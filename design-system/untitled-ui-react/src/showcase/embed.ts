/**
 * The bridge between the showcase and the website's /design-system page,
 * which shows it in an auto-sized iframe (the site's DesignSystemLibrary.tsx).
 *
 * The iframe is as tall as the showcase and never scrolls; the site page
 * scrolls instead. Two things follow from that:
 *
 * - Height. The showcase reports the height of its own content, not of the
 *   document. The document is never shorter than the iframe, so measuring it
 *   would let the iframe grow (say, when every icon is shown) but never shrink
 *   back, leaving empty space at the bottom.
 * - Overlays. The iframe's viewport is the whole iframe, tens of thousands of
 *   pixels tall, so a modal centred in it opens far outside the visitor's
 *   window. The site therefore tells the showcase which part of the iframe is
 *   on screen, and showcase.css pins modal overlays to that part.
 */
import { useEffect } from "react";
import type { RefObject } from "react";

export const embedded = typeof window !== "undefined" && window.parent !== window;

/** Messages this page sends to the site. */
export type ShowcaseMessage = { source: "nw-design-system"; type: "height"; height: number } | { source: "nw-design-system"; type: "scrollTo"; top: number };

/** The message the site sends this page: the on-screen part of the iframe, in iframe pixels. */
type HostMessage = { source: "nw-design-system-host"; type: "viewport"; top: number; height: number };

const isHostMessage = (data: unknown): data is HostMessage => {
    if (typeof data !== "object" || data === null) return false;
    const message = data as Record<string, unknown>;
    return (
        message.source === "nw-design-system-host" &&
        message.type === "viewport" &&
        typeof message.top === "number" &&
        typeof message.height === "number" &&
        Number.isFinite(message.top) &&
        Number.isFinite(message.height)
    );
};

export const post = (message: ShowcaseMessage) => {
    // Same origin only: the site embeds this page from its own domain.
    window.parent.postMessage(message, window.location.origin);
};

/** When embedded: reports the content's height, and applies the visible window the site sends. */
export const useEmbedBridge = (contentRef: RefObject<HTMLElement | null>) => {
    useEffect(() => {
        if (!embedded) return;
        const content = contentRef.current;
        if (!content) return;
        const root = document.documentElement;
        root.dataset.embedded = "";

        let last = -1;
        const report = () => {
            const height = Math.ceil(content.getBoundingClientRect().height);
            if (height === last) return;
            last = height;
            post({ source: "nw-design-system", type: "height", height });
        };
        const observer = new ResizeObserver(report);
        observer.observe(content);
        report();

        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== window.parent) return;
            if (!isHostMessage(event.data)) return;
            root.style.setProperty("--nw-view-top", `${Math.max(0, Math.round(event.data.top))}px`);
            root.style.setProperty("--nw-view-height", `${Math.max(0, Math.round(event.data.height))}px`);
        };
        window.addEventListener("message", onMessage);

        return () => {
            observer.disconnect();
            window.removeEventListener("message", onMessage);
            delete root.dataset.embedded;
        };
    }, [contentRef]);
};
