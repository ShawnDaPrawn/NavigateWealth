/**
 * EsignModule — render / characterisation test (Phase 4 coverage push).
 *
 * EsignModule is the 402-stmt root of the e-signature admin module: it owns
 * the wizard state-machine (dashboard → upload → recipients → prepare) and
 * all the lazy-loaded dialog-level components. Only the dashboard view is
 * exercised here (lazy children never mount unless the user navigates into
 * them). Hooks + heavy children are mocked so this stays fast and deterministic.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';

// ── mocks (hoisted so they precede the import) ────────────────────────────────

vi.mock('../hooks/useEnvelopeActions', () => ({
  useEnvelopeActions: () => ({
    uploading: false,
    uploadError: null,
    uploadDocument: vi.fn(async () => ({ id: 'env-1', document_url: 'https://x/doc.pdf' })),
    sending: false,
    sendError: null,
    sendInvites: vi.fn(async () => ({ success: true })),
    signing: false,
    signError: null,
    submitSignature: vi.fn(async () => ({ success: true })),
    rejecting: false,
    rejectError: null,
    rejectSigning: vi.fn(async () => ({ success: true })),
    savingTemplate: false,
    templateError: null,
    saveAsTemplate: vi.fn(async () => ({ success: true })),
    savingFields: false,
    saveFieldsError: null,
    saveFields: vi.fn(async () => ({ success: true })),
    deleting: false,
    deleteError: null,
    deleteEnvelope: vi.fn(async () => ({ success: true })),
    voiding: false,
    voidError: null,
    voidEnvelope: vi.fn(async () => ({ success: true })),
    downloading: false,
    downloadDocument: vi.fn(async () => null),
  }),
}));

vi.mock('../../personnel/hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({
    canDo: (_module: string, _capability: string) => true,
    can: () => true,
    isSuperAdmin: false,
    isLoading: false,
    permissions: undefined,
  }),
}));

vi.mock('../api', () => ({
  esignApi: {
    getEnvelopes: vi.fn(async () => ({ envelopes: [], total: 0 })),
    getTemplates: vi.fn(async () => ({ templates: [] })),
  },
}));

// Stub the heavy lazy children — they are never rendered in the dashboard view
// but React.lazy() resolves dynamically; mock the modules so dynamic imports
// resolve instantly with a lightweight stub.
vi.mock('../components/EsignDashboard', () => ({
  EsignDashboard: ({ onCreateNew }: { onCreateNew: () => void }) => (
    <div data-testid="esign-dashboard">
      <button onClick={onCreateNew}>Start New Envelope</button>
    </div>
  ),
}));
vi.mock('../components/DocumentUploadStep', () => ({
  DocumentUploadStep: () => <div data-testid="upload-step" />,
}));
vi.mock('../components/RecipientsManager', () => ({
  RecipientsManager: () => <div data-testid="recipients-step" />,
}));
vi.mock('../components/PrepareFormStudio', () => ({
  PrepareFormStudio: () => <div data-testid="prepare-step" />,
}));
vi.mock('../components/EnvelopeInspector', () => ({
  EnvelopeInspector: () => <div data-testid="inspector" />,
}));
vi.mock('../components/TemplatePickerDialog', () => ({
  // Render a "Start from scratch" button so tests can drive the wizard-upload transition.
  TemplatePickerDialog: ({ onStartBlank }: { onStartBlank?: () => void }) =>
    onStartBlank ? (
      <button data-testid="start-blank" onClick={onStartBlank}>
        Start from scratch
      </button>
    ) : null,
}));
vi.mock('../components/SaveAsTemplateDialog', () => ({
  SaveAsTemplateDialog: () => null,
}));
vi.mock('../components/BulkSendDialog', () => ({
  BulkSendDialog: () => null,
}));
vi.mock('../components/PacketsDialog', () => ({
  PacketsDialog: () => null,
}));
vi.mock('../components/NotificationPrefsDialog', () => ({
  NotificationPrefsDialog: () => null,
}));
vi.mock('../components/WebhooksDialog', () => ({
  WebhooksDialog: () => null,
}));
vi.mock('../components/RecoveryBinDialog', () => ({
  RecoveryBinDialog: () => null,
}));
vi.mock('../components/AuditLogDialog', () => ({
  AuditLogDialog: () => null,
}));
vi.mock('../components/RetentionPolicyDialog', () => ({
  RetentionPolicyDialog: () => null,
}));
vi.mock('../components/BrandingDialog', () => ({
  BrandingDialog: () => null,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
});

// Import the component file, not the barrel: the barrel exports EsignModule
// lazily so light consumers do not pull pdf.js, and these tests render it
// directly without a Suspense boundary.
import { EsignModule } from '../EsignModule';

describe('EsignModule', () => {
  it('renders the dashboard view on mount', () => {
    render(<EsignModule />);
    expect(screen.getByTestId('esign-dashboard')).toBeTruthy();
  });

  it('opens the template picker when Start New Envelope is clicked', async () => {
    render(<EsignModule />);
    fireEvent.click(screen.getByRole('button', { name: /start new envelope/i }));
    await waitFor(() => {
      expect(screen.getByTestId('start-blank')).toBeTruthy();
    });
  });

  it('transitions to the upload wizard after choosing Start from scratch', async () => {
    render(<EsignModule />);
    fireEvent.click(screen.getByRole('button', { name: /start new envelope/i }));
    await waitFor(() => screen.getByTestId('start-blank'));
    fireEvent.click(screen.getByTestId('start-blank'));
    await waitFor(() => {
      expect(screen.getByTestId('upload-step')).toBeTruthy();
    });
  });
});
