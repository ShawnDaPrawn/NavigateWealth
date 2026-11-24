import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import PasswordManager from './PasswordManager';
import { api } from '../../../utils/api/client';
import type { Collection, VaultLockState, VaultSummary } from '../../../shared/password-manager';
vi.mock('../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const summary = (over: Partial<VaultSummary>): VaultSummary => ({
  id: 'id',
  name: 'Portal',
  url: 'https://example.com/login',
  username: 'amy',
  revision: 'revision',
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
  ...over,
});
const items = [
  summary({}),
  summary({ id: 'pid', name: 'Personal bank', url: 'https://example.com', collectionId: 'amy' }),
];
const collections: Collection[] = [
  {
    id: 'brokerage',
    name: 'Brokerage',
    kind: 'brokerage',
    ownerUserId: null,
    ownerName: '',
    createdAt: '',
  },
  {
    id: 'amy',
    name: 'Amy’s logins',
    kind: 'person',
    ownerUserId: 'u2',
    ownerName: 'Amy',
    createdAt: '',
  },
];
const locked = new Error('Vault locked') as Error & { statusCode: number; code: string };
locked.statusCode = 423;
locked.code = 'VAULT_LOCKED';

let status: VaultLockState;
let listFails = false;
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/admin');
  sessionStorage.clear();
  status = { unlocked: true, twoFactorEnabled: true, twoFactorRequired: true, expiresAt: null };
  listFails = false;
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/password-vault/status') return status;
    if (path === '/password-vault/collections') return { items: collections };
    if (path.startsWith('/password-vault/approvals')) return { items: [] };
    if (path === '/password-vault') {
      if (listFails) throw locked;
      return { items, nextCursor: null };
    }
    if (path === '/broker-operations/setup')
      return { brokers: [], workflows: [], connections: [], loginDefaults: {} };
    if (path.startsWith('/broker-operations/runs/')) throw new Error('Not found');
    return { items: [], runs: [] };
  });
});
afterEach(cleanup);
const button = (name: string) => screen.getByRole('button', { name });

describe('unlock gate', () => {
  it('asks for two-factor when the account has none', async () => {
    status = { unlocked: false, twoFactorEnabled: false, twoFactorRequired: true, expiresAt: null };
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    const link = await screen.findByRole('link', { name: 'Open security settings' });
    expect(link.getAttribute('href')).toBe('/security');
    expect(screen.queryByRole('tablist', { name: 'Password manager' })).toBeNull();
  });

  it('sends a code, verifies it and unlocks', async () => {
    status = { unlocked: false, twoFactorEnabled: true, twoFactorRequired: true, expiresAt: null };
    vi.mocked(api.post).mockImplementation(async (path: string) =>
      path === '/password-vault/unlock'
        ? { unlocked: true, twoFactorEnabled: true, twoFactorRequired: true, expiresAt: null }
        : { success: true },
    );
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send code' }));
    const input = await screen.findByLabelText('Verification code');
    expect(api.post).toHaveBeenCalledWith('/security/u1/2fa/send-code', {}, expect.anything());
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(button('Unlock'));
    await screen.findByRole('tablist', { name: 'Password manager' });
    expect(api.post).toHaveBeenCalledWith(
      '/security/u1/2fa/verify-code',
      { code: '123456' },
      expect.anything(),
    );
    expect(api.post).toHaveBeenCalledWith('/password-vault/unlock', {}, expect.anything());
    await screen.findByText('Personal bank');
  });

  it('returns to the gate when a vault call answers locked', async () => {
    listFails = true;
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    await screen.findByRole('heading', { name: 'Unlock the vault' });
    expect(screen.queryByRole('tablist', { name: 'Password manager' })).toBeNull();
  });

  it('opens straight away for a super admin, with no code and no Lock button', async () => {
    status = { unlocked: true, twoFactorEnabled: false, twoFactorRequired: false, expiresAt: null };
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    await screen.findByText('Personal bank');
    expect(screen.queryByRole('heading', { name: /two-factor|Unlock the vault/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
    expect(api.post).not.toHaveBeenCalledWith(
      '/security/u1/2fa/send-code',
      expect.anything(),
      expect.anything(),
    );
  });

  it('locks on request', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    await screen.findByText('Personal bank');
    fireEvent.click(button('Lock'));
    await screen.findByRole('heading', { name: 'Unlock the vault' });
    expect(api.post).toHaveBeenCalledWith('/password-vault/lock', {}, expect.anything());
  });
});

describe('vault', () => {
  it('lists credentials and filters by collection', async () => {
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    await screen.findByText('Personal bank');
    expect(screen.getByRole('button', { name: 'Portal' })).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Collections and views' });
    fireEvent.click(within(rail).getByRole('button', { name: /Amy’s logins/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Portal' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Personal bank' })).toBeTruthy();
    fireEvent.click(within(rail).getByRole('button', { name: /All items/ }));
    expect(screen.getByRole('button', { name: 'Portal' })).toBeTruthy();
  });

  it('reveals on edit, masks the password and saves changes', async () => {
    vi.mocked(api.post).mockResolvedValue({ ...items[0], password: 'test pass', notes: 'note' });
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Portal' }));
    expect(api.post).not.toHaveBeenCalledWith(
      '/password-vault/id/reveal',
      expect.anything(),
      expect.anything(),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const input = (await screen.findByLabelText('Password', { exact: true })) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(api.post).toHaveBeenCalledWith('/password-vault/id/reveal', {}, expect.anything());
    const form = input.closest('form')!;
    fireEvent.click(within(form).getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    fireEvent.change(input, { target: { value: 'new pass' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save credential' }));
    await screen.findByText('Credential saved.');
    expect(api.put).toHaveBeenCalledWith(
      '/password-vault/id',
      expect.objectContaining({
        revision: 'revision',
        credential: expect.objectContaining({ password: 'new pass' }),
        clearPortal: false,
      }),
      expect.anything(),
    );
    expect(screen.queryByDisplayValue('new pass')).toBeNull();
  });

  it('opens broker reporting from a ?brokerRun= link', async () => {
    window.history.replaceState(null, '', '/admin?brokerRun=run-1');
    render(<PasswordManager onClose={vi.fn()} userId="u1" />);
    const tab = await screen.findByRole('tab', { name: 'Broker reporting' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});
