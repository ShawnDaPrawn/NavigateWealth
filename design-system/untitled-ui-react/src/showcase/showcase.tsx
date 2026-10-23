/**
 * The Navigate Wealth design system showcase: every Untitled UI component in
 * the central library, rendered in the Navigate Wealth theme.
 *
 * Standalone it is an ordinary page. Embedded in the website's /design-system
 * page (an auto-sized iframe), it talks to the site through embed.ts, and index
 * links ask the site to scroll, because the iframe itself never scrolls.
 */
import { useRef } from "react";
import type { MouseEvent } from "react";
import { embedded, post, useEmbedBridge } from "./embed";
import { applicationGroup } from "./sections/application";
import { baseGroup } from "./sections/base";
import { formsGroup } from "./sections/forms";
import { foundationsGroup } from "./sections/foundations";
import type { ShowcaseGroup } from "./showcase-kit";

export const GROUPS: ShowcaseGroup[] = [foundationsGroup, baseGroup, formsGroup, applicationGroup];

const jumpTo = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (embedded) {
        post({ source: "nw-design-system", type: "scrollTo", top: target.getBoundingClientRect().top + window.scrollY });
    } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};

export const Showcase = () => {
    const contentRef = useRef<HTMLDivElement>(null);
    useEmbedBridge(contentRef);

    const total = GROUPS.reduce((sum, group) => sum + group.entries.length, 0);

    return (
        <div ref={contentRef} className="mx-auto flex w-full max-w-container flex-col gap-12 px-4 py-8 md:px-8">
            <header className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-brand-secondary">Navigate Wealth design system</p>
                <h2 className="text-display-sm font-semibold text-primary">Component library</h2>
                <p className="max-w-3xl text-lg text-tertiary">
                    All {total} Untitled UI components in the central library, in the Navigate Wealth theme. Import any of them from{" "}
                    <code className="font-mono text-md">design-system/untitled-ui-react/src/components</code>. The site does not use them yet: this is the
                    reference they will be wired up from.
                </p>
            </header>

            <nav
                aria-label="Component index"
                className="grid gap-6 rounded-2xl bg-secondary p-6 ring-1 ring-secondary ring-inset sm:grid-cols-2 lg:grid-cols-4"
            >
                {GROUPS.map((group) => (
                    <div key={group.id} className="flex flex-col gap-2">
                        <a href={`#${group.id}`} onClick={(e) => jumpTo(e, group.id)} className="text-sm font-semibold text-primary hover:text-brand-secondary">
                            {group.title}
                        </a>
                        <ul className="flex flex-col gap-1">
                            {group.entries.map((entry) => (
                                <li key={entry.id}>
                                    <a href={`#${entry.id}`} onClick={(e) => jumpTo(e, entry.id)} className="text-sm text-tertiary hover:text-brand-secondary">
                                        {entry.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            {GROUPS.map(({ id, title, description, Component }) => (
                <section key={id} id={id} className="flex scroll-mt-6 flex-col gap-10">
                    <div className="flex flex-col gap-2 border-b border-secondary pb-5">
                        <h2 className="text-display-xs font-semibold text-primary md:text-display-sm">{title}</h2>
                        <p className="max-w-3xl text-md text-tertiary">{description}</p>
                    </div>
                    <Component />
                </section>
            ))}
        </div>
    );
};
