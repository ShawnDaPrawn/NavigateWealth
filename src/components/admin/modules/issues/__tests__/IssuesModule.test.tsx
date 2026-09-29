/**
 * IssuesModule — render and interaction tests
 * ===========================================
 *
 * Covers the page an admin actually uses: the four view cards that switch the
 * list, search, the "needs attention" banner that only appears when something
 * needs escalating, and the review sheet's save.
 *
 * issues/api is mocked so no real HTTP calls are made.
 * renderWithQueryClient wraps the required QueryClientProvider (the component
 * calls useQueryClient to invalidate pending-counts queries).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within, renderWithQueryClient } from '@/test/utils';
import { summarizeQualityIssues } from '@/shared/quality/qualityIssues';
import type { QualityIssue, QualityIssueSnapshot } from '../types';

vi.mock('@/components/admin/modules/issues/api', () => ({
  fetchQualityIssuesSnapshot: vi.fn(),
  runQualityIssueAutomation: vi.fn(),
  updateQualityIssueWorkflow: vi.fn(),
  createQualityIssueRemediationTask: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  fetchQualityIssuesSnapshot,
  runQualityIssueAutomation,
  updateQualityIssueWorkflow,
} from '@/components/admin/modules/issues/api';
import { IssuesModule } from '../IssuesModule';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let sequence = 0;
function makeIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  sequence += 1;
  return {
    id: `issue-${sequence}`,
    fingerprint: `fp-${sequence}`,
    source: 'runtime-client',
    category: 'runtime',
    priority: 'medium',
    severity: 'error',
    status: 'open',
    title: `Issue ${sequence}`,
    // A stored summary keeps the stored title; without one, runtime issues
    // are relabelled from their message by shared/quality/issueLabels.
    summary: 'Something failed.',
    message: 'Something failed',
    firstSeenAt: hoursAgo(1),
    lastSeenAt: hoursAgo(1),
    occurrences: 1,
    ...overrides,
  };
}

function makeSnapshot(issues: QualityIssue[]): QualityIssueSnapshot {
  return {
    generatedAt: hoursAgo(1),
    branch: '368/merge',
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

const calendarCrash = makeIssue({
  title: 'Calendar crashed',
  summary: 'The calendar crashed while loading events.',
  area: 'Admin · Calendar',
});
const policiesError = makeIssue({
  title: 'Policies request failed',
  source: 'runtime-server',
  priority: 'high',
  ownerName: 'Shawn',
  status: 'acknowledged',
});
const fixedBug = makeIssue({
  title: 'Old date bug',
  status: 'resolved',
  resolutionEvidence: 'PR #340',
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchQualityIssuesSnapshot).mockResolvedValue(
    makeSnapshot([calendarCrash, policiesError, fixedBug]),
  );
});

async function renderLoaded() {
  renderWithQueryClient(<IssuesModule />);
  await screen.findByRole('heading', { name: /Unresolved issues/ });
}

describe('IssuesModule', () => {
  it('shows the heading, where the report came from, and the unresolved list first', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { name: 'Issue Manager' })).toBeTruthy();
    expect(screen.getByText('PR #368')).toBeTruthy();
    expect(screen.getByText('Calendar crashed')).toBeTruthy();
    expect(screen.getByText('Policies request failed')).toBeTruthy();
    expect(screen.queryByText('Old date bug')).toBeNull();
  });

  it('shows a count on each view card that matches the list it opens', async () => {
    await renderLoaded();

    const cards = screen.getByRole('group', { name: 'Filter issues by view' });
    const unresolved = within(cards).getByRole('button', { name: /^Unresolved/ });
    const unassigned = within(cards).getByRole('button', { name: /^Unassigned/ });
    const resolved = within(cards).getByRole('button', { name: /^Resolved/ });

    expect(unresolved.getAttribute('aria-pressed')).toBe('true');
    expect(within(unresolved).getByText('2')).toBeTruthy();
    expect(within(unassigned).getByText('1')).toBeTruthy();
    expect(within(resolved).getByText('1')).toBeTruthy();

    fireEvent.click(resolved);

    expect(resolved.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: /Resolved issues/ })).toBeTruthy();
    expect(screen.getByText('Old date bug')).toBeTruthy();
    expect(screen.queryByText('Calendar crashed')).toBeNull();
  });

  it('filters the list by search and offers to clear it when nothing matches', async () => {
    await renderLoaded();

    const search = screen.getByRole('textbox', { name: 'Search issues' });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: 'calendar' } });

    expect(screen.getByText('Calendar crashed')).toBeTruthy();
    expect(screen.queryByText('Policies request failed')).toBeNull();

    fireEvent.change(search, { target: { value: 'nothing like this' } });
    expect(screen.getByText('No issues match your filters')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getByText('Calendar crashed')).toBeTruthy();
    expect(screen.getByText('Policies request failed')).toBeTruthy();
  });

  it('shows no attention banner when nothing needs escalating', async () => {
    await renderLoaded();

    expect(screen.queryByText(/need(s)? attention/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Create .* task/ })).toBeNull();
  });

  it('names what needs escalating and creates the missing tasks on request', async () => {
    const critical = makeIssue({ title: 'Payments down', priority: 'critical' });
    const snapshot = makeSnapshot([critical, calendarCrash]);
    vi.mocked(fetchQualityIssuesSnapshot).mockResolvedValue(snapshot);
    vi.mocked(runQualityIssueAutomation).mockResolvedValue({
      automation: {
        runAt: new Date().toISOString(),
        runBy: 'admin',
        activeAlerts: 1,
        criticalAlerts: 1,
        tasksCreated: 1,
        tasksLinked: 1,
        alerts: [],
      },
      snapshot: makeSnapshot([{ ...critical, linkedTaskId: 'task-1' }, calendarCrash]),
    });

    await renderLoaded();

    expect(screen.getByText('1 issue needs attention')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 task' }));

    await waitFor(() => expect(runQualityIssueAutomation).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Each one already has a remediation task/)).toBeTruthy();
  });

  it('opens an issue and saves the owner from the review sheet', async () => {
    vi.mocked(updateQualityIssueWorkflow).mockResolvedValue({
      fingerprint: calendarCrash.fingerprint,
      status: 'open',
      ownerName: 'Thandi',
    });

    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar crashed' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('The calendar crashed while loading events.')).toBeTruthy();

    const save = within(sheet).getByRole('button', { name: 'Save changes' });
    expect(save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(within(sheet).getByLabelText('Owner'), { target: { value: ' Thandi ' } });
    expect(save.hasAttribute('disabled')).toBe(false);
    fireEvent.click(save);

    await waitFor(() =>
      expect(updateQualityIssueWorkflow).toHaveBeenCalledWith({
        fingerprint: calendarCrash.fingerprint,
        status: 'open',
        ownerName: 'Thandi',
        statusNote: null,
        resolutionEvidence: null,
      }),
    );
  });

  it('asks for evidence only once an issue is being resolved', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar crashed' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByLabelText(/How do you know it's fixed/)).toBeNull();

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Resolved' }));
    expect(within(sheet).getByLabelText(/How do you know it's fixed/)).toBeTruthy();
  });

  it('keeps drafted evidence visible after switching away from Resolved', async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar crashed' }));
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Resolved' }));
    fireEvent.change(within(sheet).getByLabelText(/How do you know it's fixed/), {
      target: { value: 'PR #380' },
    });

    // The draft is still saved with the issue, so it must not vanish from view.
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Open' }));
    const evidence = within(sheet).getByLabelText(/How do you know it's fixed/);
    expect((evidence as HTMLTextAreaElement).value).toBe('PR #380');
  });

  it('explains a failed load and offers a retry', async () => {
    vi.mocked(fetchQualityIssuesSnapshot).mockRejectedValueOnce(new Error('Gateway timeout'));

    renderWithQueryClient(<IssuesModule />);

    expect(await screen.findByText('Gateway timeout')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: /Unresolved issues/ })).toBeTruthy();
  });
});
