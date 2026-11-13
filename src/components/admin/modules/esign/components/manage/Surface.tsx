/**
 * Lets an e-sign management tool render either as a dialog or inline on the
 * Manage tab (design system: tools live on the page, not in pop-ups).
 *
 * The tool keeps one body and swaps its wrapper: `Surface` is a Dialog when
 * `inline` is false and a plain section when it is true. The header and footer
 * parts follow suit, because Radix's DialogTitle and friends cannot render
 * outside a Dialog.
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { cn } from '../../../../../ui/utils';

const InlineContext = createContext(false);

/** True when the tool is rendered on the Manage tab rather than in a dialog. */
function useSurfaceInline(): boolean {
  return useContext(InlineContext);
}

interface SurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inline?: boolean;
  /** Dialog sizing; ignored inline. */
  className?: string;
  children: ReactNode;
}

export function Surface({ open, onOpenChange, inline = false, className, children }: SurfaceProps) {
  if (inline) {
    return (
      <InlineContext.Provider value={true}>
        <section className="flex flex-col gap-4 rounded-xl border border-nw-line bg-white p-5">
          {children}
        </section>
      </InlineContext.Provider>
    );
  }
  return (
    <InlineContext.Provider value={false}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>{children}</DialogContent>
      </Dialog>
    </InlineContext.Provider>
  );
}

export function SurfaceHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const inline = useSurfaceInline();
  if (inline) return <div className={cn('flex flex-col gap-1', className)}>{children}</div>;
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function SurfaceTitle({ className, children }: { className?: string; children: ReactNode }) {
  const inline = useSurfaceInline();
  if (inline) {
    return (
      <h2 className={cn('flex items-center gap-2 text-base font-semibold text-nw-ink', className)}>
        {children}
      </h2>
    );
  }
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function SurfaceDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const inline = useSurfaceInline();
  if (inline) return <p className={cn('text-sm text-nw-text-3', className)}>{children}</p>;
  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function SurfaceFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const inline = useSurfaceInline();
  if (inline) return <div className={cn('flex justify-end gap-2', className)}>{children}</div>;
  return <DialogFooter className={className}>{children}</DialogFooter>;
}
