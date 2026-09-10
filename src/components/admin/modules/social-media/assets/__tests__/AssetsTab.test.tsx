import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const hooks = vi.hoisted(() => {
  const batches = [
    {
      id: 'b1',
      week_key: '2026-W38',
      source_window_start: '2026-09-05',
      source_window_end: '2026-09-12',
      status: 'scheduled',
      generated_by: 'claude-routine',
      generated_at: '2026-09-12T04:10:00Z',
      selected_by: 'claude-routine',
      selected_at: '2026-09-13T14:20:00Z',
      context_brief: 'Repo rate held at 7.00%.',
      run_report: {
        generation: { articles_used: 6, articles_considered: 30 },
        selection: { scheduled: { linkedin: 2 } },
      },
      created_at: '',
      updated_at: '',
      asset_counts: { linkedin: 2 },
      scheduled_count: 2,
      published_count: 0,
    },
  ];
  const asset = (id: string, channel: string, state: string) => ({
    id,
    batch_id: 'b1',
    week_key: '2026-W38',
    channel,
    title: `Title ${id}`,
    body: 'Body',
    first_comment: null,
    hashtags: [],
    link_url: null,
    link_title: null,
    source_article_ids: [],
    source_summary: null,
    image_brief: null,
    image_style: null,
    image_status: 'none',
    image_url: null,
    image_storage_path: null,
    image_alt_text: null,
    image_error: null,
    state,
    selection_rank: state === 'scheduled' ? 1 : null,
    selection_rationale: null,
    scheduled_for: null,
    buffer_post_id: null,
    buffer_status: null,
    buffer_error: null,
    published_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-12T04:00:00Z',
    updated_at: '',
  });
  return {
    batches,
    state: {
      batchesLoading: false,
      batchesError: null as Error | null,
      batchesData: batches as unknown[],
    },
    useSocialBatches: vi.fn(),
    useSocialBatch: vi.fn(() => ({
      data: {
        batch: batches[0],
        assets: [asset('a1', 'linkedin', 'scheduled'), asset('a2', 'linkedin', 'generated')],
      },
      isLoading: false,
    })),
    useSocialAutomationSettings: vi.fn(() => ({
      data: {
        enabled: true,
        posting_timezone: 'Africa/Johannesburg',
        preferred_slots: {},
        channels: ['linkedin', 'instagram', 'x'],
        assets_per_channel: 5,
        posts_per_channel_per_week: 2,
        site_origin: 'https://www.navigatewealth.co',
        style_guide: '',
        compliance_rules: '',
      },
    })),
    useSocialPlaybooks: vi.fn(() => ({ data: [] })),
    updateSettings: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    updateAsset: { mutate: vi.fn(), isPending: false },
    runJob: { mutate: vi.fn(), isPending: false, variables: undefined },
  };
});

vi.mock('../../hooks/useSocialAssets', () => ({
  useSocialBatches: () => ({
    data: hooks.state.batchesData,
    isLoading: hooks.state.batchesLoading,
    error: hooks.state.batchesError,
  }),
  useSocialBatch: hooks.useSocialBatch,
  useSocialAutomationSettings: hooks.useSocialAutomationSettings,
  useSocialPlaybooks: hooks.useSocialPlaybooks,
  useUpdateSocialSettings: () => hooks.updateSettings,
  useUpdateSocialPlaybook: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSocialAsset: () => hooks.updateAsset,
  useRunSocialJob: () => hooks.runJob,
}));

import { AssetsTab } from '../AssetsTab';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.state.batchesData = hooks.batches;
  hooks.state.batchesLoading = false;
  hooks.state.batchesError = null;
});

describe('AssetsTab', () => {
  it('renders the week, its report, and one column per channel', () => {
    render(<AssetsTab />, { wrapper });
    expect(screen.getByText('Weekly automation on')).toBeDefined();
    expect(screen.getAllByText('Articles: 6 used of 30 considered').length).toBeGreaterThan(0);
    expect(screen.getByText('Title a1')).toBeDefined();
    expect(screen.getByText('Title a2')).toBeDefined();
    expect(screen.getByText('No assets for Instagram this week.')).toBeDefined();
    expect(screen.getByText('No assets for X this week.')).toBeDefined();
    expect(screen.getByText('1 live · 1 candidate')).toBeDefined();
  });

  it('reveals the context brief and wires the kill switch and jobs', () => {
    render(<AssetsTab />, { wrapper });
    fireEvent.click(screen.getByText('Context the routine worked from'));
    expect(screen.getByText('Repo rate held at 7.00%.')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Weekly automation'));
    expect(hooks.updateSettings.mutate).toHaveBeenCalledWith({ enabled: false });
    fireEvent.click(screen.getByText('Render images now'));
    expect(hooks.runJob.mutate).toHaveBeenCalledWith('render-images');
    fireEvent.click(screen.getByText('Remove'));
    expect(hooks.updateAsset.mutate).toHaveBeenCalledWith({
      assetId: 'a2',
      patch: { state: 'rejected' },
    });
  });

  it('shows the empty state before the first batch', () => {
    hooks.state.batchesData = [];
    render(<AssetsTab />, { wrapper });
    expect(screen.getByText('No weekly batches yet')).toBeDefined();
  });

  it('opens the settings dialog', async () => {
    render(<AssetsTab />, { wrapper });
    fireEvent.click(screen.getByText('Settings & playbooks'));
    expect(await screen.findByText('Automation settings & playbooks')).toBeDefined();
  });
});
