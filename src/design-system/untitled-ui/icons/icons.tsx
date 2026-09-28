/* eslint-disable react-refresh/only-export-components -- the icons are components built by createIcon(), which the rule cannot see through. */
/**
 * The Untitled UI icons the base components need, with path data exported
 * from the Figma file's Icons page. Every Untitled UI icon is a single
 * 24x24 stroke path (width 2, round caps and joins), so one factory covers
 * them all; the full 1,173-icon set is a later export (see ../README.md).
 *
 * Size an icon with CSS — the components set width and height on
 * `.uui-icon`. Pass `strokeWidth` (in 24-unit viewBox terms) to match Figma
 * where an icon is drawn smaller than its natural stroke would suggest.
 */
import * as React from 'react';

export type UntitledIconProps = React.SVGProps<SVGSVGElement>;
export type UntitledIcon = React.ComponentType<UntitledIconProps>;

function createIcon(name: string, d: string): UntitledIcon {
  const Icon = React.forwardRef<SVGSVGElement, UntitledIconProps>(
    ({ className, strokeWidth = 2, ...props }, ref) => (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={className ? `uui-icon ${className}` : 'uui-icon'}
        {...props}
      >
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  );
  Icon.displayName = name;
  return Icon;
}

export const XClose = createIcon('XClose', 'M18 6L6 18M6 6L18 18');
export const Check = createIcon('Check', 'M20 6L9 17L4 12');
export const Minus = createIcon('Minus', 'M5 12H19');
export const Plus = createIcon('Plus', 'M12 5V19M5 12H19');
export const ArrowRight = createIcon('ArrowRight', 'M5 12H19M12 19L19 12L12 5');
export const ArrowUp = createIcon('ArrowUp', 'M12 19V5M19 12L12 5L5 12');
export const ChevronDown = createIcon('ChevronDown', 'M6 9L12 15L18 9');
export const Placeholder = createIcon(
  'Placeholder',
  'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
);
export const User01 = createIcon(
  'User01',
  'M20 21C20 19.6044 20 18.9067 19.8278 18.3389C19.44 17.0605 18.4395 16.06 17.1611 15.6722C16.5933 15.5 15.8956 15.5 14.5 15.5H9.5C8.10444 15.5 7.40665 15.5 6.83886 15.6722C5.56045 16.06 4.56004 17.0605 4.17224 18.3389C4 18.9067 4 19.6044 4 21M16.5 7.5C16.5 9.98528 14.4853 12 12 12C9.51472 12 7.5 9.98528 7.5 7.5C7.5 5.01472 9.51472 3 12 3C14.4853 3 16.5 5.01472 16.5 7.5Z',
);
export const HelpCircle = createIcon(
  'HelpCircle',
  'M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13M12 17H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z',
);
export const AlertCircle = createIcon(
  'AlertCircle',
  'M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z',
);
export const Mail01 = createIcon(
  'Mail01',
  'M2 7L10.1649 12.7154C10.8261 13.1783 11.1567 13.4097 11.5163 13.4993C11.8339 13.5785 12.1661 13.5785 12.4837 13.4993C12.8433 13.4097 13.1739 13.1783 13.8351 12.7154L22 7M6.8 20H17.2C18.8802 20 19.7202 20 20.362 19.673C20.9265 19.3854 21.3854 18.9265 21.673 18.362C22 17.7202 22 16.8802 22 15.2V8.8C22 7.11984 22 6.27976 21.673 5.63803C21.3854 5.07354 20.9265 4.6146 20.362 4.32698C19.7202 4 18.8802 4 17.2 4H6.8C5.11984 4 4.27976 4 3.63803 4.32698C3.07354 4.6146 2.6146 5.07354 2.32698 5.63803C2 6.27976 2 7.11984 2 8.8V15.2C2 16.8802 2 17.7202 2.32698 18.362C2.6146 18.9265 3.07354 19.3854 3.63803 19.673C4.27976 20 5.11984 20 6.8 20Z',
);

/**
 * "Buttons/Button loading icon": a 30%-opacity track with a quarter arc,
 * drawn in the current text colour and spun by `.uui-spinner`.
 */
export const Spinner = React.forwardRef<SVGSVGElement, UntitledIconProps>(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={['uui-icon uui-spinner', className].filter(Boolean).join(' ')}
      {...props}
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path
        d="M10 1C11.1819 1 12.3522 1.23279 13.4442 1.68508C14.5361 2.13738 15.5282 2.80031 16.364 3.63604C17.1997 4.47177 17.8626 5.46392 18.3149 6.55585C18.7672 7.64778 19 8.8181 19 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
);
Spinner.displayName = 'Spinner';
