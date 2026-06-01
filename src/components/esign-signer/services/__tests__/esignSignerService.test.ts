/**
 * esignSignerService — unit tests (Phase 4 coverage push).
 *
 * The signer-side e-signature API client (legally significant: token
 * validation, OTP, signature submission, rejection, attachments, download).
 * Every method posts to the edge function over fetch; fetch is mocked so each
 * method's success / server-error / network-error path is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'proj',
  publicAnonKey: 'anon-key',
}));

import { esignSignerService, uploadAttachmentForSigner } from '../esignSignerService';
import type { SignatureData } from '../../types';

function fetchResolving(body: unknown, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    blob: async () => new Blob(['pdf']),
  }) as unknown as typeof fetch;
}
function fetchRejecting() {
  global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateAccessToken', () => {
  it('returns the session data on success', async () => {
    fetchResolving({ envelope: { id: 'e1' } });
    const res = await esignSignerService.validateAccessToken('tok');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ envelope: { id: 'e1' } });
  });
  it('surfaces the server error on a non-ok response', async () => {
    fetchResolving({ error: 'expired link' }, { ok: false, status: 401 });
    const res = await esignSignerService.validateAccessToken('tok');
    expect(res).toEqual({ success: false, error: 'expired link' });
  });
  it('returns a friendly network error when fetch throws', async () => {
    fetchRejecting();
    const res = await esignSignerService.validateAccessToken('tok');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/network/i);
  });
});

describe('OTP', () => {
  it('verifyOtp succeeds and fails', async () => {
    fetchResolving({});
    expect(await esignSignerService.verifyOtp('tok', '000000')).toEqual({ success: true });
    fetchResolving({ error: 'bad code' }, { ok: false, status: 400 });
    expect(await esignSignerService.verifyOtp('tok', '999999')).toEqual({
      success: false,
      error: 'bad code',
    });
  });
  it('resendOtp succeeds and reports network errors', async () => {
    fetchResolving({});
    expect(await esignSignerService.resendOtp('tok')).toEqual({ success: true });
    fetchRejecting();
    expect((await esignSignerService.resendOtp('tok')).success).toBe(false);
  });
});

describe('submitSignature', () => {
  const sigs = [
    { field_id: 'f1', type: 'signature', value: 'data:img' },
  ] as unknown as SignatureData[];

  it('posts the signature + field-value payloads on success', async () => {
    fetchResolving({});
    expect(await esignSignerService.submitSignature('tok', sigs)).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/signer/submit'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('returns the server error on failure', async () => {
    fetchResolving({ error: 'missing field' }, { ok: false, status: 422 });
    expect(await esignSignerService.submitSignature('tok', sigs)).toEqual({
      success: false,
      error: 'missing field',
    });
  });
});

describe('rejectDocument / saveSignerSignature / pauseSigning', () => {
  it('rejectDocument succeeds and fails', async () => {
    fetchResolving({});
    expect(await esignSignerService.rejectDocument('tok', 'no thanks')).toEqual({ success: true });
    fetchResolving({ error: 'already signed' }, { ok: false, status: 409 });
    expect((await esignSignerService.rejectDocument('tok', 'x')).error).toBe('already signed');
  });
  it('saveSignerSignature is best-effort (success + error)', async () => {
    fetchResolving({});
    expect(await esignSignerService.saveSignerSignature('tok', { signature: 's' })).toEqual({
      success: true,
    });
    fetchResolving({ error: 'nope' }, { ok: false, status: 500 });
    expect((await esignSignerService.saveSignerSignature('tok', {})).success).toBe(false);
  });
  it('pauseSigning records progress (success + network error)', async () => {
    fetchResolving({});
    expect(await esignSignerService.pauseSigning('tok', { completed: 1, required: 3 })).toEqual({
      success: true,
    });
    fetchRejecting();
    expect((await esignSignerService.pauseSigning('tok')).success).toBe(false);
  });
});

describe('downloadDocument', () => {
  it('returns the blob on success and null otherwise', async () => {
    fetchResolving({});
    expect(await esignSignerService.downloadDocument('tok')).toBeInstanceOf(Blob);
    fetchResolving({}, { ok: false, status: 404 });
    expect(await esignSignerService.downloadDocument('tok')).toBeNull();
    fetchRejecting();
    expect(await esignSignerService.downloadDocument('tok')).toBeNull();
  });
});

describe('uploadAttachment', () => {
  const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

  it('returns the stored attachment metadata on success', async () => {
    fetchResolving({
      attachmentId: 'a1',
      filename: 'doc.pdf',
      size: 1,
      mimeType: 'application/pdf',
      path: 'p',
    });
    const res = await esignSignerService.uploadAttachment('tok', 'f1', file);
    expect(res).toMatchObject({ attachmentId: 'a1', filename: 'doc.pdf' });
  });
  it('throws the server error on failure', async () => {
    fetchResolving({ error: 'file too large' }, { ok: false, status: 413 });
    await expect(esignSignerService.uploadAttachment('tok', 'f1', file)).rejects.toThrow(
      'file too large',
    );
  });
  it('uploadAttachmentForSigner delegates to the service', async () => {
    fetchResolving({
      attachmentId: 'a2',
      filename: 'd',
      size: 1,
      mimeType: 'application/pdf',
      path: 'p',
    });
    expect((await uploadAttachmentForSigner('tok', 'f1', file)).attachmentId).toBe('a2');
  });
});
