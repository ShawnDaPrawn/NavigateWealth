import type { ReactNode } from 'react';

interface NoAccessProps {
  /** The module or record, e.g. "Personnel". */
  what: string;
  /** Who can grant it. */
  howToGetAccess?: ReactNode;
  /** e.g. a "Back to Dashboard" button. */
  action?: ReactNode;
}

/** Shown when someone opens a module or record their role doesn't allow (design system: NoAccess). */
export function NoAccess({
  what,
  howToGetAccess = 'Ask a super admin to add it under Personnel › Permissions.',
  action,
}: NoAccessProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-nw-line bg-white px-6 py-12 text-center">
      <span className="rounded-full bg-nw-bg px-2.5 py-0.5 text-xs font-medium text-nw-text-2">
        No access
      </span>
      <h2 className="text-lg font-semibold text-nw-ink">You don&apos;t have access to {what}</h2>
      <p className="max-w-md text-sm text-nw-text-3">{howToGetAccess}</p>
      {action}
    </div>
  );
}
