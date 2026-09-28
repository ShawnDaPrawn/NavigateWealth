/**
 * Untitled UI "Buttons/Button" and "Buttons/Button destructive".
 *
 * Figma variants → props:
 *   Size        xs | sm | md | lg | xl                  → size (xs is new in v8.0)
 *   Hierarchy   Primary | Secondary | Tertiary |
 *               Link color | Link gray                  → hierarchy
 *   State       Loading                                 → isLoading
 *               Disabled                                → disabled
 *               Hover / Focused                         → CSS (:hover, :focus-visible)
 *   Icon only   True                                    → iconLeading with no children
 *   (destructive component set)                         → destructive
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { Spinner, type UntitledIcon } from '../icons/icons';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonHierarchy = 'primary' | 'secondary' | 'tertiary' | 'link-color' | 'link-gray';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  hierarchy?: ButtonHierarchy;
  /** Uses the error palette ("Buttons/Button destructive"). */
  destructive?: boolean;
  iconLeading?: UntitledIcon;
  iconTrailing?: UntitledIcon;
  /** Shows the spinner, blocks clicks and sets aria-busy. */
  isLoading?: boolean;
  /** Label while loading; defaults to the normal label. */
  loadingText?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      size = 'md',
      hierarchy = 'primary',
      destructive = false,
      iconLeading: IconLeading,
      iconTrailing: IconTrailing,
      isLoading = false,
      loadingText,
      disabled,
      type = 'button',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const label = isLoading && loadingText !== undefined ? loadingText : children;
    const iconOnly = label === undefined || label === null || label === '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={clsx('uui-button', className)}
        data-size={size}
        data-hierarchy={hierarchy}
        data-destructive={destructive || undefined}
        data-icon-only={iconOnly || undefined}
        data-loading={isLoading || undefined}
        {...props}
      >
        {isLoading ? <Spinner /> : IconLeading && <IconLeading />}
        {!iconOnly && <span className="uui-button__label">{label}</span>}
        {!isLoading && IconTrailing && <IconTrailing />}
      </button>
    );
  },
);
Button.displayName = 'Button';
