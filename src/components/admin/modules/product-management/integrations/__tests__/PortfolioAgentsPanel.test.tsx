/**
 * PortfolioAgentsPanel — render / interaction test.
 *
 * Pins the operator's side of one token per agent: only a super admin sees or
 * fetches the tokens; a token is shown once, right after it is issued, and is
 * gone once dismissed; a name is checked before it is sent; and revoking asks
 * first.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithQueryClient, screen, waitFor, within } from '@/test/utils';
import type { PortfolioAgent } from '@/shared/integrations/portfolio-table';

const api = vi.hoisted(() => ({
  listPortfolioAgents: vi.fn(),
  issuePortfolioAgentToken: vi.fn(),
  revokePortfolioAgentToken: vi.fn(),
}));
const permissions = vi.hoisted(() => ({ isSuperAdmin: true }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('@/components/admin/modules/product-management/api', () => ({
  productManagementApi: api,
}));
vi.mock('@/components/admin/modules/personnel', () => ({
  useCurrentUserPermissions: () => permissions,
}));
vi.mock('sonner', () => ({ toast }));

import { PortfolioAgentsPanel } from '../PortfolioAgentsPanel';

const agent = (overrides: Partial<PortfolioAgent>): PortfolioAgent => ({
  name: 'grok',
  createdAt: '2026-10-01T08:00:00.000Z',
  createdBy: 'admin:owner-1',
  lastUsedAt: null,
  revokedAt: null,
  revokedBy: null,
  ...overrides,
});

const agents: PortfolioAgent[] = [
  agent({ name: 'grok', lastUsedAt: '2026-10-01T09:30:00.000Z' }),
  agent({ name: 'shared', createdAt: '2026-09-30T11:40:09.000Z', createdBy: 'migration' }),
  agent({
    name: 'chatgpt',
    createdAt: '2026-09-29T10:00:00.000Z',
    revokedAt: '2026-09-30T10:00:00.000Z',
    revokedBy: 'admin:owner-1',
  }),
];

const TOKEN = 'nwpa_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcd';

beforeEach(() => {
  vi.clearAllMocks();
  permissions.isSuperAdmin = true;
  api.listPortfolioAgents.mockResolvedValue(agents);
});

const nameInput = () => screen.getByLabelText('Agent name');

describe('PortfolioAgentsPanel', () => {
  it('tells anyone but a super admin who manages tokens, and fetches nothing', () => {
    permissions.isSuperAdmin = false;
    renderWithQueryClient(<PortfolioAgentsPanel />);
    expect(screen.getByText(/A super admin issues and revokes them here/)).toBeDefined();
    expect(screen.queryByLabelText('Agent name')).toBeNull();
    expect(api.listPortfolioAgents).not.toHaveBeenCalled();
  });

  it('lists every agent with when it was issued, last used, and whether it is live', async () => {
    renderWithQueryClient(<PortfolioAgentsPanel />);
    const grokRow = (await screen.findByRole('rowheader', { name: 'grok' })).closest('tr')!;
    expect(within(grokRow).getByText('Live')).toBeDefined();
    // Issued and last used, both on the 1st.
    expect(within(grokRow).getAllByText(/01 Oct 2026/)).toHaveLength(2);

    const sharedRow = screen.getByRole('rowheader', { name: /^shared/ }).closest('tr')!;
    expect(within(sharedRow).getByText('Never')).toBeDefined();
    // The token the migration carried over says what to do with it.
    expect(within(sharedRow).getByText(/Revoke it once every agent has its own/)).toBeDefined();

    const chatgptRow = screen.getByRole('rowheader', { name: 'chatgpt' }).closest('tr')!;
    expect(within(chatgptRow).getByText(/^Revoked 30 Sep 2026/)).toBeDefined();
    // A revoked token offers nothing more to do.
    expect(within(chatgptRow).queryByRole('button')).toBeNull();
  });

  it('issues a token, shows it once, and forgets it when dismissed', async () => {
    api.issuePortfolioAgentToken.mockResolvedValue({
      agent: agent({ name: 'claude-routine' }),
      token: TOKEN,
    });
    renderWithQueryClient(<PortfolioAgentsPanel />);
    await screen.findByRole('rowheader', { name: 'grok' });

    fireEvent.focus(nameInput());
    fireEvent.change(nameInput(), { target: { value: ' Claude-Routine ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));

    await waitFor(() =>
      expect(api.issuePortfolioAgentToken).toHaveBeenCalledWith('claude-routine'),
    );
    const revealed = await screen.findByRole('status');
    expect(within(revealed).getByText(TOKEN)).toBeDefined();
    expect(within(revealed).getByText(/shown only this once/)).toBeDefined();
    // The list is re-read so the new agent appears.
    await waitFor(() => expect(api.listPortfolioAgents).toHaveBeenCalledTimes(2));
    expect((nameInput() as HTMLInputElement).value).toBe('');

    fireEvent.click(within(revealed).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(TOKEN)).toBeNull();
  });

  it('checks a name before sending it', async () => {
    renderWithQueryClient(<PortfolioAgentsPanel />);
    await screen.findByRole('rowheader', { name: 'grok' });
    fireEvent.focus(nameInput());

    fireEvent.change(nameInput(), { target: { value: 'bad name!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    expect(await screen.findByText(/Use 2 to 40 lowercase letters/)).toBeDefined();

    fireEvent.change(nameInput(), { target: { value: 'development' } });
    expect(screen.getByText(/"development" is reserved/)).toBeDefined();

    // A name with a live token is refused here, before the server says 409.
    fireEvent.change(nameInput(), { target: { value: 'GROK' } });
    expect(screen.getByText(/"grok" already has a live token/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));

    expect(api.issuePortfolioAgentToken).not.toHaveBeenCalled();
  });

  it('allows a revoked name to be issued again, which is how a token is rotated', async () => {
    api.issuePortfolioAgentToken.mockResolvedValue({
      agent: agent({ name: 'chatgpt' }),
      token: TOKEN,
    });
    renderWithQueryClient(<PortfolioAgentsPanel />);
    await screen.findByRole('rowheader', { name: 'chatgpt' });
    fireEvent.focus(nameInput());
    fireEvent.change(nameInput(), { target: { value: 'chatgpt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    await waitFor(() => expect(api.issuePortfolioAgentToken).toHaveBeenCalledWith('chatgpt'));
  });

  it('asks before revoking, and revokes on confirmation', async () => {
    api.revokePortfolioAgentToken.mockResolvedValue(
      agent({ revokedAt: '2026-10-01T10:00:00.000Z' }),
    );
    renderWithQueryClient(<PortfolioAgentsPanel />);
    await screen.findByRole('rowheader', { name: 'grok' });

    fireEvent.click(screen.getByRole('button', { name: 'Revoke the token for grok' }));
    expect(screen.getByText('Revoke grok?')).toBeDefined();
    expect(api.revokePortfolioAgentToken).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Revoke grok?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke the token for grok' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }));
    await waitFor(() => expect(api.revokePortfolioAgentToken).toHaveBeenCalledWith('grok'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Revoked the token for grok'));
  });

  it('shows the refusal from the server when issuing fails', async () => {
    api.issuePortfolioAgentToken.mockRejectedValue(
      new Error('Forbidden: Super Admin access required'),
    );
    renderWithQueryClient(<PortfolioAgentsPanel />);
    await screen.findByRole('rowheader', { name: 'grok' });
    fireEvent.focus(nameInput());
    fireEvent.change(nameInput(), { target: { value: 'gemini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Forbidden: Super Admin access required'),
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
