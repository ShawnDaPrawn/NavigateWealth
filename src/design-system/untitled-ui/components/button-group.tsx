/**
 * Untitled UI v8.0 "Button group" over "_Button group base".
 *
 * Figma variants → props:
 *   Size     sm | md                        → size (on ButtonGroup)
 *   Current  True                           → isCurrent (aria-pressed)
 *   Icon     Leading | Only | Dot           → iconLeading | iconLeading with no label | dot
 *   State    Disabled                       → disabled; Hover / Focused → CSS
 */
import * as React from 'react';
import { clsx } from 'clsx';

import type { UntitledIcon } from '../icons/icons';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md';
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ size = 'md', className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={clsx('uui-button-group', className)}
      data-size={size}
      {...props}
    />
  ),
);
ButtonGroup.displayName = 'ButtonGroup';

export interface ButtonGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The selected item ("Current=True"); exposed as aria-pressed. */
  isCurrent?: boolean;
  iconLeading?: UntitledIcon;
  /** Leading Green 500 status dot. */
  dot?: boolean;
}

export const ButtonGroupItem = React.forwardRef<HTMLButtonElement, ButtonGroupItemProps>(
  (
    { isCurrent, iconLeading: Icon, dot = false, type = 'button', className, children, ...props },
    ref,
  ) => {
    const iconOnly = !!Icon && (children === undefined || children === null || children === '');
    return (
      <button
        ref={ref}
        type={type}
        className={clsx('uui-button-group__item', className)}
        aria-pressed={isCurrent === undefined ? undefined : isCurrent}
        data-leading={dot ? 'dot' : Icon && !iconOnly ? 'icon' : undefined}
        data-icon-only={iconOnly || undefined}
        {...props}
      >
        {dot && (
          <svg
            className="uui-button-group__dot"
            viewBox="0 0 10 10"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </svg>
        )}
        {Icon && <Icon />}
        {children}
      </button>
    );
  },
);
ButtonGroupItem.displayName = 'ButtonGroupItem';
