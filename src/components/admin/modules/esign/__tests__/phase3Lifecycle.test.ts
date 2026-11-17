import { describe, expect, it, vi, beforeEach } from 'vitest';

const addEnvelopeDocument = vi.fn();
vi.mock('../api', () => ({
  esignApi: { addEnvelopeDocument: (...a: unknown[]) => addEnvelopeDocument(...a) },
}));

import { expiryCell } from '../types';
import { describeDraftDocumentSync, diffWizardFiles, syncDraftDocuments } from '../draftDocuments';

const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

describe('expiryCell — the envelope list Expires column', () => {
  it('shows nothing for envelopes that cannot expire', () => {
    // A completed envelope or a draft read as a red "Expired".
    for (const status of ['completed', 'draft', 'voided', 'declined']) {
      expect(expiryCell(status, inDays(-5))).toEqual({ label: '--', tone: 'muted' });
    }
  });

  it('shows days left, soon, and expired for envelopes out for signature', () => {
    expect(expiryCell('sent', inDays(10))).toEqual({ label: '10d', tone: 'muted' });
    expect(expiryCell('viewed', inDays(2))).toEqual({ label: '2d', tone: 'warning' });
    expect(expiryCell('partially_signed', inDays(-1))).toEqual({
      label: 'Expired',
      tone: 'danger',
    });
    expect(expiryCell('sent', undefined)).toEqual({ label: '--', tone: 'muted' });
  });
});

describe('draft documents — going back to the Documents step', () => {
  const a = new File(['a'], 'a.pdf');
  const b = new File(['b'], 'b.pdf');
  const c = new File(['c'], 'c.pdf');

  beforeEach(() => addEnvelopeDocument.mockReset());

  it('works out what was added and removed since the upload', () => {
    expect(diffWizardFiles([a, c], [a, b])).toEqual({ added: [c], removed: [b] });
  });

  it('appends only the new files to the draft, and reports a failure', async () => {
    // New files were silently ignored once the draft existed.
    addEnvelopeDocument.mockImplementation(async (_id: string, file: File) => {
      if (file === c) throw new Error('too large');
      return {};
    });
    const d = new File(['d'], 'd.pdf');
    const sync = await syncDraftDocuments('env-1', [a, c, d], [a]);
    expect(addEnvelopeDocument).toHaveBeenCalledTimes(2);
    expect(sync).toEqual({ added: [d], failed: [c], removed: [] });
    expect(describeDraftDocumentSync(sync)).toMatch(/Added 1 document.*Could not add c\.pdf/);
  });

  it('says nothing when nothing changed', async () => {
    const sync = await syncDraftDocuments('env-1', [a], [a]);
    expect(addEnvelopeDocument).not.toHaveBeenCalled();
    expect(describeDraftDocumentSync(sync)).toBeNull();
  });
});
