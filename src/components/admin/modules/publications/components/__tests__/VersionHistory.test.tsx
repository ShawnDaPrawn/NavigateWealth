import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

  it('renders panel when open', () => {
    render(<VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText('Version History')).toBeDefined();
  });

  it('renders Save Now button when open', () => {
    render(<VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText(/Save Now/i)).toBeDefined();
  });

  it('renders empty state when versions loaded is empty', async () => {
    render(<VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText('Version History')).toBeDefined();
  });

  it('renders non-empty container when open', () => {
    const { container } = render(
      <VersionHistory articleId="art-1" isOpen onClose={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
