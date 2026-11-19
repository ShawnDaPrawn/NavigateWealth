/**
 * The line icons the "For Individuals" board draws, path for path. The board
 * was drawn with an earlier lucide release; the installed one redraws several
 * of these (the house, heart, trophy, graduation cap, building), so they are
 * kept here as the board has them rather than imported. All are decorative:
 * the text beside each says what it means.
 *
 * The page's content (forIndividualsPageData.ts, the solutions menu, the
 * trust facts) carries lucide icons; `IndividualsIcon` swaps each for the
 * board's cut of the same symbol.
 */
import type { ReactNode } from 'react';
import {
  Baby,
  Briefcase,
  Building,
  DollarSign,
  FileText,
  Globe,
  GraduationCap,
  HeadphonesIcon,
  Heart,
  Home,
  Monitor,
  Shield,
  Smartphone,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

export interface IndividualsIconProps {
  size: number;
  /** Defaults to currentColor. */
  stroke?: string;
  className?: string;
}

function Icon({
  size,
  stroke = 'currentColor',
  className,
  children,
}: IndividualsIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
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

export function ArrowIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

export function CheckIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function CalendarIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

export function CompassIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Icon>
  );
}

function UserIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

function BuildingIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
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
    </Icon>
  );
}

function BriefcaseIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </Icon>
  );
}

function ShieldIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Icon>
  );
}

function GlobeIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </Icon>
  );
}

function UserCheckIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </Icon>
  );
}

function HouseIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Icon>
  );
}

function HeartIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Icon>
  );
}

function BabyIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    </Icon>
  );
}

function GraduationIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </Icon>
  );
}

function TrophyIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Icon>
  );
}

function TrendingIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </Icon>
  );
}

function FileIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </Icon>
  );
}

function DollarIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  );
}

function PhoneDeviceIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <rect width="14" height="20" x="5" y="2" rx="2" />
      <path d="M12 18h.01" />
    </Icon>
  );
}

function MonitorIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </Icon>
  );
}

function HeadphonesBoardIcon(p: IndividualsIconProps) {
  return (
    <Icon {...p}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </Icon>
  );
}

const BOARD_ICONS = new Map<LucideIcon, (p: IndividualsIconProps) => ReactNode>([
  [User, UserIcon],
  [Building, BuildingIcon],
  [Briefcase, BriefcaseIcon],
  [Shield, ShieldIcon],
  [Globe, GlobeIcon],
  [UserCheck, UserCheckIcon],
  [Home, HouseIcon],
  [Heart, HeartIcon],
  [Baby, BabyIcon],
  [GraduationCap, GraduationIcon],
  [Trophy, TrophyIcon],
  [TrendingUp, TrendingIcon],
  [FileText, FileIcon],
  [DollarSign, DollarIcon],
  [Smartphone, PhoneDeviceIcon],
  [Monitor, MonitorIcon],
  [HeadphonesIcon, HeadphonesBoardIcon],
]);

/** The board's cut of a lucide icon the content names; the lucide icon itself otherwise. */
export function IndividualsIcon({ icon: Lucide, size }: { icon: LucideIcon; size: number }) {
  const Board = BOARD_ICONS.get(Lucide);
  return Board ? (
    <Board size={size} />
  ) : (
    <Lucide size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />
  );
}
