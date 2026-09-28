/**
 * Untitled UI "Toggle" over "_Toggle base".
 *
 * Figma variants → props:
 *   Type     Default | Slim            → type
 *   Size     sm | md                   → size
 *   Pressed  True                      → checked / defaultChecked
 *   State    Disabled                  → disabled
 *            Hover / Focus             → CSS
 *   Text, Supporting text              → label, hint
 *
 * Rendered as a <button role="switch">, controlled or uncontrolled.
 */
import * as React from 'react';
import { clsx } from 'clsx';

export interface ToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'onChange' | 'defaultChecked'
> {
  type?: 'default' | 'slim';
  size?: 'sm' | 'md';
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  /** Supporting text under the label. */
  hint?: React.ReactNode;
  /** Class for the outer wrapper. */
  wrapperClassName?: string;
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      type = 'default',
      size = 'sm',
      checked,
      defaultChecked = false,
      onCheckedChange,
      label,
      hint,
      wrapperClassName,
      className,
      id,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState(defaultChecked);
    const isOn = checked ?? uncontrolled;
    const autoId = React.useId();
    const buttonId = id ?? autoId;
    const labelId = `${buttonId}-label`;
    const hintId = `${buttonId}-hint`;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (checked === undefined) setUncontrolled(!isOn);
      onCheckedChange?.(!isOn);
    };

    return (
      <div className={clsx('uui-toggle', wrapperClassName)} data-type={type} data-size={size}>
        <button
          ref={ref}
          id={buttonId}
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-labelledby={label ? labelId : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={clsx('uui-toggle__track', className)}
          onClick={handleClick}
          {...props}
        >
          <span className="uui-toggle__knob" />
        </button>
        {(label || hint) && (
          <span className="uui-toggle__text">
            {label && (
              <label className="uui-toggle__label" id={labelId} htmlFor={buttonId}>
                {label}
              </label>
            )}
            {hint && (
              <span className="uui-toggle__hint" id={hintId}>
                {hint}
              </span>
            )}
          </span>
        )}
      </div>
    );
  },
);
Toggle.displayName = 'Toggle';
