/**
 * The Components tab: the central component library (Untitled UI, in the
 * Navigate Wealth theme) that the site will be wired up against, and, one click
 * away, the shadcn/ui components the site uses today.
 */
import { useState } from 'react';
import { ComponentsTab } from './ComponentsTab';
import { DesignSystemLibrary } from './DesignSystemLibrary';

const VIEWS = [
  { id: 'library', label: 'Component library' },
  { id: 'current', label: 'Components in use today' },
] as const;

type View = (typeof VIEWS)[number]['id'];

export function ComponentsLibraryTab() {
  const [view, setView] = useState<View>('library');

  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label="Which components to show"
        className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1"
      >
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={
              view === id
                ? 'rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-primary shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'library' ? <DesignSystemLibrary /> : <ComponentsTab />}
    </div>
  );
}
