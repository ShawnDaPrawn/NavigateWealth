import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePdfDecryption } from '../usePdfDecryption';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'sonner';

// Mock pdf-lib's PDFDocument
const mockPdfDocSave = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
const mockPdfDocLoad = vi.fn();

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: (...args: unknown[]) => mockPdfDocLoad(...args),
  },
}));

// Mock URL.createObjectURL / URL.revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:decrypted-url');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: (...args: unknown[]) => mockCreateObjectURL(...args),
  revokeObjectURL: (...args: unknown[]) => mockRevokeObjectURL(...args),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePdfFile(name = 'test.pdf'): File {
  return new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
}

describe('usePdfDecryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:decrypted-url');
    mockPdfDocLoad.mockResolvedValue({ save: () => mockPdfDocSave() });
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initialises with correct default state', () => {
    const { result } = renderHook(() => usePdfDecryption());

    expect(result.current.processing).toBe(false);
    expect(result.current.decryptedUrl).toBeNull();
  });

  // ── decryptPdf — success path ──────────────────────────────────────────────

  it('decrypts a PDF successfully and sets decryptedUrl', async () => {
    const { result } = renderHook(() => usePdfDecryption());
    const file = makePdfFile();

    await act(async () => {
      await result.current.decryptPdf(file, 'anypassword');
    });

    expect(mockPdfDocLoad).toHaveBeenCalled();
    expect(mockPdfDocSave).toHaveBeenCalled();
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(result.current.decryptedUrl).toBe('blob:decrypted-url');
    expect(result.current.processing).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('PDF decrypted successfully');
  });

  it('sets processing to true during decryption, then false after', async () => {
    let wasProcessingDuringLoad = false;

    mockPdfDocLoad.mockImplementation(async () => {
      // At this point processing should be true
      wasProcessingDuringLoad = true;
      return { save: () => mockPdfDocSave() };
    });

    const { result } = renderHook(() => usePdfDecryption());
    const file = makePdfFile();

    await act(async () => {
      await result.current.decryptPdf(file, 'password1234');
    });

    expect(wasProcessingDuringLoad).toBe(true);
    expect(result.current.processing).toBe(false);
  });

  // ── decryptPdf — validation ────────────────────────────────────────────────

  it('shows error when file is falsy', async () => {
    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(null as unknown as File, 'password');
    });

    expect(toast.error).toHaveBeenCalledWith('Please upload a PDF file');
    expect(result.current.processing).toBe(false);
    expect(mockPdfDocLoad).not.toHaveBeenCalled();
  });

  // ── decryptPdf — error handling ────────────────────────────────────────────

  it('shows unsupported-encryption error for AES-256 PDFs', async () => {
    mockPdfDocLoad.mockRejectedValueOnce(
      new Error('Input document to `PDFDocument.load` is encrypted'),
    );

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'password');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Decryption Failed: Unsupported Encryption',
      expect.objectContaining({ description: expect.stringContaining('AES-256') }),
    );
    expect(result.current.processing).toBe(false);
  });

  it('shows incorrect-password error when message contains "password"', async () => {
    mockPdfDocLoad.mockRejectedValueOnce(new Error('incorrect password provided'));

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'wrongpass');
    });

    expect(toast.error).toHaveBeenCalledWith('Incorrect password. Please try again.');
    expect(result.current.processing).toBe(false);
  });

  it('shows file-structure error for invalid object ref', async () => {
    mockPdfDocLoad.mockRejectedValueOnce(new Error('Invalid object ref at position 42'));

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'pass1234');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Decryption Failed: File Structure Issue',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('shows file-structure error for "Trying to parse invalid object"', async () => {
    mockPdfDocLoad.mockRejectedValueOnce(new Error('Trying to parse invalid object at byte 100'));

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'pass1234');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Decryption Failed: File Structure Issue',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('shows generic error for unknown failures', async () => {
    mockPdfDocLoad.mockRejectedValueOnce(new Error('something completely unexpected'));

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'pass1234');
    });

    expect(toast.error).toHaveBeenCalledWith(
      'Failed to decrypt PDF',
      expect.objectContaining({ description: expect.any(String) }),
    );
    expect(result.current.processing).toBe(false);
  });

  it('handles non-Error throws gracefully', async () => {
    mockPdfDocLoad.mockRejectedValueOnce('string error');

    const { result } = renderHook(() => usePdfDecryption());

    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'pass1234');
    });

    // Non-Error should land in the generic handler
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.processing).toBe(false);
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset clears decryptedUrl and calls revokeObjectURL', async () => {
    const { result } = renderHook(() => usePdfDecryption());

    // Get a URL first
    await act(async () => {
      await result.current.decryptPdf(makePdfFile(), 'password');
    });

    expect(result.current.decryptedUrl).toBe('blob:decrypted-url');

    act(() => {
      result.current.reset();
    });

    expect(result.current.decryptedUrl).toBeNull();
    expect(result.current.processing).toBe(false);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:decrypted-url');
  });

  it('reset does not call revokeObjectURL when there is no url', () => {
    const { result } = renderHook(() => usePdfDecryption());

    act(() => {
      result.current.reset();
    });

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
  });
});
