import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({
  status: {
    data: {
      configured: true,
      account: { email: 'ops@nw.co', organizations: [{ id: 'o', name: 'Navigate Wealth' }] },
    },
  } as { data?: unknown },
  profiles: [] as unknown[],
  loading: false,
  error: null as string | null,
}));

vi.mock('../hooks/useSocialProfiles', () => ({
  useBufferStatus: () => state.status,
  useSocialProfiles: () => ({
    profiles: state.profiles,
    loading: state.loading,
    error: state.error,
  }),
}));
vi.mock('../components/LinkedInConnector', () => ({
  LinkedInConnector: () => <div>LinkedIn personal card</div>,
}));

import { ChannelsPanel } from '../ChannelsPanel';

beforeEach(() => {
  state.profiles = [
    {
      id: 'li',
      platform: 'linkedin',
      name: 'Navigate Wealth',
      username: 'navigatewealth',
      isConnected: true,
      accountType: 'organization',
      timezone: 'Africa/Johannesburg',
      postingSchedule: [{ day: 'mon', times: ['07:30', '12:00'], paused: false }],
      externalLink: 'https://linkedin.com/company/1',
    },
    {
      id: 'ig',
      platform: 'instagram',
      name: 'navigate_wealth',
      username: 'navigate_wealth',
      isConnected: false,
      accountType: 'business',
      postingSchedule: [],
    },
  ];
  state.status = {
    data: {
      configured: true,
      account: { email: 'ops@nw.co', organizations: [{ id: 'o', name: 'Navigate Wealth' }] },
    },
  };
});

describe('ChannelsPanel', () => {
  it('shows connected and disconnected channels, and which expected channel is missing', () => {
    render(<ChannelsPanel />);
    expect(screen.getByText('Organisation “Navigate Wealth” · ops@nw.co')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByText('Needs reconnect')).toBeDefined();
    expect(screen.getByText('2 queue slots per week · Africa/Johannesburg')).toBeDefined();
    expect(screen.getByText(/Not connected in Buffer/)).toBeDefined();
    expect(screen.getByText('X')).toBeDefined();
  });

  it('explains an unconfigured Buffer key', () => {
    state.status = { data: { configured: false } };
    state.profiles = [];
    render(<ChannelsPanel />);
    expect(screen.getByText('Buffer is not configured')).toBeDefined();
  });
});
