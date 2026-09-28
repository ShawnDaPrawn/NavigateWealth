/**
 * useRoAModuleChat — upload validation, send rollback, completion errors.
 *
 * The conversation panel fires uploadFile and sendMessage without awaiting
 * them. These tests lock the hook contract those handlers depend on: bad
 * files reject before any network call, a failed send drops the optimistic
 * message, and both failures surface through the returned promise so the
 * panel can swallow them instead of reporting an unhandled rejection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { RoAModuleConversationRecord } from '../../types';

const api = vi.hoisted(() => ({
  getModuleConversation: vi.fn(),
  sendModuleMessage: vi.fn(),
  uploadModuleFile: vi.fn(),
  completeModule: vi.fn(),
}));

vi.mock('../../api', () => ({
  roaApi: api,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { useRoAModuleChat } from '../useRoAModuleChat';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function conversation(
  overrides: Partial<RoAModuleConversationRecord> = {},
): RoAModuleConversationRecord {
  return {
    draftId: 'draft-1',
    moduleId: 'risk',
    status: 'in_progress',
    messages: [],
    uploads: [],
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  };
}

async function renderChat() {
  const rendered = renderHook(() => useRoAModuleChat({ draftId: 'draft-1', moduleId: 'risk' }), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
  return rendered;
}

async function capture<T>(run: () => Promise<T>): Promise<unknown> {
  try {
    await run();
    return undefined;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getModuleConversation.mockResolvedValue({ conversation: null });
});

describe('useRoAModuleChat', () => {
  it('seeds messages and completion from the stored conversation', async () => {
    api.getModuleConversation.mockResolvedValue({
      conversation: conversation({
        status: 'complete',
        messages: [
          {
            id: 'a1',
            role: 'assistant',
            content: 'That covers the need.',
            createdAt: '2026-09-24T00:00:00.000Z',
          },
        ],
      }),
    });

    const { result } = await renderChat();

    expect(result.current.status).toBe('complete');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.messages.map((message) => message.content)).toEqual([
      'That covers the need.',
    ]);
  });

  it('does not send a blank message', async () => {
    const { result } = await renderChat();

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(api.sendModuleMessage).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('rolls back an optimistic message and rejects when the send fails', async () => {
    api.sendModuleMessage.mockRejectedValue(new Error('network down'));
    const { result } = await renderChat();

    let caught: unknown;
    await act(async () => {
      caught = await capture(() => result.current.sendMessage('  Need a policy  '));
    });

    expect(caught).toEqual(new Error('network down'));
    expect(api.sendModuleMessage).toHaveBeenCalledWith('draft-1', 'risk', 'Need a policy');
    await waitFor(() => expect(result.current.messages).toEqual([]));
    expect(toast.error).toHaveBeenCalledWith('network down');
  });

  it('rejects an empty file before calling the upload API', async () => {
    const { result } = await renderChat();
    const file = new File([], 'empty.pdf', { type: 'application/pdf' });

    let caught: unknown;
    await act(async () => {
      caught = await capture(() => result.current.uploadFile('policy', file));
    });

    expect(caught).toEqual(new Error('File is empty.'));
    expect(api.uploadModuleFile).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('File is empty.');
  });

  it('rejects a file larger than 15 MB before calling the upload API', async () => {
    const { result } = await renderChat();
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES + 1 });

    let caught: unknown;
    await act(async () => {
      caught = await capture(() => result.current.uploadFile('policy', file));
    });

    expect(caught).toEqual(new Error('Files must be 15 MB or smaller.'));
    expect(api.uploadModuleFile).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Files must be 15 MB or smaller.');
  });

  it('uploads a file at the 15 MB limit with its base64 payload', async () => {
    const saved = conversation({
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'Attached policy.pdf',
          createdAt: '2026-09-24T00:00:00.000Z',
        },
      ],
    });
    api.getModuleConversation.mockImplementation(async () => ({ conversation: null }));
    api.uploadModuleFile.mockImplementation(async () => {
      api.getModuleConversation.mockResolvedValue({ conversation: saved });
      return {
        conversation: saved,
        upload: { id: 'up-1', uploadId: 'policy', fileName: 'policy.pdf' },
      };
    });

    const { result } = await renderChat();
    const file = new File(['hello'], 'policy.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES });

    await act(async () => {
      await result.current.uploadFile('policy', file);
    });

    expect(api.uploadModuleFile).toHaveBeenCalledWith('draft-1', 'risk', {
      uploadId: 'policy',
      fileName: 'policy.pdf',
      mimeType: 'application/pdf',
      size: MAX_UPLOAD_BYTES,
      bytesBase64: 'data:application/pdf;base64,aGVsbG8=',
    });
    expect(toast.success).toHaveBeenCalledWith('policy.pdf attached');
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
  });

  it('rejects when the file cannot be read', async () => {
    const Original = globalThis.FileReader;
    class FailingReader {
      result: string | null = null;
      error = new Error('disk');
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('FileReader', FailingReader);

    try {
      const { result } = await renderChat();
      const file = new File(['hello'], 'policy.pdf', { type: 'application/pdf' });

      let caught: unknown;
      await act(async () => {
        caught = await capture(() => result.current.uploadFile('policy', file));
      });

      expect(caught).toEqual(new Error('disk'));
      expect(api.uploadModuleFile).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('disk');
    } finally {
      vi.stubGlobal('FileReader', Original);
    }
  });

  it('toasts and rejects when manual completion fails', async () => {
    api.completeModule.mockRejectedValue(new Error('still gathering facts'));
    const { result } = await renderChat();

    let caught: unknown;
    await act(async () => {
      caught = await capture(() => result.current.completeModule());
    });

    expect(caught).toEqual(new Error('still gathering facts'));
    expect(api.completeModule).toHaveBeenCalledWith('draft-1', 'risk');
    expect(toast.error).toHaveBeenCalledWith('still gathering facts');
    expect(result.current.isComplete).toBe(false);
  });
});
