import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ApprovalsTab from './ApprovalsTab';
import { api } from '../../../utils/api/client';
import type { VaultApproval } from '../../../shared/password-manager';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const approval: VaultApproval = {
  id: 'a1',
  connectionId: 'c1',
  connectionName: 'Amy’s Claude',
  personName: 'Amy',
  action: 'reveal',
  credentialId: 'id',
  credentialName: 'Portal',
  workflowId: null,
  runId: null,
  reason: 'Needs the statement',
  detail: '',
  requiredApprovals: 1,
  approvals: [],
  state: 'pending',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
};
let pending: VaultApproval[];
beforeEach(() => {
  vi.resetAllMocks();
  pending = [approval];
  vi.mocked(api.get).mockImplementation(async (path: string) =>
    path.endsWith('state=pending')
      ? { items: pending }
      : { items: [...pending, { ...approval, id: 'old', state: 'denied' }] },
  );
  vi.mocked(api.post).mockImplementation(async () => {
    pending = [];
    return {};
  });
});
afterEach(cleanup);

describe('approvals', () => {
  it('approves a pending request and updates the count', async () => {
    const onCount = vi.fn();
    render(<ApprovalsTab onCountChange={onCount} />);
    const card = await screen.findByRole('article', { name: 'Reveal the password · Portal' });
    expect(within(card).getByText('Needs the statement')).toBeTruthy();
    expect(onCount).toHaveBeenCalledWith(1);
    fireEvent.click(within(card).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/password-vault/approvals/a1/approve',
        {},
        expect.anything(),
      ),
    );
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0));
    expect(screen.getByText('Recently decided')).toBeTruthy();
  });
});
