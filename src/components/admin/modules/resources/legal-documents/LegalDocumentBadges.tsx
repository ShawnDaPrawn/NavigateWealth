/**
 * The three status badges the legal-document workspace renders.
 *
 * Split out of `LegalDocumentsManager.tsx` (1,556 lines), which held the whole
 * workspace — helpers, badges, lists, the draft editor and the shell — in one
 * file. Each piece was already a self-contained function with its own props;
 * this only changes which file it lives in.
 */


const sentence = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v);

export function StatusBadge({ value }: { value: string }) {
  const tone = value === 'published' ? 'ok' : value === 'draft' ? 'warn' : '';
  return <span className={`ds-pill ${tone}`}>{sentence(value)}</span>;
}

export function RenderModeBadge({ value }: { value: string }) {
  return value === 'legacy_resource' ? (
    <span className="ds-pill info">Legacy-backed</span>
  ) : (
    <span className="ds-pill brand">Versioned</span>
  );
}

export function MigrationBadge({ state }: { state: 'legacy-only' | 'draft-ready' | 'migrated' }) {
  const tone = state === 'migrated' ? 'ok' : state === 'draft-ready' ? 'warn' : '';
  const label =
    state === 'migrated' ? 'Migrated' : state === 'draft-ready' ? 'Draft ready' : 'Legacy only';
  return <span className={`ds-pill ${tone}`}>{label}</span>;
}

/** RE-Legal list: one pill for how the document is served and how far its migration is. */
export function ModePill({ renderMode, draftReady }: { renderMode: string; draftReady: boolean }) {
  if (renderMode === 'versioned_document') return <span className="ds-pill brand">Versioned</span>;
  return draftReady ? (
    <span className="ds-pill warn">Legacy · draft ready</span>
  ) : (
    <span className="ds-pill">Legacy only</span>
  );
}
