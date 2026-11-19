/**
 * The newsletter status pages' icons, drawn exactly as the "Newsletter
 * Confirm", "Newsletter Unsubscribe" and "Newsletter Click" boards draw them.
 *
 * They are the boards' own SVG paths rather than lucide-react components: the
 * check-in-a-circle is an older lucide drawing that the installed lucide-react
 * draws differently, and the rest stay here so every icon on these pages
 * comes from one place. All are decorative; the heading or the text beside
 * each one carries its meaning.
 */
import type { ReactNode } from 'react';

const PATHS = {
  spinner: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
  check: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  mailCheck: (
    <>
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m16 19 2 2 4-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  cross: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  /** Not on the boards: the design system's field-error mark, for problems. */
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NewsletterStatusIconName = keyof typeof PATHS;

/** The boards' fixed stroke colours. */
export const ICON_INK = '#0D1626';
export const ICON_SUCCESS = '#15803D';
export const ICON_WARN = '#B45309';
export const ICON_DANGER = '#B91C1C';
export const ICON_TEXT = '#3D4556';

interface NewsletterStatusIconProps {
  name: NewsletterStatusIconName;
  size: number;
  /** A fixed colour, as the boards give their badges; otherwise the text colour. */
  stroke?: string;
  className?: string;
}

export function NewsletterStatusIcon({
  name,
  size,
  stroke = 'currentColor',
  className,
}: NewsletterStatusIconProps) {
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
      {PATHS[name]}
    </svg>
  );
}
