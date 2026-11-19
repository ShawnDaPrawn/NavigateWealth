/**
 * The verification-success page's icons, drawn exactly as the
 * "VerificationSuccess" board draws them: its own SVG paths at its stroke
 * width. All are decorative; the text beside each one carries its meaning.
 * The lock replaces the live page's 🔒 emoji, as the board does.
 */
import type { ReactNode } from 'react';

const PATHS = {
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type VerificationSuccessIconName = keyof typeof PATHS;

interface VerificationSuccessIconProps {
  name: VerificationSuccessIconName;
  size: number;
  /** A fixed colour, as the board gives the lock; otherwise the text colour. */
  stroke?: string;
  className?: string;
}

export function VerificationSuccessIcon({
  name,
  size,
  stroke = 'currentColor',
  className,
}: VerificationSuccessIconProps) {
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

/**
 * The board's success badge: a pale green disc, a dotted ring and a tick that
 * draws itself in.
 */
export function VerificationSuccessBadge() {
  return (
    <svg width={84} height={84} viewBox="0 0 84 84" aria-hidden="true" focusable="false">
      <circle cx="42" cy="42" r="40" fill="#F0FDF4" stroke="#BBF7D0" />
      <circle
        cx="42"
        cy="42"
        r="34"
        fill="none"
        stroke="#4ADE80"
        strokeWidth={5}
        strokeDasharray="1 8.97"
      />
      <path
        className="nwvs-draw"
        d="M30 43 l8 8 l16 -18"
        fill="none"
        stroke="#15803D"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
