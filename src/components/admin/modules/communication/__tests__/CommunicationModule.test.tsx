import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { act } from 'react';
import type { ActivityLogEntry, EmailTemplate } from '../types';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));

const logs: ActivityLogEntry[] = [
  {
    id: 'camp-1',
    timestamp: new Date('2026-11-09T08:00:00Z'),
    userId: 'u1',
    userName: 'Shawn Francisco',
    channel: 'email',
    recipientType: 'multiple',
    recipientCount: 3,
    subject: 'Your year-end planning checklist',
    messagePreview: 'Hi Elsa, as the tax year draws to a close…',
    messagePreviewFull: 'Hi Elsa, as the tax year draws to a close, here are three things.',
    attachmentCount: 0,
    status: 'completed',
    origin: 'campaign',
  },
];
const templates = [
  { id: 'general_campaign', name: 'General communication', subject: 'x', enabled: true },
  { id: 'welcome', name: 'Welcome email', subject: 'Welcome to Navigate Wealth', enabled: true },
] as unknown as EmailTemplate[];

const api = vi.hoisted(() => ({
  getHistoryPage: vi.fn(),
  getAllTemplates: vi.fn(),
  toggleTemplate: vi.fn(),
}));
vi.mock('../api', () => ({ communicationApi: api }));

vi.mock('../components/steps/Step1Recipients', () => ({
  Step1Recipients: (props: { onNext: () => void }) => (
    <div>
      <p>recipients step</p>
      <button onClick={props.onNext}>Continue to message</button>
    </div>
  ),
}));
vi.mock('../components/steps/Step2Compose', () => ({
  Step2Compose: (props: { onNext: () => void }) => (
    <div>
      <p>message step</p>
      <button onClick={props.onNext}>Continue to review</button>
    </div>
  ),
}));
vi.mock('../components/steps/Step3Review', () => ({
  Step3Review: (props: { onViewHistory?: () => void }) => (
    <div>
      <p>review step</p>
      <button onClick={props.onViewHistory}>View in History</button>
    </div>
  ),
}));
vi.mock('../components/EmailTemplateEditor', () => ({
  EmailTemplateEditor: (props: { templateId: string; onBack: () => void }) => (
    <div>
      <h1>editing {props.templateId}</h1>
      <button onClick={props.onBack}>Back to transactional emails</button>
    </div>
  ),
}));
vi.mock('../components/GlobalFooterEditor', () => ({
  GlobalFooterEditor: (props: { onBack: () => void }) => (
    <div>
      <h1>Global email footer</h1>
      <button onClick={props.onBack}>Back to transactional emails</button>
    </div>
  ),
}));

import { CommunicationModule } from '../CommunicationModule';

beforeEach(() => {
  toastError.mockReset();
  api.getHistoryPage.mockResolvedValue({ entries: logs, total: 1, senderOptions: [] });
  api.getAllTemplates.mockResolvedValue(templates);
});
afterEach(() => cleanup());

let goTo: (url: string) => void = () => undefined;
function Location() {
  const navigate = useNavigate();
  goTo = (url) => void navigate(url);
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin?module=communication') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <CommunicationModule />
      <Location />
    </MemoryRouter>,
  );
}

const search = () => screen.getByTestId('search').textContent;

describe('Communication module', () => {
  it('shows the page header, the three tabs and the wizard on Compose', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Communication' })).toBeDefined();
    expect(screen.queryByText('Communication Centre')).toBeNull();
    for (const name of ['Compose', 'History', 'Transactional emails']) {
      expect(screen.getByRole('tab', { name })).toBeDefined();
    }
    expect(screen.getByRole('tab', { name: 'Compose' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('recipients step')).toBeDefined();
  });

  it('keeps the tab in the address', async () => {
    renderAt();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }));
    await screen.findByText('Your year-end planning checklist');
    expect(search()).toBe('?module=communication&tab=history');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Compose' }));
    await screen.findByText('recipients step');
    expect(search()).toBe('?module=communication');
  });

  it('opens the tab named in the address', async () => {
    renderAt('/admin?module=communication&tab=transactional');
    expect(await screen.findByText('Welcome email')).toBeDefined();
    expect(
      screen.getByRole('tab', { name: 'Transactional emails' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('keeps the wizard step and draft when switching tabs', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to message' }));
    expect(screen.getByText('message step')).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'History' }));
    await screen.findByText('Your year-end planning checklist');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Compose' }));
    expect(await screen.findByText('message step')).toBeDefined();
  });

  it('goes to History from the sent screen and starts a new message', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    fireEvent.click(screen.getByRole('button', { name: 'View in History' }));
    await screen.findByText('Your year-end planning checklist');
    expect(search()).toBe('?module=communication&tab=history');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Compose' }));
    expect(await screen.findByText('recipients step')).toBeDefined();
  });
});

describe('Communication history', () => {
  it('opens a message as a page with its own address, not a side panel', async () => {
    renderAt('/admin?module=communication&tab=history');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open details: Your year-end planning checklist' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Your year-end planning checklist',
      }),
    ).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Communication' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
    expect(screen.getByText(/here are three things/)).toBeDefined();
    expect(search()).toBe('?module=communication&tab=history&message=camp-1');

    fireEvent.click(screen.getByRole('button', { name: 'Back to history' }));
    await screen.findByRole('heading', { level: 1, name: 'Communication' });
    expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
    expect(search()).toBe('?module=communication&tab=history');
  });

  it('opens the message named in the address, and Back returns to the list', async () => {
    renderAt('/admin?module=communication&tab=history&message=camp-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your year-end planning checklist' }),
    ).toBeDefined();

    act(() => goTo('/admin?module=communication&tab=history'));
    await screen.findByRole('heading', { level: 1, name: 'Communication' });
    expect(screen.getByText('Your year-end planning checklist')).toBeDefined();
  });

  it('says so when the message in the address is not in the list', async () => {
    renderAt('/admin?module=communication&tab=history&message=nope');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Message not found in the history list'),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Communication' })).toBeDefined();
    await waitFor(() => expect(search()).toBe('?module=communication&tab=history'));
  });
});

describe('Transactional emails', () => {
  it('opens a template editor as a page with its own address', async () => {
    renderAt('/admin?module=communication&tab=transactional');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Welcome email' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'editing welcome' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
    expect(search()).toBe('?module=communication&tab=transactional&edit=welcome');

    fireEvent.click(screen.getByRole('button', { name: 'Back to transactional emails' }));
    await screen.findByRole('heading', { level: 1, name: 'Communication' });
    await waitFor(() => expect(search()).toBe('?module=communication&tab=transactional'));
  });

  it('opens the global footer editor named in the address', async () => {
    renderAt('/admin?module=communication&tab=transactional&edit=footer');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Global email footer' }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Communication' })).toBeNull();
  });

  it('says so when the template in the address does not exist', async () => {
    renderAt('/admin?module=communication&tab=transactional&edit=missing');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Email template not found'));
    await waitFor(() => expect(search()).toBe('?module=communication&tab=transactional'));
  });
});
