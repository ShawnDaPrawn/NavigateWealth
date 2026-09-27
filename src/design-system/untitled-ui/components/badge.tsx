/**
 * Untitled UI "Badge".
 *
 * Figma variants → props:
 *   Type   Pill color | Badge color | Badge modern             → type
 *   Size   sm | md | lg                                        → size
 *   Color  Gray | Brand | Error | Warning | Success | Gray blue
 *          (a.k.a. Blue gray) | Blue light | Blue | Indigo |
 *          Purple | Pink | Orange                              → color
 *   Icon   Dot                                                 → dot
 *          Icon leading / Icon trailing                        → iconLeading / iconTrailing
 *          X close                                             → onRemove
 *          Only                                                → iconLeading with no children
 * The Country, Avatar and Badge group variants are not exported yet.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { XClose, type UntitledIcon } from '../icons/icons';

export type BadgeType = 'pill-color' | 'badge-color' | 'badge-modern';
export type BadgeSize = 'sm' | 'md' | 'lg';
export type BadgeColor =
  | 'gray'
  | 'brand'
  | 'error'
  | 'warning'
  | 'success'
  | 'gray-blue'
  | 'blue-light'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'orange';

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  type?: BadgeType;
  size?: BadgeSize;
  color?: BadgeColor;
  /** Leading status dot in the badge's accent colour. */
  dot?: boolean;
  iconLeading?: UntitledIcon;
  iconTrailing?: UntitledIcon;
  /** Renders the trailing X; called when it is pressed. */
  onRemove?: () => void;
  /** Accessible name for the X; defaults to "Remove". */
  removeLabel?: string;
}

// Figma draws badge icons at 12px with a 1.5px stroke: 3 units in a 24 viewBox.
const BADGE_ICON_STROKE = 3;

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      type = 'pill-color',
      size = 'md',
      color = 'gray',
      dot = false,
      iconLeading: IconLeading,
      iconTrailing: IconTrailing,
      onRemove,
      removeLabel = 'Remove',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const iconOnly =
      !!IconLeading && (children === undefined || children === null || children === '');
    const leading = dot ? 'dot' : IconLeading && !iconOnly ? 'icon' : undefined;
    const trailing = onRemove ? 'close' : IconTrailing ? 'icon' : undefined;

    return (
      <span
        ref={ref}
        className={clsx('uui-badge', className)}
        data-type={type}
        data-size={size}
        data-color={color === 'gray' ? undefined : color}
        data-leading={leading}
        data-trailing={trailing}
        data-icon-only={iconOnly || undefined}
        {...props}
      >
        {dot && (
          <svg className="uui-badge__dot" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
            <circle cx="4" cy="4" r="3" fill="currentColor" />
          </svg>
        )}
        {IconLeading && <IconLeading strokeWidth={BADGE_ICON_STROKE} />}
        {children}
        {!onRemove && IconTrailing && <IconTrailing strokeWidth={BADGE_ICON_STROKE} />}
        {onRemove && (
          <button
            type="button"
            className="uui-badge__close"
            aria-label={removeLabel}
            onClick={onRemove}
          >
            <XClose strokeWidth={BADGE_ICON_STROKE} />
          </button>
        )}
      </span>
    );
  },
);
Badge.displayName = 'Badge';
