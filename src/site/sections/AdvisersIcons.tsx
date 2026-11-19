/**
 * The For Advisers board's icons whose shapes the installed lucide-react has
 * since redrawn (trophy, award, hand-heart, building, file-text). Drawn here
 * as the board draws them, so the page matches it line for line; the icons
 * lucide still draws the same way come from lucide-react. All are decorative:
 * the text beside each says what it means.
 */
import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * What every icon on the page is drawn with: these board icons and lucide's
 * alike, so a section can take either. The stroke width and aria-hidden are
 * fixed here (1.75, hidden) and ignored if passed.
 */
export interface AdvisersIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: 'true';
}

export type AdvisersIconType = ComponentType<AdvisersIconProps> | LucideIcon;

function BoardIcon({
  size = 24,
  className,
  children,
}: Pick<AdvisersIconProps, 'size' | 'className'> & { children: ReactNode }) {
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
      className={className}
    >
      {children}
    </svg>
  );
}

export function TrophyIcon(props: AdvisersIconProps) {
  return (
    <BoardIcon {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </BoardIcon>
  );
}

export function AwardIcon(props: AdvisersIconProps) {
  return (
    <BoardIcon {...props}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </BoardIcon>
  );
}

export function HandHeartIcon(props: AdvisersIconProps) {
  return (
    <BoardIcon {...props}>
      <path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16" />
      <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 15 6 6" />
      <path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z" />
    </BoardIcon>
  );
}

export function BuildingIcon(props: AdvisersIconProps) {
  return (
    <BoardIcon {...props}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </BoardIcon>
  );
}

export function FileTextIcon(props: AdvisersIconProps) {
  return (
    <BoardIcon {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </BoardIcon>
  );
}
