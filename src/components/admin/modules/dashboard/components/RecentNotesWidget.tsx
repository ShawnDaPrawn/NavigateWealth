/**
 * RecentNotesWidget — Dashboard widget showing recent notes
 *
 * Follows the TasksWidget structural pattern.
 * §7 — Presentation only
 * §8.3 — Stat card and widget standards
 */

import { Skeleton } from '../../../../ui/skeleton';
import { useAuth } from '../../../../auth/AuthContext';
import { useNotes } from '../../notes';
import { DsButton, DsCard, DsCardHead, DsMeta, DsState } from '../../../layout/page';
import type { Note } from '../../notes';
import { CardError } from './CardError';

interface RecentNotesWidgetProps {
  onModuleChange?: (module: string) => void;
  maxNotes?: number;
}

export function RecentNotesWidget({ onModuleChange, maxNotes = 5 }: RecentNotesWidgetProps) {
  const { user } = useAuth();
  const personnelId = user?.id || '';
  const { data: allNotes = [], isLoading, isError, refetch } = useNotes(personnelId);

  // Active (non-archived) notes, newest first.
  const recentNotes = allNotes.filter((n) => !n.isArchived).slice(0, maxNotes);
  const openNotes = () => onModuleChange?.('notes');

  return (
    <DsCard aria-label="Recent notes">
      <DsCardHead
        as="h3"
        title="Recent notes"
        actions={
          <>
            <DsButton size="sm" onClick={openNotes}>
              New note
            </DsButton>
            <DsButton size="sm" variant="ghost" onClick={openNotes}>
              View all
            </DsButton>
          </>
        }
      />
      {isLoading ? (
        <div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ds-todo-row">
              <div className="grow space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="ds-card-b">
          <CardError title="Couldn't load your notes" onRetry={() => void refetch()} />
        </div>
      ) : recentNotes.length === 0 ? (
        <DsState title="No notes yet" className="min-h-[200px] !p-6">
          Notes you create, or link to a client, show up here.
        </DsState>
      ) : (
        <div>
          {recentNotes.map((note) => (
            <NoteRow key={note.id} note={note} onClick={openNotes} />
          ))}
        </div>
      )}
    </DsCard>
  );
}

// ============================================================================
// INTERNAL: Note row in the widget
// ============================================================================

function NoteRow({ note, onClick }: { note: Note; onClick: () => void }) {
  const meta = [note.clientName || 'No client', formatRelativeTime(note.updatedAt)].join(' · ');
  return (
    <button type="button" onClick={onClick} className="ds-todo-row w-full text-left">
      <div className="grow">
        <b className="truncate">{note.title || 'Untitled note'}</b>
        <DsMeta>{meta}</DsMeta>
      </div>
    </button>
  );
}

// ============================================================================
// UTILITY: short date, as on the board ("3 Nov")
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
