/**
 * Building blocks for the Navigate Wealth design system showcase: a section per
 * component with an anchor, demo panels, and the import line that pulls the
 * component from the central library.
 */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export interface ShowcaseEntry {
    /** Anchor id, e.g. "buttons". */
    id: string;
    /** Name shown in the index and the heading, e.g. "Buttons". */
    title: string;
}

export interface ShowcaseGroup {
    id: string;
    title: string;
    description: string;
    entries: ShowcaseEntry[];
    /** Renders every section of the group, in the same order as `entries`. */
    Component: () => ReactNode;
}

/** One component's section: heading, description, where to import it from, demos. */
export const ShowcaseSection = ({
    id,
    title,
    description,
    importPath,
    exports: names,
    children,
}: {
    id: string;
    title: string;
    description?: ReactNode;
    /** Module path under src/components, e.g. "base/buttons/button". */
    importPath: string;
    /** Named exports to show in the import line. */
    exports: string[];
    children: ReactNode;
}) => (
    <section id={id} data-showcase-section className="scroll-mt-6 border-t border-secondary pt-10 first:border-t-0 first:pt-0">
        <div className="flex flex-col gap-2">
            <h3 className="text-display-xs font-semibold text-primary">{title}</h3>
            {description && <p className="max-w-3xl text-md text-tertiary">{description}</p>}
            <code className="mt-1 block w-fit max-w-full overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-secondary ring-1 ring-secondary ring-inset">
                {`import { ${names.join(", ")} } from "@/components/${importPath}";`}
            </code>
        </div>
        <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
);

/** A labelled panel holding one or more rendered examples. */
export const Demo = ({
    title,
    children,
    className,
    dark = false,
}: {
    title?: string;
    children: ReactNode;
    className?: string;
    /** Show on Navigate Wealth's dark navy surface. */
    dark?: boolean;
}) => (
    <div className="overflow-hidden rounded-xl ring-1 ring-secondary ring-inset">
        {title && <div className="border-b border-secondary bg-secondary_alt px-4 py-2.5 text-sm font-semibold text-secondary">{title}</div>}
        <div className={cx("flex flex-wrap items-center gap-4 overflow-x-auto p-6", dark ? "bg-navy" : "bg-primary", className)}>{children}</div>
    </div>
);

/** A small caption under or beside an example. */
export const Caption = ({ children }: { children: ReactNode }) => <p className="text-xs text-quaternary">{children}</p>;

/** Stacks a caption over an example. */
export const Labelled = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
    <div className={cx("flex flex-col gap-2", className)}>
        <Caption>{label}</Caption>
        {children}
    </div>
);
