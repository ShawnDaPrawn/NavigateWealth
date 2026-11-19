/**
 * The Resources board's icons, drawn with the board's own paths so they match
 * it line for line. All are decorative: whatever they sit beside says what
 * they mean.
 */
import type { ReactElement, SVGProps } from 'react';

type IconName =
  | 'search'
  | 'close'
  | 'arrowRight'
  | 'chevronDown'
  | 'fileText'
  | 'download'
  | 'refresh'
  | 'externalLink'
  | 'spinner'
  | 'compass';

interface ResourcesIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

const PATHS: Record<Exclude<IconName, 'compass'>, ReactElement> = {
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  fileText: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  externalLink: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 1 1-6.22-8.56" />,
};

export function ResourcesIcon({ name, size = 15, ...rest }: ResourcesIconProps) {
  if (name === 'compass') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        stroke="#C5CAD3"
        strokeWidth={1}
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        <circle cx="24" cy="24" r="19" />
        <path d="M24 7 L27 21 L41 24 L27 27 L24 41 L21 27 L7 24 L21 21 Z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
