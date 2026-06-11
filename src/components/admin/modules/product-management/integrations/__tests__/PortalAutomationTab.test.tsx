/**
 * PortalAutomationTab — Render / Characterization Test
 * ====================================================
 *
 * Locks the mount contract, title, scope-badge, loading state, job-status
 * badge, the OTP waiting screen, and the Current Job / Latest Run /
 * Previous Runs split for PortalAutomationTab. The component is pure-prop
 * (all state is injected), so this needs zero network mocking: every
 * scenario is driven by the props passed in.
 *
 * Run: npx vitest run src/.../PortalAutomationTab.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { PortalAutomationTab } from '@/components/admin/modules/product-management/integrations/PortalAutomationTab';
import type {
  IntegrationProvider,
  PortalJobHistoryEntry,
  PortalProviderFlow,
  PortalSyncJob,
} from '@/components/admin/modules/product-management/types';

const provider: IntegrationProvider = {
  id: 'p1',
  name: 'Old Mutual',
  categoryIds: ['risk_planning'],
};

function makeProps(
  over: Partial<Parameters<typeof PortalAutomationTab>[0]> = {},
): Parameters<typeof PortalAutomationTab>[0] {
  return {
    provider,
    selectedCategoryId: 'risk_planning',
    flow: undefined,
    job: undefined,
    stagedRun: null,
    jobItems: [],
    jobHistory: [],
    discoveryReport: null,
    isLoadingFlow: false,
    isLoadingDiscoveryReport: false,
    isLoadingJobItems: false,
    isLoadingJobHistory: false,
    isCreatingJob: false,
    credentialStatus: undefined,
    mappingBindings: [],
    selectedCredentialProfileId: '',
    isSubmittingOtp: false,
    isRefreshingJob: false,
    onCreateJob: vi.fn(),
    onSubmitOtp: vi.fn(),
    onRefreshJob: vi.fn(),
    onRetryItem: vi.fn(),
    onApplyFlow: vi.fn(),
    onOpenUploadTab: vi.fn(),
    onOpenSetupTab: vi.fn(),
    isApplyingFlow: false,
    fieldSelectors: [],
    updateFieldSelector: vi.fn(),
    buildProviderFallbackFields: vi.fn(() => []),
    ...over,
  };
}

/** Minimal stub that satisfies PortalProviderFlow's required fields. */
const minimalFlow = {
  id: 'flow-1',
  providerId: 'p1',
  name: 'Test Flow',
  loginUrl: 'https://provider.example/login',
  credentialProfiles: [],
  login: { usernameSelector: '', passwordSelector: '', submitSelector: '' },
  otp: {
    mode: 'manual_sms' as const,
    detectionSelectors: [],
    inputSelector: '',
    submitSelector: '',
    timeoutMs: 30000,
    instructions: '',
  },
  navigation: {},
  extraction: { policyRowSelector: '', fields: [] },
  notes: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as PortalProviderFlow;

function makeJob(status: PortalSyncJob['status']): PortalSyncJob {
  return {
    id: 'job-1',
    providerId: 'p1',
    providerName: 'Old Mutual',
    categoryId: 'risk_planning',
    status,
    flowId: 'flow-1',
    credentialProfileId: 'cred-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as PortalSyncJob;
}

function makeHistoryEntry(over: Partial<PortalJobHistoryEntry> = {}): PortalJobHistoryEntry {
  return {
    id: 'job-old-1',
    status: 'staged',
    runMode: 'run',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T01:00:00.000Z',
    ...over,
  };
}

describe('PortalAutomationTab', () => {
  it('renders the "Portal Automation" title and provider/category scope badge', () => {
    render(<PortalAutomationTab {...makeProps()} />);
    expect(screen.getByText('Portal Automation')).toBeTruthy();
    expect(screen.getAllByText('Old Mutual / Risk Planning').length).toBeGreaterThan(0);
  });

  it('shows a no-flow fallback message when no flow is configured and not loading', () => {
    render(<PortalAutomationTab {...makeProps()} />);
    expect(screen.getByText(/No portal flow is available for this provider yet/i)).toBeTruthy();
  });

  it('shows the loading spinner when isLoadingFlow is true', () => {
    render(<PortalAutomationTab {...makeProps({ isLoadingFlow: true })} />);
    expect(screen.getByText('Loading portal flow...')).toBeTruthy();
  });

  it('shows the running status badge in the header when a job exists with status running', () => {
    render(<PortalAutomationTab {...makeProps({ job: makeJob('running') })} />);
    expect(screen.getByText('running')).toBeTruthy();
  });

  it('shows the "waiting for otp" badge and OTP entry section when job awaits OTP', () => {
    render(
      <PortalAutomationTab
        {...makeProps({ flow: minimalFlow, job: makeJob('waiting_for_otp') })}
      />,
    );
    expect(screen.getByText('waiting for otp')).toBeTruthy();
    expect(screen.getByText(/Enter the SMS OTP from your phone/i)).toBeTruthy();
  });

  it('shows the Current Job card with an In Progress badge while a job is active', () => {
    render(<PortalAutomationTab {...makeProps({ job: makeJob('queued') })} />);
    expect(screen.getByText('Current Job')).toBeTruthy();
    expect(screen.getByText('In Progress')).toBeTruthy();
  });

  it('shows a terminal job as "Latest Run" with its outcome instead of "Current Job"', () => {
    render(<PortalAutomationTab {...makeProps({ job: makeJob('failed') })} />);
    expect(screen.getByText('Latest Run')).toBeTruthy();
    expect(screen.queryByText('Current Job')).toBeNull();
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
  });

  it('labels a staged job outcome as Completed on the Latest Run card', () => {
    render(<PortalAutomationTab {...makeProps({ job: makeJob('staged') })} />);
    expect(screen.getByText('Latest Run')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('renders previous runs in the Previous Runs card', () => {
    render(
      <PortalAutomationTab
        {...makeProps({
          jobHistory: [
            makeHistoryEntry({ id: 'job-old-1', status: 'staged' }),
            makeHistoryEntry({ id: 'job-old-2', status: 'failed', runMode: 'dry-run' }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Previous Runs')).toBeTruthy();
    expect(screen.getByText('staged')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText('Dry run')).toBeTruthy();
  });

  it('excludes the job already shown above from the Previous Runs list', () => {
    render(
      <PortalAutomationTab
        {...makeProps({
          job: makeJob('failed'),
          jobHistory: [makeHistoryEntry({ id: 'job-1', status: 'failed' })],
        })}
      />,
    );
    expect(screen.getByText(/No previous runs yet/i)).toBeTruthy();
  });

  it('shows the empty state when there is no run history', () => {
    render(<PortalAutomationTab {...makeProps()} />);
    expect(screen.getByText(/No previous runs yet/i)).toBeTruthy();
  });
});
