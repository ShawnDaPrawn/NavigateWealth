/**
 * Untitled UI v8.0 "Tooltip".
 *
 * Figma variants → props:
 *   Theme            Dark | Light                   → theme
 *   Supporting text  True                           → hint
 *   Arrow            None | Bottom center | Top center | Left | Right
 *                    (and bottom left/right)        → arrow + placement
 *
 * Wraps its trigger and shows on hover or keyboard focus (CSS only), with the
 * trigger described by the tooltip for screen readers. Pass `open` to force it.
 */
import * as React from 'react';
import { clsx } from 'clsx';

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  title: React.ReactNode;
  hint?: React.ReactNode;
  theme?: 'dark' | 'light';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  arrow?: boolean;
  /** Keep it visible regardless of hover or focus. */
  open?: boolean;
  /** The trigger. It should be focusable (a button or link). */
  children: React.ReactElement;
}

export function Tooltip({
  title,
  hint,
  theme = 'dark',
  placement = 'top',
  arrow = true,
  open,
  children,
  className,
  ...props
}: TooltipProps) {
  const id = React.useId();
  const trigger = React.cloneElement(
    children as React.ReactElement<{ 'aria-describedby'?: string }>,
    {
      'aria-describedby': id,
    },
  );

  return (
    <span className={clsx('uui-tooltip-anchor', className)} {...props}>
      {trigger}
      <span
        role="tooltip"
        id={id}
        className="uui-tooltip"
        data-theme={theme}
        data-placement={placement}
        data-arrow={arrow || undefined}
        data-has-hint={hint ? true : undefined}
        data-open={open || undefined}
      >
        {title}
        {hint && <span className="uui-tooltip__hint">{hint}</span>}
      </span>
    </span>
  );
}
