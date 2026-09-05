import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../components/OverviewTab', () => ({
  OverviewTab: ({ onNavigate }: { onNavigate: (t: string) => void }) => (
    <div>
      <p>overview-content</p>
      <button type="button" onClick={() => onNavigate('leads')}>
        go-to-leads
      </button>
    </div>
  ),
}));
vi.mock('../components/KnowledgeBase', () => ({ KnowledgeBase: () => <p>knowledge-content</p> }));
vi.mock('../components/PromptStudio', () => ({ PromptStudio: () => <p>prompts-content</p> }));
vi.mock('../components/FeedbackReview', () => ({ FeedbackReview: () => <p>feedback-content</p> }));
vi.mock('../components/HandoffQueue', () => ({ HandoffQueue: () => <p>leads-content</p> }));

import { AIManagementModule } from '../AIManagementModule';

describe('AIManagementModule', () => {
  it('opens on Overview and exposes exactly five tabs', () => {
    render(<AIManagementModule />);
    expect(screen.getByText('overview-content')).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows the active tab description under the tab bar', () => {
    render(<AIManagementModule />);
    expect(screen.getByText(/Switch Vasco on or off and see how it is being used/)).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Knowledge' }));
    expect(screen.getByText('knowledge-content')).toBeDefined();
    expect(screen.getByText(/What Vasco can draw on when it answers/)).toBeDefined();
  });

  it('switches content for every tab', () => {
    render(<AIManagementModule />);
    fireEvent.click(screen.getByRole('tab', { name: 'Prompts' }));
    expect(screen.getByText('prompts-content')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Feedback' }));
    expect(screen.getByText('feedback-content')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Leads' }));
    expect(screen.getByText('leads-content')).toBeDefined();
    expect(screen.queryByText('overview-content')).toBeNull();
  });

  it('lets the Overview tab navigate to another tab', () => {
    render(<AIManagementModule />);
    fireEvent.click(screen.getByText('go-to-leads'));
    expect(screen.getByText('leads-content')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Leads' }).getAttribute('aria-selected')).toBe('true');
  });
});
