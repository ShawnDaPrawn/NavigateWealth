/**
 * PortalAutomationTab — Render / Characterization Test (Phase 4)
 * ==============================================================
 *
 * Locks the mount contract, title, scope-badge, loading state, job-status
 * badge, and the OTP waiting screen for PortalAutomationTab — a 1,709-line
 * Phase 6 decomposition target. The component is pure-prop (all state is
 * injected), so this needs zero network mocking: every scenario is driven by
 * the props passed in.
 *
 * Run: npx vitest run src/.../PortalAutomationTab.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import {
  PortalAutomationTab,
} from '@/components/admin/modules/product-management/integrations/PortalAutomationTab';
import type {
  IntegrationProvider,
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
    discoveryReport: null,
    brainMemory: undefined,
    isLoadingFlow: false,
    isLoadingDiscoveryReport: false,
    isLoadingJobItems: false,
    isCreatingJob: false,
    credentialStatus: undefined,
    mappingBindings: [],
    selectedCredentialProfileId: '',
    onCredentialProfileChange: vi.fn(),
    isSavingCredentials: false,
    isSavingFlow: false,
    isResettingFlow: false,
    isSubmittingOtp: false,
    isRefreshingJob: false,
    onCreateJob: vi.fn(),
    onSaveCredentials: vi.fn(),
    onSaveFlow: vi.fn(),
    onResetFlow: vi.fn(),
    onSubmitOtp: vi.fn(),
    onRefreshJob: vi.fn(),
    onRetryItem: vi.fn(),
    onApplyFlow: vi.fn(),
    onOpenUploadTab: vi.fn(),
    onOpenMappingTab: vi.fn(),
    isApplyingFlow: false,
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
  // extraction and notes are required (non-optional) fields — the component's
  // hydration useEffect accesses flow.extraction.policyRowSelector and renders
  // flow.notes.length directly, so omitting them throws at runtime.
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

describe('PortalAutomationTab', () => {
  it('renders the "Portal Automation" title and provider/category scope badge', () => {
    render(<PortalAutomationTab {...makeProps()} />);
    expect(screen.getByText('Portal Automation')).toBeTruthy();
    expect(screen.getByText('Old Mutual / Risk Planning')).toBeTruthy();
  });

  it('shows a no-flow fallback message when no flow is configured and not loading', () => {
    render(<PortalAutomationTab {...makeProps()} />);
    expect(screen.getByText(/No portal flow is available for this provider yet/i)).toBeTruthy();
  });

  it('shows the loading spinner when isLoadingFlow is true', () => {
    render(<PortalAutomationTab {...makeProps({ isLoadingFlow: true })} />);
    expect(screen.getByText('Loading portal flow...')).toBeTruthy();
  });

  it('shows the flow isolation alert when a flow is configured', () => {
    render(<PortalAutomationTab {...makeProps({ flow: minimalFlow })} />);
    expect(screen.getByText(/Provider login is shared/i)).toBeTruthy();
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

  it('shows the Current Job card when a job exists', () => {
    render(<PortalAutomationTab {...makeProps({ job: makeJob('queued') })} />);
    expect(screen.getByText('Current Job')).toBeTruthy();
  });
});
