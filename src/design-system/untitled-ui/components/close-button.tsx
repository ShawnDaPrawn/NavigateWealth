/**
 * Untitled UI "Buttons/Button close X".
 *
 * Figma variants → props: Size sm | md | lg → size; Dark background → darkBackground.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { XClose } from '../icons/icons';

export interface CloseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  /** White icon and translucent hover, for use on dark or brand surfaces. */
  darkBackground?: boolean;
}

export const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(
  (
    {
      size = 'md',
      darkBackground = false,
      className,
      type = 'button',
      'aria-label': ariaLabel = 'Close',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      className={clsx('uui-close-button', className)}
      data-size={size}
      data-dark-background={darkBackground || undefined}
      {...props}
    >
      <XClose />
    </button>
  ),
);
CloseButton.displayName = 'CloseButton';
