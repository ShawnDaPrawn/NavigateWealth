/**
 * Keep an existing draft envelope's documents in step with the wizard's
 * Documents step.
 *
 * Once the wizard has created its draft, going Back to Documents and adding a
 * file used to do nothing: the reuse branch only re-saved the recipients, so
 * the new file was silently left out of the envelope. Files ADDED since the
 * draft was created are appended with the multi-document API. Files REMOVED
 * from the step are not deleted from the draft here (that would also delete
 * the fields placed on them); the caller tells the sender where to remove
 * them instead.
 */
import { esignApi } from './api';

export interface DraftDocumentSync {
  /** Files appended to the draft. */
  added: File[];
  /** Files that could not be appended. */
  failed: File[];
  /** Files uploaded earlier that are no longer in the Documents step. */
  removed: File[];
}

/** Which of the wizard's files are new, and which earlier uploads are gone. */
export function diffWizardFiles(
  current: readonly File[],
  uploaded: readonly File[],
): { added: File[]; removed: File[] } {
  return {
    added: current.filter((f) => !uploaded.includes(f)),
    removed: uploaded.filter((f) => !current.includes(f)),
  };
}

/** Append the files added since `uploaded` to the draft envelope. */
export async function syncDraftDocuments(
  envelopeId: string,
  current: readonly File[],
  uploaded: readonly File[],
): Promise<DraftDocumentSync> {
  const { added, removed } = diffWizardFiles(current, uploaded);
  const ok: File[] = [];
  const failed: File[] = [];
  for (const file of added) {
    try {
      await esignApi.addEnvelopeDocument(envelopeId, file, { displayName: file.name });
      ok.push(file);
    } catch {
      failed.push(file);
    }
  }
  return { added: ok, failed, removed };
}

/** A sentence for the sender about what happened, or null when nothing did. */
export function describeDraftDocumentSync(sync: DraftDocumentSync): string | null {
  const parts: string[] = [];
  if (sync.added.length > 0) {
    parts.push(
      `Added ${sync.added.length} document${sync.added.length === 1 ? '' : 's'} to the draft.`,
    );
  }
  if (sync.failed.length > 0) {
    parts.push(
      `Could not add ${sync.failed.map((f) => f.name).join(', ')} — try "Add document" in the field editor.`,
    );
  }
  if (sync.removed.length > 0) {
    parts.push(
      `${sync.removed.map((f) => f.name).join(', ')} ${sync.removed.length === 1 ? 'is' : 'are'} still on the draft — remove ${sync.removed.length === 1 ? 'it' : 'them'} from the document tabs in the field editor.`,
    );
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
