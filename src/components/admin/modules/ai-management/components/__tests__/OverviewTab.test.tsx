import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AIAgentConfig, AnalyticsSummary, KnowledgeIndexStatus } from '../../types';

const hooks = vi.hoisted(() => ({
  enabled: false,
  toggle: vi.fn(),
  analytics: null as AnalyticsSummary | null,
  index: null as KnowledgeIndexStatus | null,
  newLeads: [] as unknown[],
  agents: [] as AIAgentConfig[],
}));

vi.mock('../../hooks', () => ({
  useVascoConfig: () => ({
    data: { enabled: hooks.enabled, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'x' },
    isLoading: false,
  }),
  useToggleVasco: () => ({ mutate: hooks.toggle, isPending: false }),
  useAnalyticsSummary: () => ({ data: hooks.analytics, isLoading: false }),
  useRagIndexStatus: () => ({ data: hooks.index }),
  useHandoffs: () => ({ data: hooks.newLeads }),
  useAgents: () => ({ data: hooks.agents, isLoading: false }),
}));

// recharts measures its container; jsdom has no layout. Stub the chart.
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="area-chart">{children}</div>
    ),
    Area: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    CartesianGrid: Nothing,
    Tooltip: Nothing,
    Legend: Nothing,
  };
});

import { OverviewTab } from '../OverviewTab';

function analytics(overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary {
  return {
    totalSessions: 12,
    totalMessages: 40,
    totalFeedbackPositive: 8,
    totalFeedbackNegative: 2,
    totalHandoffs: 1,
    totalRagHits: 5,
    totalRateLimited: 0,
    totalTopicBlocked: 0,
    totalCircuitBreakerBlocked: 0,
    totalGuardrailFailures: 0,
    totalEstimatedPublicTokens: 0,
    last7Days: [
      {
        date: '2026-01-01',
        sessions: 3,
        messages: 10,
        uniqueIps: [],
        feedbackPositive: 1,
        feedbackNegative: 0,
        handoffs: 0,
        ragHits: 1,
        rateLimited: 0,
        topicBlocked: 0,
        circuitBreakerBlocked: 0,
        guardrailFailures: 0,
        estimatedPublicTokens: 0,
      },
    ],
    topTopics: [
      { topic: 'Retirement', count: 6 },
      { topic: 'Tax', count: 3 },
    ],
    lastUpdated: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function index(overrides: Partial<KnowledgeIndexStatus> = {}): KnowledgeIndexStatus {
  return {
    indexed: true,
    articles: [{ articleId: 'a', title: 'A', slug: 'a', chunkCount: 1, indexedAt: 'x' }],
    kbEntries: [],
    totalChunks: 1,
    lastFullIndex: null,
    lastUpdated: 'x',
    publishedArticleCount: 1,
    activeKbCount: 0,
    pendingArticles: 0,
    pendingKbEntries: 0,
    staleSources: 0,
    ...overrides,
  };
}

const agent: AIAgentConfig = {
  id: 'vasco-public',
  name: 'Vasco (Public)',
  description: 'Public-facing navigator',
  icon: 'Compass',
  status: 'active',
  model: 'gpt-5.4',
  temperature: 0.7,
  maxTokens: 600,
  maxContextMessages: 12,
  presencePenalty: 0,
  frequencyPenalty: 0,
  contexts: ['public'],
  features: {
    ragEnabled: true,
    feedbackEnabled: true,
    handoffEnabled: true,
    streamingEnabled: true,
    citationsEnabled: true,
  },
  createdAt: 'x',
  updatedAt: 'x',
};

beforeEach(() => {
  hooks.enabled = false;
  hooks.toggle.mockReset();
  hooks.analytics = analytics();
  hooks.index = index();
  hooks.newLeads = [];
  hooks.agents = [agent];
});

describe('OverviewTab', () => {
  it('states the Vasco switch position in a full sentence and toggles it', () => {
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('Vasco is switched off on the public website')).toBeDefined();

    fireEvent.click(screen.getByRole('switch', { name: /Vasco public website chat/ }));
    expect(hooks.toggle).toHaveBeenCalledWith(true);
  });

  it('shows the live sentence when enabled', () => {
    hooks.enabled = true;
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('Vasco is live on the public website')).toBeDefined();
  });

  it('turns feedback into a helpfulness percentage', () => {
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('80%')).toBeDefined();
    expect(screen.getByText('from 10 ratings')).toBeDefined();
  });

  it('shows a dash rather than 0% when nothing has been rated', () => {
    hooks.analytics = analytics({ totalFeedbackPositive: 0, totalFeedbackNegative: 0 });
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('No ratings yet')).toBeDefined();
  });

  it('routes the admin to the tab where each number can be acted on', () => {
    const onNavigate = vi.fn();
    hooks.newLeads = [{ id: 'h1' }, { id: 'h2' }];
    render(<OverviewTab onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Leads waiting for a call/ }));
    fireEvent.click(screen.getByRole('button', { name: /Knowledge Vasco can use/ }));
    fireEvent.click(screen.getByRole('button', { name: /Answers rated helpful/ }));
    fireEvent.click(screen.getByRole('button', { name: /Edit prompts/ }));

    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual([
      'leads',
      'knowledge',
      'feedback',
      'prompts',
    ]);
    expect(screen.getByRole('button', { name: /Leads waiting for a call/ }).textContent).toContain(
      '2',
    );
  });

  it('warns on the knowledge tile when sources are waiting to be indexed', () => {
    hooks.index = index({ pendingKbEntries: 3, activeKbCount: 3 });
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('3 sources waiting to be indexed')).toBeDefined();
  });

  it('lists assistants with where they run in plain language', () => {
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('Vasco (Public)')).toBeDefined();
    expect(screen.getByText('Public website')).toBeDefined();
    expect(screen.getByText('Yes')).toBeDefined();
  });

  it('lists the most asked-about topics', () => {
    render(<OverviewTab onNavigate={vi.fn()} />);
    expect(screen.getByText('Retirement')).toBeDefined();
    expect(screen.getByText('Tax')).toBeDefined();
    expect(screen.getByTestId('area-chart')).toBeDefined();
  });
});
