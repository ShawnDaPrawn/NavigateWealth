import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { BreadcrumbContext } from '../../../layout/page/breadcrumbContext';

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
vi.mock('../hooks', () => ({
  useHandoffs: () => ({ data: [{ id: 'h1' }, { id: 'h2' }] }),
}));

import { AIManagementModule } from '../AIManagementModule';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderModule(entry = '/admin?module=ai-management') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AIManagementModule />
      <Search />
    </MemoryRouter>,
  );
}

/** Radix tabs switch on mouse down. */
function pickTab(name: string) {
  const tab = screen.getByRole('tab', { name: new RegExp(`^${name}`) });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe('AIManagementModule', () => {
  it('renders the AI Management heading', () => {
    renderModule();
    expect(screen.getByRole('heading', { level: 1, name: 'AI Management' })).toBeDefined();
  });

  it('opens on Overview and exposes exactly five tabs', () => {
    renderModule();
    expect(screen.getByText('overview-content')).toBeDefined();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('shows how many leads are waiting on the Leads tab', () => {
    renderModule();
    expect(screen.getByRole('tab', { name: /^Leads/ }).textContent).toBe('Leads2');
  });

  it('switches content for every tab and writes the tab to the address', () => {
    renderModule();
    pickTab('Knowledge');
    expect(screen.getByText('knowledge-content')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toContain('tab=knowledge');
    pickTab('Prompts');
    expect(screen.getByText('prompts-content')).toBeDefined();
    pickTab('Feedback');
    expect(screen.getByText('feedback-content')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toContain('tab=feedback');
    pickTab('Leads');
    expect(screen.getByText('leads-content')).toBeDefined();
    expect(screen.queryByText('overview-content')).toBeNull();
    // The module parameter is kept.
    expect(screen.getByTestId('search').textContent).toContain('module=ai-management');
  });

  it('opens the tab named in the address', () => {
    renderModule('/admin?module=ai-management&tab=prompts');
    expect(screen.getByText('prompts-content')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Prompts' }).getAttribute('aria-selected')).toBe('true');
  });

  it('lets the Overview tab navigate to another tab', () => {
    renderModule();
    fireEvent.click(screen.getByText('go-to-leads'));
    expect(screen.getByText('leads-content')).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Leads/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('search').textContent).toContain('tab=leads');
  });

  it('steps the header and tabs aside while a knowledge entry page is open', () => {
    renderModule('/admin?module=ai-management&tab=knowledge&entry=new');
    expect(screen.getByText('knowledge-content')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'AI Management' })).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('sets the top-bar breadcrumb to the tab, and to New entry on the entry page', () => {
    const setTrail = vi.fn();
    const { unmount } = render(
      <BreadcrumbContext.Provider value={{ trail: [], setTrail }}>
        <MemoryRouter initialEntries={['/admin?module=ai-management&tab=prompts']}>
          <AIManagementModule />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    expect(setTrail).toHaveBeenLastCalledWith([{ label: 'Prompts' }]);
    unmount();

    render(
      <BreadcrumbContext.Provider value={{ trail: [], setTrail }}>
        <MemoryRouter initialEntries={['/admin?module=ai-management&tab=knowledge&entry=new']}>
          <AIManagementModule />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    expect(setTrail).toHaveBeenLastCalledWith([
      expect.objectContaining({ label: 'Knowledge' }),
      { label: 'New entry' },
    ]);
  });
});
