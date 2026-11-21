import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../api', () => ({
  esignApi: {
    listInAppNotifications: vi.fn().mockResolvedValue({ items: [], unread: 1 }),
    markInAppNotificationRead: vi.fn().mockResolvedValue({}),
    markAllInAppNotificationsRead: vi.fn().mockResolvedValue({}),
  },
}));

import { NotificationBell } from '../NotificationBell';

describe('NotificationBell', () => {
  it('renders without crashing', async () => {
    const { container } = render(<NotificationBell />);
    await screen.findByRole('button', { name: 'Notifications (1 unread)' });
    expect(container.firstChild).toBeDefined();
  });

  it('renders bell button', async () => {
    render(<NotificationBell />);
    expect(await screen.findByRole('button', { name: 'Notifications (1 unread)' })).toBeDefined();
  });

  it('renders non-empty container', async () => {
    const { container } = render(<NotificationBell />);
    await screen.findByRole('button', { name: 'Notifications (1 unread)' });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
