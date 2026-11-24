import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../../../../utils/api/client';
import type {
  ServiceSummary,
  Skill,
  VaultApproval,
  VaultSummary,
} from '../../../../../shared/password-manager';
import { PasswordManagerModule } from '../PasswordManagerModule';

vi.mock('../../../../../utils/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const service = (over: Partial<ServiceSummary>): ServiceSummary => ({
  id: 'navigate-wealth',
  name: 'Navigate Wealth',
  website: 'https://www.navigatewealth.co/admin',
  description: 'Our own platform.',
  builtIn: true,
  createdAt: '',
  logins: 0,
  skills: 0,
  ...over,
});
const login = (over: Partial<VaultSummary>): VaultSummary => ({
  id: 'l1',
  revision: 'r1',
  serviceId: 'ag',
  name: 'Broker 1234',
  url: 'https://login.allangray.co.za',
  username: 'b1234',
  collectionId: 'brokerage',
  aiUse: 'ask',
  rotateMonths: 12,
  passwordChangedAt: null,
  hasOtp: false,
  health: { reused: false, stale: false, weak: false, exposed: false },
  seenByAi: [],
  ...over,
});
const skill = (over: Partial<Skill>): Skill => ({
  id: 's1',
  revision: 'r',
  name: 'Download a statement',
  whenToUse: 'When asked for a monthly statement.',
  instructions: 'Open Reports, choose the month, download the PDF.',
  serviceId: 'ag',
  credentialId: null,
  updatedAt: '2026-11-01T00:00:00Z',
  updatedBy: 'admin',
  ...over,
});

const services = [
  service({ logins: 0 }),
  service({
    id: 'ag',
    name: 'Allan Gray',
    builtIn: false,
    website: 'https://login.allangray.co.za',
    logins: 1,
    skills: 1,
  }),
];
const logins = [login({})];
const skills = [
  skill({}),
  skill({ id: 's2', name: 'Broker 1234 only', credentialId: 'l1', whenToUse: '' }),
];
let approvals: VaultApproval[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  approvals = [];
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/password-vault') return { items: logins };
    if (path === '/password-vault/services') return { items: services };
    if (path === '/password-vault/skills') return { items: skills };
    if (path === '/password-vault/approvals') return { items: approvals };
    if (path === '/password-vault/connections') return { items: [], aiPaused: false };
    if (path.startsWith('/password-vault/events')) return { items: [], nextCursor: null };
    throw new Error('unexpected GET ' + path);
  });
});
afterEach(cleanup);

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function renderModule(entry = '/admin?module=password-manager') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <PasswordManagerModule />
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function pickTab(name: string) {
  const tab = screen.getByRole('tab', { name: new RegExp('^' + name) });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
}

describe('PasswordManagerModule', () => {
  it('is a normal module page with four tabs and no broker-reporting screens', async () => {
    renderModule();
    expect(screen.getByRole('heading', { level: 1, name: 'Password Manager' })).toBeDefined();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Logins',
      'Skills',
      'AI agents',
      'Activity',
    ]);
    await screen.findByText('Broker 1234');
    expect(screen.queryByText(/broker reporting/i)).toBeNull();
    expect(screen.getByText('Our platform')).toBeDefined();
  });

  it('lists Navigate Wealth first and groups logins under their service', async () => {
    renderModule();
    await screen.findByText('Broker 1234');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toMatch(/^Navigate Wealth/);
    expect(headings[1]).toMatch(/^Allan Gray/);
    expect(
      screen.getByText(/Add the Navigate Wealth account your AI agents sign in with/),
    ).toBeDefined();
  });

  it('opens a login with its shared skills, then its own, and previews what an agent reads', async () => {
    renderModule();
    fireEvent.click(await screen.findByText('Broker 1234'));
    expect(await screen.findByText('What an agent reads for this login')).toBeDefined();
    expect(screen.getByText('Shared by every Allan Gray login')).toBeDefined();
    expect(screen.getByText('Download a statement')).toBeDefined();
    expect(screen.getByText('Broker 1234 only')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = await screen.findByRole('dialog');
    const text = within(dialog).getByText(/Working with/).textContent ?? '';
    expect(text.indexOf('Download a statement')).toBeLessThan(text.indexOf('Broker 1234 only'));
    expect(text).not.toMatch(/password:/i);
  });

  it('saves a shared skill written in plain English', async () => {
    vi.mocked(api.post).mockResolvedValue(skill({ id: 'new' }));
    renderModule('/admin?module=password-manager&tab=skills&skill=new&skillService=ag');
    fireEvent.change(await screen.findByLabelText('What is the job?'), {
      target: { value: 'Check a client’s holdings' },
    });
    fireEvent.change(screen.getByLabelText(/When should an agent use it/), {
      target: { value: 'When asked what a client holds.' },
    });
    fireEvent.change(screen.getByLabelText(/^Instructions/), {
      target: { value: 'Search the client, open Holdings, report the values.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/password-vault/skills',
        {
          name: 'Check a client’s holdings',
          whenToUse: 'When asked what a client holds.',
          instructions: 'Search the client, open Holdings, report the values.',
          serviceId: 'ag',
          credentialId: null,
        },
        expect.anything(),
      ),
    );
  });

  it('connects Claude with its callback filled in and shows the client ID and secret once', async () => {
    vi.mocked(api.post).mockResolvedValue({
      connection: {
        id: 'client-id-1',
        name: 'Claude — Shawn',
        tool: 'claude',
        serviceIds: null,
        passwords: 'ask',
        redirectUri: 'https://claude.ai/api/mcp/auth_callback',
        status: 'active',
        createdAt: '',
        expiresAt: '',
        lastUsed: null,
      },
      clientSecret: 'secret-1',
    });
    renderModule('/admin?module=password-manager&tab=agents');
    expect(
      await screen.findByText('https://www.navigatewealth.co/mcp/password-vault'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Connect agent' }));
    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Claude — Shawn' },
    });
    expect(screen.getByLabelText('Callback address')).toHaveProperty(
      'value',
      'https://claude.ai/api/mcp/auth_callback',
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Connect agent' }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/password-vault/connections',
        {
          name: 'Claude — Shawn',
          tool: 'claude',
          serviceIds: null,
          passwords: 'ask',
          redirectUri: 'https://claude.ai/api/mcp/auth_callback',
          expiresInDays: 90,
        },
        expect.anything(),
      ),
    );
    expect(await screen.findByDisplayValue('client-id-1')).toBeDefined();
    expect(screen.getByDisplayValue('secret-1')).toBeDefined();
  });

  it('lets a person approve a password request under Activity', async () => {
    approvals = [
      {
        id: 'a1',
        connectionId: 'c1',
        connectionName: 'Claude — Shawn',
        action: 'reveal',
        credentialId: 'l1',
        credentialName: 'Broker 1234',
        reason: 'October statement',
        state: 'pending',
        decidedBy: null,
        createdAt: '2026-11-24T10:00:00Z',
        expiresAt: '2026-11-24T10:15:00Z',
      },
    ];
    vi.mocked(api.post).mockResolvedValue({ ...approvals[0], state: 'approved' });
    renderModule();
    await screen.findByText('Broker 1234');
    pickTab('Activity');
    expect(
      await screen.findByText(/Claude — Shawn wants the password for Broker 1234/),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/password-vault/approvals/a1/approve',
        {},
        expect.anything(),
      ),
    );
  });
});
