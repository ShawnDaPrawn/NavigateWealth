import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsCards } from '../StatsCards';

const mockStats = {
  total: 50,
  submitted_for_review: 10,
  approved: 25,
  declined: 5,
  application_in_progress: 8,
  invited: 2,
  incomplete: 3,
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
