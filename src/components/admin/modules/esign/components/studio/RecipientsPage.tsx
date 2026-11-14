/**
 * The studio's recipients, as a page of its own (design: ESF-T-Recipients).
 *
 * Edits are kept on the page and saved once, when the adviser goes back to
 * the fields ("Done" or "‹ Back to fields"). A failed save keeps the page
 * open with the changes intact.
 */
import { useState } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import type { SignerFormData } from '../../types';
import { Button } from '../../../../../ui/button';
import { PageHeader } from '../../../../layout/page';
import { RecipientsManager } from '../RecipientsManager';

interface RecipientsPageProps {
  signers: SignerFormData[];
  /** Saves the recipients; resolves false when the save failed. */
  onSave: (next: SignerFormData[]) => Promise<boolean>;
  /** Returns to the fields. */
  onClose: () => void;
}

export function RecipientsPage({ signers, onSave, onClose }: RecipientsPageProps) {
  const [draft, setDraft] = useState<SignerFormData[]>(signers);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 p-6 lg:p-8">
      <button
        type="button"
        onClick={() => void finish()}
        disabled={saving}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to fields
      </button>
      <PageHeader
        title="Recipients"
        description="Reorder, add or remove recipients without leaving the studio. Changes save automatically when you return to the fields."
        actions={
          <Button onClick={() => void finish()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Done'
            )}
          </Button>
        }
      />
      <div className="rounded-xl border border-nw-line bg-white p-5">
        <RecipientsManager
          signers={draft}
          onChange={(next) => {
            setDraft(next);
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
