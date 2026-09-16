/**
 * ProviderSetupTab — Setup Completeness Has One Source Of Truth
 * =============================================================
 *
 * Setup completeness used to be computed TWICE from different inputs: this tab
 * counted the unsaved draft, while PortalConfigCard counted the saved flow. The
 * same four steps could therefore report "4 of 4 steps complete" here while
 * Portal Automation refused to start a run and said the setup was unfinished.
 *
 * A run uses the SAVED flow, so the saved flow is the only honest basis for
 * "ready to run". Draft edits are reported separately, as unsaved changes. This
 * suite pins both halves of that: the count follows saved state, and a draft
 * edit surfaces as its own signal instead of being counted as progress.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { ProviderSetupTab } from '@/components/admin/modules/product-management/integrations/ProviderSetupTab';
import type {
  IntegrationProvider,
  PortalProviderFlow,
} from '@/components/admin/modules/product-management/types';

const provider: IntegrationProvider = {
  id: 'p1',
  name: 'Acme Life',
  categoryIds: ['risk_planning'],
};

/** A flow with every step satisfied, as a saved run would see it. */
function completeFlow(over: Partial<PortalProviderFlow> = {}): PortalProviderFlow {
  return {
    id: 'flow-1',
    providerId: provider.id,
    name: 'Acme Life portal',
    loginUrl: 'https://portal.acme.co.za/login',
    credentialProfiles: [{ id: 'acme-env', label: 'Acme' }],
    login: { usernameSelector: '#u', passwordSelector: '#p', submitSelector: '#go' },
    otp: {
      mode: 'manual_sms',
      detectionSelectors: [],
      inputSelector: '#otp',
      submitSelector: '#otpgo',
      timeoutMs: 600000,
      instructions: '',
    },
    navigation: {},
    search: {
      mode: 'policy_number',
      searchInputLabels: ['Policy number'],
      searchInputSelector: '#q',
    },
    extraction: { fields: [] },
    notes: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  } as PortalProviderFlow;
}

function makeProps(over: Record<string, unknown> = {}) {
  return {
    provider,
    selectedCategoryId: 'risk_planning',
    flow: completeFlow(),
    isLoadingFlow: false,
    credentialStatus: { hasUsername: true, hasPassword: true },
    mappingBindings: [{ columnName: 'Current Value', keyId: 'current_value' }],
    selectedCredentialProfileId: 'acme-env',
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
    buildProviderFallbackFields: () => [],
    ...over,
  } as unknown as Parameters<typeof ProviderSetupTab>[0];
}

describe('ProviderSetupTab — setup completeness', () => {
  it('counts the saved flow, so a saved-complete provider reads as complete', () => {
    render(<ProviderSetupTab {...makeProps()} />);
    expect(screen.getByText('4 of 4 steps complete')).toBeDefined();
  });

  it('does not count a step the saved flow has not got', () => {
    render(<ProviderSetupTab {...makeProps({ flow: completeFlow({ loginUrl: '' }) })} />);
    expect(screen.getByText('3 of 4 steps complete')).toBeDefined();
  });

  it('does not credit unsaved credentials', () => {
    render(
      <ProviderSetupTab
        {...makeProps({ credentialStatus: { hasUsername: false, hasPassword: false } })}
      />,
    );
    expect(screen.getByText('3 of 4 steps complete')).toBeDefined();
  });

  it('shows no unsaved-changes signal when the draft matches the saved flow', () => {
    render(<ProviderSetupTab {...makeProps()} />);
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('reports a draft edit as unsaved rather than counting it as progress', () => {
    // Start from a flow whose login URL is missing, so the step is incomplete.
    render(<ProviderSetupTab {...makeProps({ flow: completeFlow({ loginUrl: '' }) })} />);

    expect(screen.getByText('3 of 4 steps complete')).toBeDefined();

    const loginInput = screen.getByPlaceholderText(/https:\/\//i);
    fireEvent.change(loginInput, { target: { value: 'https://portal.acme.co.za/login' } });

    // The count must NOT move on an unsaved edit — that is the old bug, where
    // this tab claimed completeness a run could not honour.
    expect(screen.getByText('3 of 4 steps complete')).toBeDefined();
    expect(screen.getByText('Unsaved changes')).toBeDefined();
  });
});
