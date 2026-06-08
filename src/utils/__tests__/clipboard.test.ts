/**
 * Tests for copyToClipboard utility.
 * Mocks copy-to-clipboard and navigator.clipboard.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockCopy = vi.fn();

vi.mock('copy-to-clipboard', () => ({
  default: (...args: unknown[]) => mockCopy(...args),
}));

// ── Import after mock ─────────────────────────────────────────────────────────

import { copyToClipboard } from '../clipboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubClipboardApi(writeText: (() => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: execCommand succeeds
  mockCopy.mockReturnValue(true);
});

afterEach(() => {
  // Remove clipboard stub
  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('copyToClipboard', () => {
  it('resolves when copy-to-clipboard succeeds', async () => {
    mockCopy.mockReturnValue(true);
    await expect(copyToClipboard('hello')).resolves.toBeUndefined();
  });

  it('passes the text to copy-to-clipboard', async () => {
    await copyToClipboard('my text');
    expect(mockCopy).toHaveBeenCalledWith('my text', expect.any(Object));
  });

  it('falls back to navigator.clipboard when execCommand returns false', async () => {
    mockCopy.mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboardApi(writeText);

    await expect(copyToClipboard('fallback text')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('fallback text');
  });

  it('falls back to navigator.clipboard when execCommand throws', async () => {
    mockCopy.mockImplementation(() => {
      throw new Error('execCommand blocked');
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboardApi(writeText);

    await expect(copyToClipboard('text')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('text');
  });

  it('throws when navigator.clipboard fails', async () => {
    mockCopy.mockReturnValue(false);
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    stubClipboardApi(writeText);

    await expect(copyToClipboard('text')).rejects.toThrow('All clipboard methods failed');
  });

  it('throws when neither execCommand nor clipboard API is available', async () => {
    mockCopy.mockReturnValue(false);
    stubClipboardApi(undefined);

    await expect(copyToClipboard('text')).rejects.toThrow('Clipboard not supported');
  });
});
