/**
 * Untitled UI v8.0 "Tag".
 *
 * Figma variants → props:
 *   Size      sm | md | lg                     → size
 *   Icon      Dot | Avatar                     → dot | avatarSrc
 *   Action    X close | Count | Text only      → onRemove | count
 *   Checkbox  True                             → checkbox (+ checked / onCheckedChange)
 * The Country (flag) icon is not exported yet.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { Check, XClose } from '../icons/icons';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  /** Leading status dot (Green 500). */
  dot?: boolean;
  /** Leading 16px avatar image. */
  avatarSrc?: string;
  /** Renders the trailing X; called when it is pressed. */
  onRemove?: () => void;
  removeLabel?: string;
  /** Trailing count chip. */
  count?: number;
  /** Leading checkbox, controlled with `checked` / `onCheckedChange`. */
  checkbox?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

// Figma strokes the tag X at 1.5px on a 10–14px icon: ~3 units in a 24 viewBox.
const TAG_ICON_STROKE = 3;

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      size = 'md',
      dot = false,
      avatarSrc,
      onRemove,
      removeLabel = 'Remove',
      count,
      checkbox = false,
      checked,
      onCheckedChange,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const leading = dot ? 'dot' : avatarSrc ? 'avatar' : undefined;
    const action = onRemove ? 'close' : count !== undefined ? 'count' : undefined;

    return (
      <span
        ref={ref}
        className={clsx('uui-tag', className)}
        data-size={size}
        data-leading={leading}
        data-action={action}
        {...props}
      >
        {checkbox && (
          <span className="uui-tag__check">
            <input
              type="checkbox"
              className="uui-tag__check-input"
              checked={checked}
              disabled={disabled}
              aria-label={typeof children === 'string' ? children : undefined}
              onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
            />
            <span className="uui-tag__check-box" aria-hidden="true">
              <Check strokeWidth={3.4} />
            </span>
          </span>
        )}
        {dot && (
          <svg className="uui-tag__dot" viewBox="0 0 8 8" aria-hidden="true" focusable="false">
            <circle cx="4" cy="4" r="3" fill="currentColor" />
          </svg>
        )}
        {avatarSrc && <img className="uui-tag__avatar" src={avatarSrc} alt="" />}
        {children}
        {count !== undefined && !onRemove && <span className="uui-tag__count">{count}</span>}
        {onRemove && (
          <button
            type="button"
            className="uui-tag__close"
            aria-label={removeLabel}
            onClick={onRemove}
            disabled={disabled}
          >
            <XClose strokeWidth={TAG_ICON_STROKE} />
          </button>
        )}
      </span>
    );
  },
);
Tag.displayName = 'Tag';
