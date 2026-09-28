/**
 * Untitled UI v8.0 "Loading indicator" and "Content divider".
 *
 * Loading indicator variants → props:
 *   Style  Line spinner | Line simple | Dot circle   → variant
 *   Size   sm | md | lg | xl (32/48/56/64px)        → size
 *   Supporting text                                 → label ("Loading..." by default)
 * Content divider variants → props:
 *   Style  Single line | Dual line | Background fill → variant
 *   Type   Text | Heading | Button …                 → whatever `children` holds
 */
import * as React from 'react';
import { clsx } from 'clsx';

export interface LoadingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'line-spinner' | 'line-simple' | 'dot-circle';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Visible text under the spinner; also its accessible name. */
  label?: React.ReactNode;
  /** Hide the text visually but keep it for screen readers. */
  hideLabel?: boolean;
}

const DOTS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  return { cx: 12 + Math.cos(a) * 9, cy: 12 + Math.sin(a) * 9, o: 0.2 + (0.8 * i) / 7 };
});

export function LoadingIndicator({
  variant = 'line-spinner',
  size = 'md',
  label = 'Loading...',
  hideLabel = false,
  className,
  ...props
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      className={clsx('uui-loading', className)}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      <svg
        className="uui-loading__graphic"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        {variant === 'dot-circle' ? (
          DOTS.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r="2" opacity={d.o} />)
        ) : (
          <>
            {variant === 'line-spinner' && (
              <circle className="uui-loading__track" cx="12" cy="12" r="10" />
            )}
            <path className="uui-loading__arc" d="M12 2A10 10 0 0 1 22 12" />
          </>
        )}
      </svg>
      <span className={clsx('uui-loading__label', hideLabel && 'uui-sr-only')}>{label}</span>
    </div>
  );
}

export interface ContentDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'single-line' | 'dual-line' | 'background-fill';
}

/**
 * A horizontal divider, optionally carrying content (text such as "Today",
 * a heading, or buttons). With no children it is a plain separator.
 */
export function ContentDivider({
  variant = 'single-line',
  className,
  children,
  ...props
}: ContentDividerProps) {
  if (children === undefined || children === null) {
    return (
      <div
        role="separator"
        className={clsx('uui-divider', className)}
        data-variant={variant}
        data-empty="true"
        {...props}
      />
    );
  }
  return (
    <div className={clsx('uui-divider', className)} data-variant={variant} {...props}>
      {variant === 'single-line' && <span className="uui-divider__line" aria-hidden="true" />}
      <div className="uui-divider__content">{children}</div>
      {variant === 'single-line' && <span className="uui-divider__line" aria-hidden="true" />}
    </div>
  );
}
