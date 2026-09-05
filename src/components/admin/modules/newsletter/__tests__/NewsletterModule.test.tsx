import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import type { NewsletterCampaign } from '../types';

const hooks = vi.hoisted(() => ({
  campaign: {
    data: undefined as NewsletterCampaign | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetching: false,
  },
  dashboard: { data: undefined },
  seenViews: [] as unknown[],
}));

vi.mock('../hooks/useNewsletterStudio', () => ({
  useStudioCampaign: () => hooks.campaign,
  useStudioDashboard: () => hooks.dashboard,
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true, can: () => true, isLoading: false }),
}));
vi.mock('../components/CampaignsTab', () => ({
  CampaignsTab: ({ view }: { view: unknown }) => {
    hooks.seenViews.push(view);
    return <div data-testid="campaigns-tab">{JSON.stringify(view)}</div>;
  },
}));
vi.mock('../components/DashboardTab', () => ({
  DashboardTab: () => <div data-testid="dashboard-tab" />,
}));
vi.mock('../components/TemplatesTab', () => ({ TemplatesTab: () => <div /> }));
vi.mock('../components/AudiencesTab', () => ({ AudiencesTab: () => <div /> }));

import { NewsletterModule } from '../NewsletterModule';

function Location() {
  const [params] = useSearchParams();
  return <output data-testid="location">{params.toString()}</output>;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <NewsletterModule />
      <Location />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.seenViews.length = 0;
  hooks.campaign.data = undefined;
  hooks.campaign.isLoading = false;
  hooks.campaign.isError = false;
  hooks.campaign.error = null;
});

describe('NewsletterModule', () => {
  it('opens on the overview and puts a new-campaign request in the URL', () => {
    renderAt('?module=newsletter');
    expect(screen.getByTestId('dashboard-tab')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /new campaign/i }));
    expect(screen.getByTestId('location').textContent).toContain('campaign=new');
    expect(screen.getByTestId('campaigns-tab').textContent).toContain('"kind":"editor"');
  });

  it('shows a loading placeholder while an edit deep-link resolves its campaign', () => {
    hooks.campaign.isLoading = true;
    renderAt('?module=newsletter&campaign=c-1&edit=1');
    expect(screen.getByTestId('edit-target-loading')).toBeTruthy();
    expect(screen.queryByTestId('campaigns-tab')).toBeNull();
  });

  it('shows an actionable failure instead of a blank page when the edit target cannot load', () => {
    hooks.campaign.isError = true;
    hooks.campaign.error = new Error('Campaign c-1 not found');
    renderAt('?module=newsletter&campaign=c-1&edit=1');
    expect(screen.getByText('This campaign could not be opened for editing')).toBeTruthy();
    expect(screen.getByText('Campaign c-1 not found')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(hooks.campaign.refetch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to campaigns/i }));
    const location = screen.getByTestId('location').textContent ?? '';
    expect(location).toContain('nlTab=campaigns');
    expect(location).not.toContain('campaign=');
  });
});
