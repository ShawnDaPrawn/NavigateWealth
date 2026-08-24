export { NotesModule } from './NotesModule';

// --- public API used by other modules and by code outside admin/modules ---
export { NotesAPI } from './api';
export { NoteCard } from './components/NoteCard';
export { NoteEditorModal } from './components/NoteEditorModal';
export { NotesSkeleton } from './components/NotesSkeleton';
export { NOTES_STALE_TIME, NOTE_COLOR_CONFIG } from './constants';
export {
  useClientNotes,
  useConvertNoteToTask,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from './hooks';
export type { CreateNoteInput, Note, UpdateNoteInput } from './types';
