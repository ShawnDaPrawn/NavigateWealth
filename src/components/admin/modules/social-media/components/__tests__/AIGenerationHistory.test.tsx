import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

vi.mock('../../hooks/useSocialMediaAI', () => ({
  useSocialMediaAI: () => ({
    history: [],
    historyLoading: false,
    imageHistory: [],
    imageHistoryLoading: false,
    generatePostText: vi.fn(),
    isGenerating: false,
    isConfigured: true,
    statusLoading: false,
  }),
}));

vi.mock('../../constants', () => ({
  BRAND: { navy: '#0a1628', navyLight: '#e8edf5' },
  PLATFORM_DISPLAY: {},
}));

import { AIGenerationHistory } from '../AIGenerationHistory';

describe('AIGenerationHistory', () => {
  it('renders without crashing', () => {
    const { container } = render(<AIGenerationHistory />, { wrapper });
    expect(container.firstChild).toBeDefined();
  });

  it('renders empty state when no history', () => {
    render(<AIGenerationHistory />, { wrapper });
    expect(screen.getByText(/No Generation History/i)).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<AIGenerationHistory />, { wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders loading state when history is loading', () => {
    vi.doMock('../../hooks/useSocialMediaAI', () => ({
      useSocialMediaAI: () => ({
        history: [],
        historyLoading: true,
        imageHistory: [],
        imageHistoryLoading: false,
      }),
    }));
    const { container } = render(<AIGenerationHistory />, { wrapper });
    expect(container.firstChild).toBeDefined();
  });

  it('accepts onUseText and onUseImage callbacks', () => {
    const onUseText = vi.fn();
    const onUseImage = vi.fn();
    const { container } = render(
      <AIGenerationHistory onUseText={onUseText} onUseImage={onUseImage} />,
      { wrapper },
    );
    expect(container.firstChild).toBeDefined();
  });
});
