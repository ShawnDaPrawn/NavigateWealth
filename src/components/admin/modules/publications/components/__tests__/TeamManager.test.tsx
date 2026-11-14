/**
 * Team: the add / edit form is a page with its own address, validates on
 * submit, and each member has a show/hide switch.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MEMBER = {
  id: 'm-1',
  name: 'Naledi Khumalo',
  title: 'Senior Wealth Advisor',
  credentials: 'CFP',
  bio: '',
  specialties: [],
  image: '',
  sortOrder: 1,
  active: true,
};

import { TeamManager } from '../TeamManager';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ members: [MEMBER], data: [MEMBER], success: true }),
    })),
  );
});

function renderAt(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <TeamManager />
    </MemoryRouter>,
  );
}

describe('TeamManager', () => {
  it('opens "Add team member" as a page and validates on submit', async () => {
    renderAt('?tab=team&page=team-new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Add team member' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('Fix 2 fields to add member.')).toBeDefined();
    expect(screen.getByLabelText(/^Name/).getAttribute('aria-invalid')).toBe('true');
  });

  it('shows a switch per member for the team page', async () => {
    renderAt('?tab=team');
    await waitFor(() => expect(screen.getByText('Naledi Khumalo')).toBeDefined());
    expect(
      screen.getByRole('switch', { name: 'Show Naledi Khumalo on the team page' }),
    ).toBeDefined();
  });
});
