import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const counts = vi.hoisted(() => ({
  value: {
    applications: { count: 3 },
    submissions: { count: 0, failed: true },
    issues: { count: 2 },
  } as Record<string, { count: number; failed?: boolean }>,
}));

vi.mock('../../../../hooks/usePendingCounts', () => ({
  usePendingCounts: () => counts.value,
}));

import { NeedsAttentionCard } from '../NeedsAttentionCard';

describe('NeedsAttentionCard', () => {
  it('shows "—" for a count that failed to load instead of a misleading 0', () => {
    render(<NeedsAttentionCard tasksDueToday={0} tasksDueTodayFailed />);
    const submissions = screen.getByRole('button', { name: /Submissions/ });
    expect(within(submissions).getByText('—')).toBeDefined();
    expect(within(submissions).getByText("Couldn't load")).toBeDefined();
    const tasks = screen.getByRole('button', { name: /To-Do/ });
    expect(within(tasks).getByText('—')).toBeDefined();
    const applications = screen.getByRole('button', { name: /Applications/ });
    expect(within(applications).getByText('3')).toBeDefined();
  });
});
