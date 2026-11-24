import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import PortalOperations from './PortalOperations';
import { api } from '../../../utils/api/client';
import type { VaultSummary } from '../../../shared/password-manager';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const acct: VaultSummary = {
  id: 'acct',
  name: 'Practice login',
  username: 'ops',
  url: 'https://example.com',
  revision: 'v1',
  connectionExpiresAt: null,
  collectionId: 'brokerage',
  kind: 'login',
  tags: [],
  category: '',
  aiAccess: 'never',
  askFirst: false,
  rotateMonths: 12,
  passwordChangedAt: null,
  hasOtp: false,
  health: { reused: false, stale: false, weak: false, exposed: false },
  seenByAi: [],
  portal: {
    provider: 'brightrock',
    homeUrl: '',
    brokerage: 'Practice',
    purpose: 'Reporting',
    expectedIdentity: 'Practice',
    mfaPrompt: '',
    brokers: [
      { brokerId: 'a', code: '101' },
      { brokerId: 'b', code: '202' },
    ],
  },
};
const setup = {
  brokers: [
    { id: 'a', name: 'Broker A' },
    { id: 'b', name: 'Broker B' },
  ],
  connections: [],
  workflows: [
    { id: 'flow', name: 'Commission report', kind: 'monthly_statement', provider: 'brightrock' },
  ],
  loginDefaults: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/setup')
      ? setup
      : path.endsWith('/history')
        ? { lastVerified: null, lastReport: null }
        : { runs: [] },
  );
});
afterEach(cleanup);
describe('super admin operations', () => {
  it('selects multiple linked brokers and one month in one run submission', async () => {
    render(<PortalOperations initialTab="Runs" accounts={[acct]} selected={acct} />);
    fireEvent.change(await screen.findByLabelText('Workflow'), { target: { value: 'flow' } });
    fireEvent.click(screen.getByLabelText(/Broker A · 101/));
    fireEvent.click(screen.getByLabelText(/Broker B · 202/));
    fireEvent.change(screen.getByLabelText('Statement month', { exact: true }), {
      target: { value: '2026-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/broker-operations/runs',
        expect.objectContaining({
          requestId: expect.any(String),
          accountId: 'acct',
          workflowId: 'flow',
          month: '2026-10',
          brokerIds: ['a', 'b'],
        }),
        expect.anything(),
      ),
    );
  });
  it('displays a one-time OAuth secret and clears it when dismissed', async () => {
    vi.mocked(api.post).mockResolvedValue({
      client: { id: 'client-id' },
      clientSecret: 'test-secret',
    });
    render(<PortalOperations initialTab="AI connections" accounts={[]} selected={null} />);
    fireEvent.change(await screen.findByLabelText('Exact client callback URL'), {
      target: { value: 'https://example.com/callback' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }));
    await screen.findByDisplayValue('test-secret');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByDisplayValue('test-secret')).toBeNull();
  });
});
