/**
 * ProviderSetupTab — Render / Characterization Test
 * =================================================
 *
 * Locks the mount contract for the Provider Setup tab, which now owns the
 * portal flow setup form (login URL, credentials, policy search, values to
 * extract) that previously lived as a collapsible section inside
 * PortalConfigCard. Pure-prop component — no network mocking needed.
 *
 * Run: npx vitest run src/.../ProviderSetupTab.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { ProviderSetupTab } from '@/components/admin/modules/product-management/integrations/ProviderSetupTab';
import type {
  IntegrationProvider,
  PortalProviderFlow,
} from '@/components/admin/modules/product-management/types';

const provider: IntegrationProvider = {
  id: 'p1',
  name: 'Old Mutual',
  categoryIds: ['risk_planning'],
};

function makeProps(
  over: Partial<Parameters<typeof ProviderSetupTab>[0]> = {},
): Parameters<typeof ProviderSetupTab>[0] {
  return {
    provider,
    selectedCategoryId: 'risk_planning',
    flow: undefined,
    brainMemory: undefined,
    isLoadingFlow: false,
    credentialStatus: undefined,
    mappingBindings: [],
    selectedCredentialProfileId: '',
    onCredentialProfileChange: vi.fn(),
    isSavingCredentials: false,
    isSavingFlow: false,
    isResettingFlow: false,
    onSaveCredentials: vi.fn(),
    onSaveFlow: vi.fn(),
    onResetFlow: vi.fn(),
    onOpenMappingTab: vi.fn(),
    fieldSelectors: [],
    updateFieldSelector: vi.fn(),
    updateFieldRequired: vi.fn(),
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
  // extraction and notes are required (non-optional) fields — the component's
  // hydration useEffect accesses flow.extraction fields and renders
  // flow.notes.length directly, so omitting them throws at runtime.
  extraction: { policyRowSelector: '', fields: [] },
  notes: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as PortalProviderFlow;

describe('ProviderSetupTab', () => {
  it('renders the "Provider Setup" title and provider/category scope badge', () => {
    render(<ProviderSetupTab {...makeProps()} />);
    expect(screen.getByText('Provider Setup')).toBeTruthy();
    expect(screen.getByText('Old Mutual / Risk Planning')).toBeTruthy();
  });

  it('shows a no-flow fallback message when no flow is configured and not loading', () => {
    render(<ProviderSetupTab {...makeProps()} />);
    expect(screen.getByText(/No portal flow is available for this provider yet/i)).toBeTruthy();
  });

  it('shows the loading spinner when isLoadingFlow is true', () => {
    render(<ProviderSetupTab {...makeProps({ isLoadingFlow: true })} />);
    expect(screen.getByText('Loading portal flow...')).toBeTruthy();
  });

  it('shows the flow isolation alert when a flow is configured', () => {
    render(<ProviderSetupTab {...makeProps({ flow: minimalFlow })} />);
    expect(screen.getByText(/Provider login is shared/i)).toBeTruthy();
  });

  it('shows the setup steps progress badge when a flow is configured', () => {
    render(<ProviderSetupTab {...makeProps({ flow: minimalFlow })} />);
    expect(screen.getByText(/of 4 steps complete/i)).toBeTruthy();
  });

  it('shows the "Mapping needed first" alert when no mapping bindings exist', () => {
    render(<ProviderSetupTab {...makeProps({ flow: minimalFlow })} />);
    expect(screen.getByText('Mapping needed first')).toBeTruthy();
  });

  it('renders the Save Setup and Reset This Product Flow actions', () => {
    render(<ProviderSetupTab {...makeProps({ flow: minimalFlow })} />);
    expect(screen.getAllByText('Save Setup').length).toBeGreaterThan(0);
    expect(screen.getByText('Reset This Product Flow')).toBeTruthy();
  });
});
