import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const perms = vi.hoisted(() => ({ marketing: false }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({
    can: (key: string) => (key === 'marketing' ? perms.marketing : false),
    isLoading: false,
  }),
}));
vi.mock('../SocialMediaTab', () => ({ SocialMediaTab: () => <div>Social body</div> }));

import { SocialMediaModule } from '../SocialMediaModule';

describe('SocialMediaModule', () => {
  it('shows the shared no-access state without the Marketing permission', () => {
    perms.marketing = false;
    render(
      <MemoryRouter>
        <SocialMediaModule />
      </MemoryRouter>,
    );
    expect(screen.getByText(/don.t have access to Social & Marketing/i)).toBeDefined();
    expect(screen.queryByText('Social body')).toBeNull();
  });

  it('renders the module for marketing users, even without Publications', () => {
    perms.marketing = true;
    render(
      <MemoryRouter>
        <SocialMediaModule />
      </MemoryRouter>,
    );
    expect(screen.getByText('Social body')).toBeDefined();
  });
});
