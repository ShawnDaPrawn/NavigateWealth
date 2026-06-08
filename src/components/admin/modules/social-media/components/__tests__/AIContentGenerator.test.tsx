import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

vi.mock('../../hooks/useSocialMediaAI', () => ({
  useSocialMediaAI: () => ({
    generatePostText: vi.fn(),
    isGenerating: false,
    isConfigured: true,
    statusLoading: false,
  }),
}));

import { AIContentGenerator } from '../AIContentGenerator';

describe('AIContentGenerator', () => {
  it('renders without crashing', () => {
    const { container } = render(<AIContentGenerator />, { wrapper });
    expect(container.firstChild).toBeDefined();
  });

  it('renders content generator heading', () => {
    render(<AIContentGenerator />, { wrapper });
    const headings = screen.queryAllByText(/AI Content/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(<AIContentGenerator />, { wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
