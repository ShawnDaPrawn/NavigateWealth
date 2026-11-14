import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Versions: {
      getVersions: vi.fn().mockResolvedValue([]),
      createVersion: vi.fn().mockResolvedValue({}),
      restoreVersion: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { VersionHistory } from '../VersionHistory';

describe('VersionHistory', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <VersionHistory articleId="art-1" isOpen={false} onClose={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is a page with the article as its way back', () => {
    const onClose = vi.fn();
    render(
      <VersionHistory
        articleId="art-1"
        articleTitle="Gap cover"
        isOpen
        onClose={onClose}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Version history' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /gap cover/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('offers to save a snapshot now', () => {
    render(<VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save snapshot now/i })).toBeDefined();
  });

  it('renders the empty state when there are no versions', async () => {
    render(<VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />);
    expect(await screen.findByText('No versions yet')).toBeDefined();
  });

  it('renders non-empty container when open', () => {
    const { container } = render(
      <VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
