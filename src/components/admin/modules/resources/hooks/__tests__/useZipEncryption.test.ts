import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZipEncryption, type FileItem } from '../useZipEncryption';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';

// Mock @zip.js/zip.js — we don't want to run real compression in tests
const mockZipWriterClose = vi.fn().mockResolvedValue(undefined);
const mockZipWriterAdd = vi.fn().mockResolvedValue(undefined);
const mockBlobWriterGetData = vi
  .fn()
  .mockResolvedValue(new Blob(['zip-content'], { type: 'application/zip' }));

vi.mock('@zip.js/zip.js', () => {
  function BlobReader() {}
  function BlobWriter(this: { getData: () => unknown }) {
    this.getData = (...args: unknown[]) => mockBlobWriterGetData(...args);
  }
  function ZipWriter(this: { add: () => unknown; close: () => unknown }) {
    this.add = (...args: unknown[]) => mockZipWriterAdd(...args);
    this.close = (...args: unknown[]) => mockZipWriterClose(...args);
  }
  return { BlobReader, BlobWriter, ZipWriter };
});

// Mock URL.createObjectURL / URL.revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: (...args: unknown[]) => mockCreateObjectURL(...args),
  revokeObjectURL: (...args: unknown[]) => mockRevokeObjectURL(...args),
});

// ── Fixtures ───────────────────────────────────────────────────────────────────

const makeFile = (name: string, subcategory = ''): FileItem => ({
  id: `id-${name}`,
  name,
  file: new File(['content'], name),
  subcategory,
  size: 7,
});

describe('useZipEncryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlobWriterGetData.mockResolvedValue(new Blob(['zip-content'], { type: 'application/zip' }));
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('initialises with correct default state', () => {
    const { result } = renderHook(() => useZipEncryption());

    expect(result.current.processing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.currentAction).toBe('');
    expect(result.current.zipUrl).toBeNull();
  });

  // ── generateZip validation ─────────────────────────────────────────────────

  it('shows error when files list is empty', async () => {
    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip([], 'password', 'archive', 'individual');
    });

    expect(toast.error).toHaveBeenCalledWith('Please add at least one document');
    expect(result.current.processing).toBe(false);
  });

  it('shows error when password is too short', async () => {
    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip([makeFile('doc.pdf')], 'abc', 'archive', 'individual');
    });

    expect(toast.error).toHaveBeenCalledWith('Please enter a password (min 4 characters)');
    expect(result.current.processing).toBe(false);
  });

  it('shows error when password is empty', async () => {
    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip([makeFile('doc.pdf')], '', 'archive', 'individual');
    });

    expect(toast.error).toHaveBeenCalledWith('Please enter a password (min 4 characters)');
  });

  it('shows error when filename is blank', async () => {
    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip([makeFile('doc.pdf')], 'password1234', '   ', 'individual');
    });

    expect(toast.error).toHaveBeenCalledWith('Please enter a filename for the zip');
  });

  // ── individual mode ────────────────────────────────────────────────────────

  it('generates an individual-encrypted zip and sets zipUrl', async () => {
    const { result } = renderHook(() => useZipEncryption());
    const files = [makeFile('doc1.pdf', 'contracts'), makeFile('doc2.pdf', '')];

    await act(async () => {
      await result.current.generateZip(files, 'securepass', 'my-archive', 'individual');
    });

    expect(result.current.zipUrl).toBe('blob:mock-url');
    expect(result.current.progress).toBe(100);
    expect(result.current.currentAction).toBe('Done!');
    expect(result.current.processing).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Encrypted Zip generated successfully');
    expect(mockZipWriterAdd).toHaveBeenCalledTimes(files.length);
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
  });

  it('uses subcategory as folder prefix in individual mode', async () => {
    const { result } = renderHook(() => useZipEncryption());
    const files = [makeFile('report.pdf', 'quarterly')];

    await act(async () => {
      await result.current.generateZip(files, 'securepass', 'my-archive', 'individual');
    });

    // The first argument to zipWriter.add should include the folder prefix
    const [zipFilename] = mockZipWriterAdd.mock.calls[0];
    expect(zipFilename).toBe('quarterly/report.pdf');
  });

  it('does not prefix when subcategory is empty in individual mode', async () => {
    const { result } = renderHook(() => useZipEncryption());
    const files = [makeFile('report.pdf', '')];

    await act(async () => {
      await result.current.generateZip(files, 'securepass', 'my-archive', 'individual');
    });

    const [zipFilename] = mockZipWriterAdd.mock.calls[0];
    expect(zipFilename).toBe('report.pdf');
  });

  // ── folder mode ────────────────────────────────────────────────────────────

  it('generates a folder-encrypted zip and sets zipUrl', async () => {
    const { result } = renderHook(() => useZipEncryption());
    const files = [makeFile('doc1.pdf'), makeFile('doc2.pdf')];

    await act(async () => {
      await result.current.generateZip(files, 'securepass', 'my-archive', 'folder');
    });

    expect(result.current.zipUrl).toBe('blob:mock-url');
    expect(result.current.progress).toBe(100);
    expect(result.current.currentAction).toBe('Done!');
    expect(result.current.processing).toBe(false);
    expect(toast.success).toHaveBeenCalledWith('Secure Folder Archive generated successfully');
    // Inner zip: one add per file, outer zip: one add for the inner zip
    expect(mockZipWriterAdd).toHaveBeenCalledTimes(files.length + 1);
  });

  it('uses archive name for inner zip filename in folder mode', async () => {
    const { result } = renderHook(() => useZipEncryption());
    const files = [makeFile('report.pdf')];

    await act(async () => {
      await result.current.generateZip(files, 'securepass', 'my-bundle', 'folder');
    });

    // Last add call is for the outer zip that contains the inner content zip
    const lastCall = mockZipWriterAdd.mock.calls[mockZipWriterAdd.mock.calls.length - 1];
    expect(lastCall[0]).toBe('my-bundle_content.zip');
  });

  // ── error handling ─────────────────────────────────────────────────────────

  it('shows error toast and resets processing state when zip generation throws', async () => {
    mockZipWriterAdd.mockRejectedValueOnce(new Error('Zip failed'));

    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip(
        [makeFile('doc.pdf')],
        'securepass',
        'archive',
        'individual',
      );
    });

    expect(toast.error).toHaveBeenCalledWith('Zip failed');
    expect(result.current.processing).toBe(false);
  });

  it('shows generic error message for non-Error throws', async () => {
    mockZipWriterAdd.mockRejectedValueOnce('something bad');

    const { result } = renderHook(() => useZipEncryption());

    await act(async () => {
      await result.current.generateZip(
        [makeFile('doc.pdf')],
        'securepass',
        'archive',
        'individual',
      );
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to generate zip');
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useZipEncryption());

    // Generate a zip first to get a URL
    await act(async () => {
      await result.current.generateZip(
        [makeFile('doc.pdf')],
        'securepass',
        'archive',
        'individual',
      );
    });

    expect(result.current.zipUrl).toBe('blob:mock-url');

    act(() => {
      result.current.reset();
    });

    expect(result.current.zipUrl).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.currentAction).toBe('');
    expect(result.current.processing).toBe(false);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('reset does not call revokeObjectURL when there is no url', () => {
    const { result } = renderHook(() => useZipEncryption());

    act(() => {
      result.current.reset();
    });

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
  });
});
