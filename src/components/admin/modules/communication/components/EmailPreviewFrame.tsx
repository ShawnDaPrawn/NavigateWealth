/**
 * An email as the recipient will see it: HTML from the real layout
 * (`renderEmailLayout`, src/shared/email/emailLayout.ts — the same function the
 * server sends with) in a sandboxed frame, drawn at desktop width and scaled
 * to fit, in the light or dark theme the admin picks.
 *
 * The frame is sandboxed without `allow-scripts`: body HTML is author content,
 * and nothing in an email should run. `allow-same-origin` stays so the frame's
 * height can be read and the preview sized to the email.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { forceEmailColorScheme } from '@/shared/email/emailLayout';
import { cn } from '../../../../ui/utils';

export type EmailPreviewScheme = 'light' | 'dark';

/** Wide enough that the layout's phone rules (620px and under) stay off. */
const DESKTOP_WIDTH = 680;

interface EmailSchemeToggleProps {
  value: EmailPreviewScheme;
  onChange: (value: EmailPreviewScheme) => void;
  className?: string;
}

/** Light / Dark switch for a preview. Email clients pick the theme from the reader's device. */
export function EmailSchemeToggle({ value, onChange, className }: EmailSchemeToggleProps) {
  const options: ReadonlyArray<{ id: EmailPreviewScheme; label: string; Icon: typeof Sun }> = [
    { id: 'light', label: 'Light', Icon: Sun },
    { id: 'dark', label: 'Dark', Icon: Moon },
  ];
  return (
    <div
      role="group"
      aria-label="Preview theme"
      className={cn('inline-flex rounded-md border border-nw-line bg-white p-0.5', className)}
    >
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60',
            value === id ? 'bg-nw-ink text-white' : 'text-nw-text-2 hover:text-nw-ink',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

interface EmailPreviewFrameProps {
  /** A full email document from `renderEmailLayout`. */
  html: string;
  scheme?: EmailPreviewScheme;
  /** Fixed zoom. Omit to fit the available width (never above 100%). */
  scale?: number;
  /** Cap the preview's height; the rest scrolls. */
  maxHeight?: number;
  title?: string;
  className?: string;
}

export function EmailPreviewFrame({
  html,
  scheme = 'light',
  scale,
  maxHeight,
  title = 'Email preview',
  className,
}: EmailPreviewFrameProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState(1);
  const [height, setHeight] = useState(900);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || scale !== undefined) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setFit(Math.min(1, width / DESKTOP_WIDTH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scale]);

  const measure = useCallback(() => {
    const body = frameRef.current?.contentDocument?.body;
    if (body && body.scrollHeight > 0) setHeight(body.scrollHeight);
  }, []);

  const srcDoc = useMemo(() => forceEmailColorScheme(html, scheme), [html, scheme]);
  const k = scale ?? fit;

  return (
    <div
      ref={wrapperRef}
      className={cn('w-full', maxHeight !== undefined && 'overflow-y-auto', className)}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
    >
      <div
        className="relative mx-auto overflow-hidden"
        style={{ width: DESKTOP_WIDTH * k, height: height * k }}
      >
        <iframe
          ref={frameRef}
          srcDoc={srcDoc}
          title={title}
          sandbox="allow-same-origin"
          onLoad={measure}
          className="absolute left-0 top-0 border-0"
          style={{
            width: DESKTOP_WIDTH,
            height,
            transform: `scale(${k})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
}
