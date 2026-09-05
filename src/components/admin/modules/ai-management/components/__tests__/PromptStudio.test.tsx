import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PromptVersion } from '../../types';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const hooks = vi.hoisted(() => ({
  bundle: {
    active: null as string | null,
    draft: null as string | null,
    versions: [] as PromptVersion[],
  },
  isLoading: false,
  saveDraft: vi.fn(),
  saveDraftAsync: vi.fn(async () => ({ success: true })),
  publishAsync: vi.fn(async () => ({ version: { id: 'v' } })),
  rollback: vi.fn(),
  seed: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  usePromptBundle: () => ({ data: hooks.bundle, isLoading: hooks.isLoading }),
  useSaveDraftPrompt: () => ({
    mutate: hooks.saveDraft,
    mutateAsync: hooks.saveDraftAsync,
    isPending: false,
  }),
  usePublishPrompt: () => ({ mutateAsync: hooks.publishAsync, isPending: false }),
  useRollbackPrompt: () => ({ mutate: hooks.rollback, isPending: false }),
  useSeedPrompt: () => ({ mutate: hooks.seed, isPending: false }),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { PromptStudio } from '../PromptStudio';

const version = (id: string, publishedAt: string): PromptVersion => ({
  id,
  agentId: 'vasco-public',
  context: 'public',
  prompt: `prompt ${id}`,
  publishedAt,
  publishedBy: 'admin@example.co.za',
});

beforeEach(() => {
  hooks.bundle = { active: null, draft: null, versions: [] };
  hooks.isLoading = false;
  hooks.saveDraft.mockReset();
  hooks.saveDraftAsync.mockClear();
  hooks.publishAsync.mockClear();
  hooks.rollback.mockReset();
  hooks.seed.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('PromptStudio (Prompts tab)', () => {
  it('only offers the assistants that actually read their prompt from here', () => {
    render(<PromptStudio />, { wrapper });
    expect(screen.getByText('Vasco on the public website')).toBeDefined();
    expect(screen.getByText(/cannot be edited here yet/)).toBeDefined();
  });

  it('with nothing published, shows one way in: start from the default', () => {
    render(<PromptStudio />, { wrapper });
    expect(screen.getByText('Using the built-in default')).toBeDefined();
    expect(screen.getByText('No custom instructions yet')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /start from the built-in default/i }));
    expect(hooks.seed).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'vasco-public', context: 'public' }),
      expect.anything(),
    );
    expect(hooks.seed.mock.calls[0][0].seedPrompt).toContain('You are Vasco');
  });

  it('with a live prompt, shows the editor, status line and a Save/Publish pair', () => {
    hooks.bundle = {
      active: 'Live text',
      draft: 'Live text',
      versions: [version('v2', '2026-02-01T10:00:00Z'), version('v1', '2026-01-01T10:00:00Z')],
    };
    render(<PromptStudio />, { wrapper });

    expect(screen.getByText('Custom prompt live')).toBeDefined();
    expect(screen.getByText(/Published .* by admin@example.co.za/)).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /save draft/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: /^publish$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    // Only older versions can be restored; the live one is marked instead.
    expect(screen.getAllByRole('button', { name: /restore/i })).toHaveLength(1);
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
  });

  it('typing marks the draft unsaved and enables saving', () => {
    hooks.bundle = { active: 'Live text', draft: 'Live text', versions: [] };
    render(<PromptStudio />, { wrapper });

    fireEvent.change(screen.getByLabelText('Prompt instructions'), {
      target: { value: 'Changed text' },
    });
    expect(screen.getByText('Unsaved')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(hooks.saveDraft).toHaveBeenCalledWith(
      { agentId: 'vasco-public', context: 'public', prompt: 'Changed text' },
      expect.anything(),
    );
  });

  it('publishing an unsaved edit saves the draft first, then publishes', async () => {
    hooks.bundle = { active: 'Live text', draft: 'Live text', versions: [] };
    render(<PromptStudio />, { wrapper });

    fireEvent.change(screen.getByLabelText('Prompt instructions'), {
      target: { value: 'Changed text' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }));

    await waitFor(() => expect(hooks.publishAsync).toHaveBeenCalled());
    expect(hooks.saveDraftAsync).toHaveBeenCalledWith({
      agentId: 'vasco-public',
      context: 'public',
      prompt: 'Changed text',
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Published'));
  });

  it('asks for confirmation before restoring an old version', () => {
    hooks.bundle = {
      active: 'Live text',
      draft: 'Live text',
      versions: [version('v2', '2026-02-01T10:00:00Z'), version('v1', '2026-01-01T10:00:00Z')],
    };
    render(<PromptStudio />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(screen.getByText('Restore this version?')).toBeDefined();
    expect(hooks.rollback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^restore$/i }));
    expect(hooks.rollback).toHaveBeenCalledWith(
      { agentId: 'vasco-public', context: 'public', versionId: 'v1' },
      expect.anything(),
    );
  });

  it('offers a reset to the built-in default as a local edit, not a publish', () => {
    hooks.bundle = { active: 'Live text', draft: 'Live text', versions: [] };
    render(<PromptStudio />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /reset to built-in default/i }));
    const editor = screen.getByLabelText('Prompt instructions') as HTMLTextAreaElement;
    expect(editor.value).toContain('You are Vasco');
    expect(hooks.publishAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved')).toBeDefined();
  });
});
