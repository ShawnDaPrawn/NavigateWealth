import { ChevronLeft } from 'lucide-react';

/** "‹ Back to …" link at the top of a page opened from a Resources tab. */
export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
