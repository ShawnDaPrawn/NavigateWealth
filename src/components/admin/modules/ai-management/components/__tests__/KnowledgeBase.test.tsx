import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

vi.mock('../../constants', () => ({
  QUERY_STALE_TIME: 120000,
  ANALYTICS_STALE_TIME: 300000,
  ENDPOINTS: {},
  KB_ENTRY_TYPE_CONFIG: {
    qa: {
      label: 'Q&A',
      icon: 'HelpCircle',
      badgeClass: 'bg-blue-100 text-blue-700',
      description: '',
    },
    article: { label: 'Article', icon: 'FileText', badgeClass: '', description: '' },
    snippet: { label: 'Snippet', icon: 'Code', badgeClass: '', description: '' },
    faq: { label: 'FAQ', icon: 'MessageCircleQuestion', badgeClass: '', description: '' },
    policy: { label: 'Policy', icon: 'Shield', badgeClass: '', description: '' },
  },
  KB_STATUS_CONFIG: {
    draft: { label: 'Draft', badgeClass: '', dotClass: '' },
    active: { label: 'Active', badgeClass: '', dotClass: '' },
    archived: { label: 'Archived', badgeClass: '', dotClass: '' },
  },
  KB_DEFAULT_CATEGORIES: ['Financial Planning', 'Risk Management'],
  TAB_CONFIG: [],
}));

vi.mock('../../hooks', () => ({
  useKBEntries: () => ({ data: [], isLoading: false }),
  useKBStats: () => ({ data: { total: 0, active: 0, archived: 0, by_type: {} } }),
  useCreateKBEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateKBEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteKBEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../KBEntryModal', () => ({
  KBEntryModal: () => null,
}));

import { KnowledgeBase } from '../KnowledgeBase';

describe('KnowledgeBase', () => {
  it('renders without crashing', () => {
    const { container } = render(<KnowledgeBase />, { wrapper });
    expect(container.firstChild).toBeDefined();
  });

  it('renders Total Entries stat card', () => {
    render(<KnowledgeBase />, { wrapper });
    expect(screen.getByText(/Total Entries/i)).toBeDefined();
  });

  it('renders search input', () => {
    render(<KnowledgeBase />, { wrapper });
    expect(screen.getByPlaceholderText(/Search entries/i)).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<KnowledgeBase />, { wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
