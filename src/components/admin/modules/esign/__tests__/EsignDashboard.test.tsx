import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { EsignEnvelope } from '../types';

const envelopes = [
  { id: 'e1', status: 'completed' },
  { id: 'e2', status: 'sent', expires_at: new Date(Date.now() + 86_400_000).toISOString() },
  { id: 'e3', status: 'draft' },
  { id: 'e4', status: 'expired' },
] as unknown as EsignEnvelope[];

vi.mock('../hooks/useEnvelopes', () => ({ useEnvelopes: () => ({ envelopes }) }));
vi.mock('../components/EnvelopesList', () => ({ EnvelopesList: () => <div>envelope list</div> }));
vi.mock('../components/TemplateLibrary', () => ({
  TemplateLibrary: () => <div>template library</div>,
}));
vi.mock('../components/NotificationBell', () => ({ NotificationBell: () => <span>bell</span> }));
vi.mock('../components/MetricsPanel', () => ({ MetricsPanel: () => <div>metrics panel</div> }));
const tool = (name: string) => (props: { inline?: boolean }) => (
  <div>
    {name} {props.inline ? 'inline' : 'dialog'}
  </div>
);
vi.mock('../components/NotificationPrefsDialog', () => ({
  NotificationPrefsDialog: tool('prefs'),
}));
vi.mock('../components/WebhooksDialog', () => ({ WebhooksDialog: tool('webhooks') }));
vi.mock('../components/PacketsDialog', () => ({ PacketsDialog: tool('packets') }));
vi.mock('../components/RecoveryBinDialog', () => ({ RecoveryBinDialog: tool('recovery') }));
vi.mock('../components/AuditLogDialog', () => ({ AuditLogDialog: tool('audit') }));
vi.mock('../components/RetentionPolicyDialog', () => ({
  RetentionPolicyDialog: tool('retention'),
}));
vi.mock('../components/BrandingDialog', () => ({ BrandingDialog: tool('branding') }));

import { EsignDashboard } from '../components/EsignDashboard';
import { computeEnvelopeMetrics } from '../components/dashboardModel';

afterEach(() => cleanup());

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const allTools = {
  notifications: true,
  webhooks: true,
  packets: true,
  recovery: true,
  audit: true,
  retention: true,
  branding: true,
};

function renderDashboard(url = '/admin?module=esign', access = allTools, onBulkSend?: () => void) {
  const props = {
    onCreateNew: vi.fn(),
    onViewEnvelope: vi.fn(),
    onRefresh: vi.fn(),
    onOpenEnvelopeById: vi.fn(),
    onBulkSend,
    manageAccess: access,
  };
  render(
    <MemoryRouter initialEntries={[url]}>
      <EsignDashboard {...props} />
      <Location />
    </MemoryRouter>,
  );
  return props;
}

describe('EsignDashboard', () => {
  it('shows the header, figures and envelopes by default', () => {
    const props = renderDashboard('/admin?module=esign', allTools, vi.fn());
    expect(screen.getByRole('heading', { level: 1, name: 'E-Signature' })).toBeDefined();
    expect(screen.getByText('Action required')).toBeDefined();
    expect(screen.getByText('33%')).toBeDefined();
    expect(screen.getByText('envelope list')).toBeDefined();
    expect(screen.getByText(/expiring within/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'New envelope' }));
    expect(props.onCreateNew).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk send from template' }));
    expect(props.onBulkSend).toHaveBeenCalled();
  });

  it('hides bulk send when the person cannot send', () => {
    renderDashboard();
    expect(screen.queryByRole('button', { name: 'Bulk send from template' })).toBeNull();
  });

  it('puts the tab in the address bar', () => {
    renderDashboard();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Templates' }));
    expect(screen.getByText('template library')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=esign&tab=templates');
  });

  it('renders Manage tools on the page and remembers the tool', async () => {
    renderDashboard('/admin?module=esign&tab=manage&tool=webhooks');
    await waitFor(() => screen.getByText('webhooks inline'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Audit log' }));
    await waitFor(() => screen.getByText('audit inline'));
    expect(screen.getByTestId('search').textContent).toBe('?module=esign&tab=manage&tool=audit');
  });

  it('shows only the Manage tools the person may use', () => {
    renderDashboard('/admin?tab=manage', {
      ...allTools,
      webhooks: false,
      packets: false,
      recovery: false,
      retention: false,
      branding: false,
    });
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(names).toContain('Notifications');
    expect(names).toContain('Audit log');
    expect(names).not.toContain('Webhooks');
    expect(names).not.toContain('Recovery bin');
  });

  it('hides the Manage tab when no tool is available', () => {
    renderDashboard('/admin', {
      notifications: false,
      webhooks: false,
      packets: false,
      recovery: false,
      audit: false,
      retention: false,
      branding: false,
    });
    expect(screen.queryByRole('tab', { name: 'Manage' })).toBeNull();
  });
});

describe('computeEnvelopeMetrics', () => {
  it('counts envelopes by state and the completion rate of sent ones', () => {
    const m = computeEnvelopeMetrics(envelopes, new Date());
    expect(m).toMatchObject({
      total: 4,
      completed: 1,
      draft: 1,
      pending: 1,
      expired: 1,
      expiringSoon: 1,
      completionRate: 33,
    });
  });

  it('reports 0% when nothing has been sent', () => {
    const drafts = [{ id: 'd', status: 'draft' }] as unknown as EsignEnvelope[];
    expect(computeEnvelopeMetrics(drafts, new Date()).completionRate).toBe(0);
    expect(computeEnvelopeMetrics([], new Date()).completionRate).toBe(0);
  });
});
