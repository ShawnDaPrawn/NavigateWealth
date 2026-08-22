/**
 * The three status badges the legal-document workspace renders.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */
import { Badge } from '../../../../ui/badge';

export function StatusBadge({ value }: { value: string }) {
  const palette =
    value === 'published'
      ? 'bg-green-50 text-green-700 border-green-200'
      : value === 'draft'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <Badge variant="outline" className={palette}>
      {value}
    </Badge>
  );
}

export function RenderModeBadge({ value }: { value: string }) {
  const palette =
    value === 'legacy_resource'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-violet-50 text-violet-700 border-violet-200';
  return (
    <Badge variant="outline" className={palette}>
      {value === 'legacy_resource' ? 'Legacy-backed' : 'Versioned'}
    </Badge>
  );
}

export function MigrationBadge({ state }: { state: 'legacy-only' | 'draft-ready' | 'migrated' }) {
  const palette =
    state === 'migrated'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : state === 'draft-ready'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  const label =
    state === 'migrated' ? 'Migrated' : state === 'draft-ready' ? 'Draft Ready' : 'Legacy Only';

  return (
    <Badge variant="outline" className={palette}>
      {label}
    </Badge>
  );
}
