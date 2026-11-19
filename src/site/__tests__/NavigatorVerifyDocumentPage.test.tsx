/**
 * The redesigned document verification page, reached the way production
 * reaches it: VerifyDocumentPage with the design switch on lazy-loads
 * NavigatorVerifyDocumentPage. Covers what the redesign must not lose — a
 * file accepted only by its ".pdf" name, hashed with SHA-256 in the browser,
 * only that digest sent through the live page's own call (POST
 * /esign/verify-hash { hash }), every outcome and message as the live page
 * words it — and what the board adds (the computed fingerprint, an amber
 * result for unfinished signing, a refused file answered under the upload
 * area).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/api/client')>()),
  api,
}));

const { VerifyDocumentPage } = await import('../../components/pages/VerifyDocumentPage');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8').replace(/\s+/g, ' ');
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/VerifyDocumentPage.tsx');
const opsSource = read('../../components/admin/modules/esign/api/opsApi.ts');

const PDF_BYTES = '%PDF-1.4 signed record of advice';
const PDF_HASH = createHash('sha256').update(PDF_BYTES).digest('hex');

function pdf(name = 'record-of-advice-signed.pdf', body = PDF_BYTES) {
  return new File([body], name, { type: 'application/pdf' });
}

const SIGNED =
  'Document verified. This is an authentic signed and sealed document from Navigate Wealth.';
const ORIGINAL =
  'Document verified. This matches the original uploaded document. The signed copy may have additional content (signatures, certificate).';
const INCOMPLETE = 'Document found but envelope status is "sent". Signing may not be complete.';
const NOT_FOUND =
  'No matching document found. The file may have been modified after signing, or it was not signed through this platform.';

function verified(over: Record<string, unknown> = {}) {
  return {
    verified: true,
    matchType: 'signed',
    envelope: {
      id: 'env-1',
      title: 'Record of Advice',
      status: 'completed',
      completedAt: '2026-11-13T15:47:00',
      createdAt: '2026-11-10T10:12:00',
    },
    signers: [
      { name: 'Your adviser', role: 'Adviser', status: 'signed', signedAt: '2026-11-11T09:30:00' },
      { name: 'Thandi Mokoena', role: 'Client', status: 'signed', signedAt: null },
    ],
    message: SIGNED,
    ...over,
  };
}

/** The live page's date format. */
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/verify-document']}>
      <VerifyDocumentPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function fileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function upload(file: File) {
  await act(async () => {
    fireEvent.change(fileInput(), { target: { files: [file] } });
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('Navigator document verification page', () => {
  it("draws the board's page with one H1 and links only to the site", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Verify Document Integrity');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByText(
        'Upload a PDF document signed through Navigate Wealth to confirm it has not been tampered with since signing.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Navigate Wealth home' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Back to site' }).getAttribute('href')).toBe('/');
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText('Document Verification')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Upload Document' })).toBeTruthy();
    expect(screen.getByText('Drop your PDF here or click to browse')).toBeTruthy();
    expect(fileInput().getAttribute('accept')).toBe('.pdf,application/pdf');
    expect(liveSource).toContain('accept=".pdf,application/pdf"');

    const how = screen.getByRole('region', { name: 'How it works' });
    expect(
      within(how)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      '1UploadDrop your signed PDF into the verification area',
      '2HashA SHA-256 fingerprint is computed locally in your browser',
      '3VerifyThe fingerprint is matched against our signing records',
    ]);
    expect(
      screen.getByText(
        'Your file never leaves your device. Only the computed hash is sent for verification.',
      ),
    ).toBeTruthy();
    // Every word above is the live page's.
    for (const words of [
      'Verify Document Integrity',
      'Drop your PDF here or click to browse',
      'PDF files only',
      'The file is hashed locally — it is never uploaded to our servers.',
      'A SHA-256 fingerprint is computed locally in your browser',
      'Your file never leaves your device. Only the computed hash is sent for verification.',
    ]) {
      expect(liveSource).toContain(words);
    }
  });

  it('turns down a file that is not a PDF by its name, as live, without a request', async () => {
    await renderPage();
    await upload(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Please upload a PDF file.');
    expect(liveSource).toContain("setErrorMsg('Please upload a PDF file.')");
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    // The same check as live: the name decides, not the type a browser reports.
    expect(liveSource).toContain("if (!file.name.toLowerCase().endsWith('.pdf'))");
    await upload(new File(['%PDF'], 'scan.PDF.txt', { type: 'application/pdf' }));
    expect(screen.getByRole('alert').textContent).toBe('Please upload a PDF file.');
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 2, name: 'Upload Document' })).toBeTruthy();
  });

  it('hashes the file in the browser and sends only the SHA-256 digest, as live', async () => {
    api.post.mockResolvedValue(verified());
    await renderPage();
    await upload(pdf('Record-Of-Advice.PDF'));
    await screen.findByText('Document Verified');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/esign/verify-hash', { hash: PDF_HASH });
    // The live page sends it through the same call.
    expect(liveSource).toContain('await esignApi.verifyDocumentHash(hash)');
    expect(opsSource).toContain("return api.post('/esign/verify-hash', { hash });");
    // The board shows the fingerprint that was sent.
    expect(screen.getByText('Fingerprint · SHA-256')).toBeTruthy();
    expect(screen.getByText(PDF_HASH)).toBeTruthy();
  });

  it('takes a dropped file the same way', async () => {
    api.post.mockResolvedValue(verified());
    await renderPage();
    const area = screen.getByText('Drop your PDF here or click to browse').closest('label')!;
    fireEvent.dragOver(area);
    expect(area.className).toContain('nwvd-drop--over');
    fireEvent.dragLeave(area);
    expect(area.className).not.toContain('nwvd-drop--over');
    await act(async () => {
      fireEvent.drop(area, { dataTransfer: { files: [pdf()] } });
    });
    await screen.findByText('Document Verified');
    expect(api.post).toHaveBeenCalledWith('/esign/verify-hash', { hash: PDF_HASH });
  });

  it('shows the working state while the check is out', async () => {
    api.post.mockReturnValue(new Promise(() => {}));
    await renderPage();
    await upload(pdf());
    await screen.findByText('Checking against signed documents...');
    expect(screen.getByRole('heading', { level: 2, name: 'Verifying...' })).toBeTruthy();
    expect(screen.getByText('record-of-advice-signed.pdf (32.0 B)')).toBeTruthy();
    expect(liveSource).toContain("'Checking against signed documents...'");
    expect(liveSource).toContain("'Computing document fingerprint...'");
  });

  it('shows a verified signed copy with its details, signers and file', async () => {
    api.post.mockResolvedValue(verified());
    await renderPage();
    await upload(pdf());
    await screen.findByText('Document Verified');
    expect(screen.getByRole('heading', { level: 2, name: 'Verification Result' })).toBeTruthy();
    expect(screen.getByText('Signed Copy')).toBeTruthy();
    expect(screen.getByText(SIGNED)).toBeTruthy();
    expect(screen.getByText('Record of Advice')).toBeTruthy();
    // The status as live capitalises it, beside the "Completed" date label.
    expect(document.querySelector('.nwvd-pill')!.textContent).toBe('Completed');
    expect(screen.getByText(fmt('2026-11-10T10:12:00'))).toBeTruthy();
    expect(screen.getByText(fmt('2026-11-13T15:47:00'))).toBeTruthy();
    const signers = within(document.querySelector('.nwvd-signers') as HTMLElement).getAllByRole(
      'listitem',
    );
    expect(signers.map((s) => s.textContent)).toEqual([
      `Your adviserAdviser${fmt('2026-11-11T09:30:00')}`,
      // A signed signer without a date reads "Signed", as live.
      'Thandi MokoenaClientSigned',
    ]);
    expect(screen.getByText('record-of-advice-signed.pdf (32.0 B)')).toBeTruthy();
    const banner = screen.getByText('Document Verified').closest('.nwvd-banner')!;
    expect(banner.className).toContain('nwvd-banner--ok');

    fireEvent.click(screen.getByRole('button', { name: 'Verify Another Document' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Upload Document' })).toBeTruthy();
    expect(screen.queryByText(PDF_HASH)).toBeNull();
  });

  it('marks a match with the original upload', async () => {
    api.post.mockResolvedValue(verified({ matchType: 'original', message: ORIGINAL }));
    await renderPage();
    await upload(pdf());
    await screen.findByText('Original');
    expect(screen.getByText(ORIGINAL)).toBeTruthy();
    expect(screen.queryByText('Signed Copy')).toBeNull();
  });

  it('shows a document whose signing is not complete in amber, with the pending signer', async () => {
    api.post.mockResolvedValue(
      verified({
        message: INCOMPLETE,
        envelope: {
          id: 'env-1',
          title: 'Record of Advice',
          status: 'sent',
          completedAt: null,
          createdAt: '2026-11-10T10:12:00',
        },
        signers: [
          { name: 'Your adviser', role: 'Adviser', status: 'signed', signedAt: null },
          { name: 'Client', role: '', status: 'pending', signedAt: null },
        ],
      }),
    );
    await renderPage();
    await upload(pdf());
    await screen.findByText(INCOMPLETE);
    expect(document.querySelector('.nwvd-pill')!.textContent).toBe('Sent');
    expect(document.querySelector('.nwvd-pill')!.className).toContain('nwvd-pill--warn');
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('pending')).toBeTruthy();
    const banner = screen.getByText('Document Verified').closest('.nwvd-banner')!;
    expect(banner.className).toContain('nwvd-banner--warn');
    // A signer without a role shows none, as live.
    expect(screen.getByText('Client').parentElement!.querySelector('.nwvd-signer-role')).toBeNull();
  });

  it("says when no signed document matches, with the server's message and the reasons", async () => {
    api.post.mockResolvedValue({ verified: false, message: NOT_FOUND });
    await renderPage();
    await upload(pdf());
    await screen.findByText('Verification Failed');
    expect(screen.getByText(NOT_FOUND)).toBeTruthy();
    expect(screen.getByText('Possible reasons:')).toBeTruthy();
    for (const reason of [
      'The document was modified after signing',
      'The document was not signed through Navigate Wealth',
      'The file is a different version of the document',
    ]) {
      expect(screen.getByText(reason)).toBeTruthy();
      expect(liveSource).toContain(reason);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Try Another Document' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Upload Document' })).toBeTruthy();
  });

  it("shows a failed check's own message, or the live page's fallback", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValueOnce(new Error('Verification failed. Please try again.'));
    await renderPage();
    await upload(pdf());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('ErrorVerification failed. Please try again.');
    expect(screen.getByRole('heading', { level: 2, name: 'Verification Error' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Upload Document' })).toBeTruthy();

    api.post.mockRejectedValueOnce('boom');
    await upload(pdf());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'ErrorVerification failed. Please try again.',
      ),
    );
    expect(liveSource).toContain(
      "setErrorMsg(err instanceof Error ? err.message : 'Verification failed. Please try again.')",
    );
    vi.mocked(console.error).mockRestore();
  });
});
