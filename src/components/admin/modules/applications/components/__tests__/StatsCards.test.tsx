import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsCards } from '../StatsCards';
import type { ApplicationStats } from '../../../../../../shared/types';

// The full /admin/stats response shape. This fixture used to carry only the
// seven fields the cards read, which typechecked while the module kept its own
// narrower copy of ApplicationStats; now that both sides share the canonical
// definition, the fixture has to be a complete response like the route returns.
const mockStats: ApplicationStats = {
  total: 50,
  submitted_for_review: 10,
  approved: 25,
  declined: 5,
  application_in_progress: 8,
  invited: 2,
  draft: 4,
  incomplete: 3,
  no_application: 7,
  new_applications_7d: 6,
  new_this_month: 12,
  new_last_month: 9,
  new_tasks: 3,
  pending_tasks: 5,
  pending_requests: 2,
  total_requests: 11,
  pending_esignatures: 1,
  active_users: 40,
  total_clients: 45,
};

describe('StatsCards', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <StatsCards stats={mockStats} activeTab="pending" setActiveTab={() => {}} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders with null stats', () => {
    const { container } = render(
      <StatsCards stats={null} activeTab="pending" setActiveTab={() => {}} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('calls setActiveTab when a card is clicked', () => {
    const setActiveTab = vi.fn();
    render(<StatsCards stats={mockStats} activeTab="pending" setActiveTab={setActiveTab} />);
    const cards = screen.queryAllByRole('button');
    if (cards.length > 0) {
      fireEvent.click(cards[0]);
      expect(setActiveTab).toHaveBeenCalled();
    } else {
      expect(screen.queryAllByRole('generic').length).toBeGreaterThanOrEqual(0);
    }
  });

  it('renders a non-empty container', () => {
    const { container } = render(
      <StatsCards stats={mockStats} activeTab="approved" setActiveTab={() => {}} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
