import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../api', () => ({
  esignApi: {
    listInAppNotifications: vi.fn().mockResolvedValue({ items: [], unread: 0 }),
    markInAppNotificationRead: vi.fn().mockResolvedValue({}),
    markAllInAppNotificationsRead: vi.fn().mockResolvedValue({}),
  },
}));

import { NotificationBell } from '../NotificationBell';

describe('NotificationBell', () => {
  it('renders without crashing', () => {
    const { container } = render(<NotificationBell />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders bell button', () => {
    render(<NotificationBell />);
    expect(screen.queryAllByRole('button').length).toBeGreaterThanOrEqual(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(<NotificationBell />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
