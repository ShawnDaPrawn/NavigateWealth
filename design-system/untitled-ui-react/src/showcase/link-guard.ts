/**
 * Keeps the showcase on its own page.
 *
 * Demos (and the kit's own navigation components) carry sample links such as
 * "/dashboard" or an external site. Followed inside the showcase they would
 * replace it, and when it is embedded in the website's /design-system page the
 * iframe would end up showing some other page. So every link click is caught:
 * links to another site open in a new tab, anchors on this page still jump,
 * and every other sample link does nothing.
 */
export const installLinkGuard = (doc: Document = document) => {
    const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target?.closest<HTMLAnchorElement>("a[href]");
        if (!anchor) return;

        const url = new URL(anchor.href, doc.baseURI);
        const here = new URL(doc.location.href);
        const samePage = url.origin === here.origin && url.pathname === here.pathname && url.search === here.search;
        if (samePage && url.hash) return; // In-page anchors keep working.

        event.preventDefault();
        if (url.origin !== here.origin && /^https?:$/.test(url.protocol)) {
            window.open(url.href, "_blank", "noopener,noreferrer");
        }
    };
    doc.addEventListener("click", onClick);
    return () => doc.removeEventListener("click", onClick);
};
