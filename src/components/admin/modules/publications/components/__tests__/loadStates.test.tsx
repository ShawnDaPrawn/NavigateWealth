/**
 * Publications tabs: a failed load shows the shared error state with Try
 * again and details (never a toast-and-empty list), and loading is a skeleton.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

const api = vi.hoisted(() => ({
  getTemplates: vi.fn(),
  getConfigs: vi.fn(),
  getContentSources: vi.fn(),
}));
vi.mock('../../api', () => ({
  PublicationsAPI: {
    Templates: { getTemplates: api.getTemplates },
    AutoContent: {
      getConfigs: api.getConfigs,
      getContentSources: api.getContentSources,
      getCalendarEvents: vi.fn(async () => []),
      getRunHistory: vi.fn(async () => []),
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ContentTemplates } from '../ContentTemplates';
import { AutoContentPanel } from '../AutoContentPanel';
import { ContentSourcesManager } from '../ContentSourcesManager';

const renderR = (ui: ReactElement) => render(ui, { wrapper: MemoryRouter });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Publications load states', () => {
  it('templates: skeleton while loading, then the shared error with Try again', async () => {
    let fail: (e: Error) => void = () => undefined;
    api.getTemplates.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
    renderR(<ContentTemplates />);
    expect(screen.getByTestId('templates-loading').getAttribute('aria-busy')).toBe('true');
    fail(new Error('400 Bad Request'));
    expect(await screen.findByText('Unable to load templates')).toBeDefined();
    api.getTemplates.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.getTemplates).toHaveBeenCalledTimes(2));
  });

  it('automation: shared error when the pipelines fail to load', async () => {
    api.getConfigs.mockRejectedValue(new Error('400'));
    renderR(<AutoContentPanel categories={[]} />);
    expect(await screen.findByText('Unable to load content pipelines')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('content sources: shared error when the sources fail to load', async () => {
    api.getContentSources.mockRejectedValue(new Error('400'));
    renderR(<ContentSourcesManager />);
    expect(await screen.findByText('Unable to load content sources')).toBeDefined();
  });
});
