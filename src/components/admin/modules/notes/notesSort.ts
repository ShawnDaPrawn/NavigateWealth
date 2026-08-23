/**
 * Note list sorter for the notes module. Moved verbatim from
 * NotesModule.tsx.
 */
import type { Note, NoteSortBy } from './types';

export function sortNotes(notes: Note[], sortBy: NoteSortBy): Note[] {
  return [...notes].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updatedAt':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}
