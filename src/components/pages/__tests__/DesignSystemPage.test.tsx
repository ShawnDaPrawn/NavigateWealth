import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { MemoryRouter } from 'react-router';
import DesignSystemPage from '../DesignSystemPage';

vi.mock('../../features/codebase/DownloadCodebaseTab', () => ({
  DownloadCodebaseTab: () => <div>Download Tab</div>,
}));

vi.mock('../design-system/TypographyTab', () => ({
  TypographyTab: () => <div>Typography Tab</div>,
}));

vi.mock('../design-system/IconsTab', () => ({
  IconsTab: () => <div>Icons Tab</div>,
}));

vi.mock('../design-system/PatternsTab', () => ({
  PatternsTab: () => <div>Patterns Tab</div>,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DesignSystemPage />
    </MemoryRouter>,
  );
}

describe('DesignSystemPage', () => {
  it('renders without crashing', () => {
    renderPage();
  });

  it('shows the Design System badge', () => {
    renderPage();
    expect(screen.getByText('Design System v5')).toBeTruthy();
  });

  it('shows the main tab headings', () => {
    renderPage();
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Colours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Components').length).toBeGreaterThan(0);
  });
});
