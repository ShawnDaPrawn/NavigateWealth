import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { KBEntry, KnowledgeIndexStatus } from '../../types';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const hooks = vi.hoisted(() => ({
  entries: [] as KBEntry[],
  indexStatus: null as KnowledgeIndexStatus | null,
  updateMutate: vi.fn(),
  rebuildMutate: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useKBEntries: () => ({ data: hooks.entries, isLoading: false }),
  useRagIndexStatus: () => ({ data: hooks.indexStatus, isLoading: false }),
  useTriggerReindex: () => ({ mutate: hooks.rebuildMutate, isPending: false }),
  useCreateKBEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateKBEntry: () => ({ mutate: hooks.updateMutate, isPending: false }),
  useDeleteKBEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useAgents: () => ({ data: [], isLoading: false }),
}));

vi.mock('../KBEntryModal', () => ({
  KBEntryModal: ({ open }: { open: boolean }) => (open ? <div data-testid="kb-modal" /> : null),
}));

import { KnowledgeBase } from '../KnowledgeBase';

function entry(overrides: Partial<KBEntry> = {}): KBEntry {
  return {
    id: 'kb-1',
    title: 'TFSA annual limit',
    type: 'qa',
    status: 'active',
    content: '',
    question: 'How much can I put in a TFSA?',
    answer: 'R36,000 per year.',
    category: 'Tax Planning',
    tags: [],
    agentScope: 'all',
    priority: 5,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function status(overrides: Partial<KnowledgeIndexStatus> = {}): KnowledgeIndexStatus {
  return {
    indexed: true,
    articles: [],
    kbEntries: [],
    totalChunks: 0,
    lastFullIndex: null,
    lastUpdated: '2026-01-02T00:00:00.000Z',
    publishedArticleCount: 0,
    activeKbCount: 0,
    pendingArticles: 0,
    pendingKbEntries: 0,
    staleSources: 0,
    ...overrides,
  };
}

beforeEach(() => {
  hooks.entries = [];
  hooks.indexStatus = status();
  hooks.updateMutate.mockReset();
  hooks.rebuildMutate.mockReset();
});

describe('KnowledgeBase (Knowledge tab)', () => {
  it('leads with what Vasco can draw on and offers a rebuild', () => {
    render(<KnowledgeBase />, { wrapper });
    expect(screen.getByText('What Vasco can draw on')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /rebuild index/i }));
    expect(hooks.rebuildMutate).toHaveBeenCalledTimes(1);
  });

  it('explains the empty state in plain words with a single call to action', () => {
    render(<KnowledgeBase />, { wrapper });
    expect(screen.getByText('No entries yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /add your first entry/i }));
    expect(screen.getByTestId('kb-modal')).toBeDefined();
  });

  it('shows status counts on the segmented filter and filters by it', () => {
    hooks.entries = [
      entry(),
      entry({
        id: 'kb-2',
        title: 'Office hours',
        status: 'draft',
        type: 'snippet',
        content: '8–5',
      }),
    ];
    render(<KnowledgeBase />, { wrapper });

    const draftFilter = screen.getByRole('button', { name: /^Draft/ });
    expect(draftFilter.textContent).toContain('1');
    fireEvent.click(draftFilter);

    expect(screen.getByText('Office hours')).toBeDefined();
    expect(screen.queryByText('TFSA annual limit')).toBeNull();
    expect(screen.getByText(/1 entry match/)).toBeDefined();
  });

  it('each live entry has a Live switch that turns it into a draft', () => {
    hooks.entries = [entry()];
    render(<KnowledgeBase />, { wrapper });

    const toggle = screen.getByRole('switch', { name: /TFSA annual limit: available to Vasco/ });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);

    expect(hooks.updateMutate).toHaveBeenCalledWith({ id: 'kb-1', input: { status: 'draft' } });
  });

  it('archived entries have no Live switch', () => {
    hooks.entries = [entry({ status: 'archived' })];
    render(<KnowledgeBase />, { wrapper });
    expect(screen.queryByRole('switch')).toBeNull();
    // "Archived" appears on the status filter and again as the card's badge.
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /more actions for/i })).toBeDefined();
  });

  it('searches question text as well as titles', () => {
    hooks.entries = [
      entry(),
      entry({ id: 'kb-2', title: 'Something else', question: 'estate duty?' }),
    ];
    render(<KnowledgeBase />, { wrapper });

    fireEvent.change(screen.getByPlaceholderText(/search entries/i), {
      target: { value: 'estate' },
    });
    expect(screen.getByText('Something else')).toBeDefined();
    expect(screen.queryByText('TFSA annual limit')).toBeNull();
  });

  it('flags high importance and restricted assistants on the card', () => {
    hooks.entries = [entry({ priority: 10, agentScope: ['vasco-authenticated'] })];
    render(<KnowledgeBase />, { wrapper });
    expect(screen.getByText(/Essential importance/)).toBeDefined();
    expect(screen.getByText(/Only 1 assistant/)).toBeDefined();
  });
});
