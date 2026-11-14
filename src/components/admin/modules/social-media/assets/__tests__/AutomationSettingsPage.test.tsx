/**
 * Automation settings & playbooks is a page of its own: back link, one Save in
 * the header, and the five sections as a segmented control in the address.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

const hooks = vi.hoisted(() => {
  const settings = {
    enabled: true,
    posting_timezone: 'Africa/Johannesburg',
    preferred_slots: {},
    channels: ['linkedin', 'instagram', 'x'],
    assets_per_channel: 5,
    posts_per_channel_per_week: 2,
    site_origin: 'https://www.navigatewealth.co',
    style_guide: 'Plain English.',
    compliance_rules: 'No guarantees.',
  };
  const playbooks: unknown[] = [];
  return {
    settings,
    playbooks,
    updateSettings: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
    updatePlaybook: { mutateAsync: vi.fn(() => Promise.resolve()), isPending: false },
  };
});

vi.mock('../../hooks/useSocialAssets', () => ({
  useSocialAutomationSettings: () => ({
    data: hooks.settings,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSocialPlaybooks: () => ({ data: hooks.playbooks }),
  useUpdateSocialSettings: () => hooks.updateSettings,
  useUpdateSocialPlaybook: () => hooks.updatePlaybook,
}));

import { AutomationSettingsPage } from '../AutomationSettingsPage';

function Location() {
  return <div data-testid="location">{useLocation().search}</div>;
}

function renderPage(search = '', onBack = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <AutomationSettingsPage onBack={onBack} />
      <Location />
    </MemoryRouter>,
  );
  return onBack;
}

beforeEach(() => vi.clearAllMocks());

describe('AutomationSettingsPage', () => {
  it('is a page with a way back and the five sections as a segmented control', () => {
    const onBack = renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Automation settings & playbooks' }),
    ).toBeDefined();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'General',
      'Posting slots',
      'Style guide',
      'Compliance',
      'Playbooks',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /weekly pipeline/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('opens the section named in the address', () => {
    renderPage('?section=style');
    expect(screen.getByRole('tab', { name: 'Style guide' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByLabelText('Style guide (read by both routines)')).toBeDefined();
  });

  it('validates before saving and shows the problem inline', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Site origin (for article links)'), {
      target: { value: 'navigatewealth' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(hooks.updateSettings.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves valid settings', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(hooks.updateSettings.mutateAsync).toHaveBeenCalledTimes(1));
  });
});
