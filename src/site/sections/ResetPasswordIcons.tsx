/**
 * The reset-password page's icons, drawn with the "ResetPassword" board's own
 * SVG paths. All are decorative: the text beside each one, or the button's
 * label, carries its meaning.
 */
import type { ReactNode } from 'react';

const PATHS = {
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </>
  ),
  checkCircle: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type ResetPasswordIconName = keyof typeof PATHS;

interface ResetPasswordIconProps {
  name: ResetPasswordIconName;
  size: number;
  /** A fixed colour, as the board gives some icons; otherwise the text colour. */
  stroke?: string;
  className?: string;
}

export function ResetPasswordIcon({
  name,
  size,
  stroke = 'currentColor',
  className,
}: ResetPasswordIconProps) {
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

/** The open ring the board draws beside a password rule not yet met. */
export function ResetPasswordRing({ className }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9AA3B2"
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
