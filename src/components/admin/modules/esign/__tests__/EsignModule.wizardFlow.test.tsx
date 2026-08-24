/**
 * EsignModule — wizard-flow characterization net.
 *
 * Written BEFORE splitting index.tsx so the carve is pinned by behaviour, not
 * by assertion. Covers what the render/dialog extraction could silently break:
 * template selection hydrating the wizard, the recipients step's guards and
 * navigation, express-send validation, template-field hydration onto a fresh
 * draft, resume-draft signer reconstruction, sending from the studio, and the
 * dashboard-launched dialog mounts.
 *
 * Heavy children are stubbed; the stubs echo the props the module wires into
 * them so the tests assert the wiring, not the children.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { toast } from 'sonner';

import type { EsignTemplateRecord } from '../types';

// ── fixtures (hoisted so mock factories can reference them) ──────────────────

const fixtures = vi.hoisted(() => {
  const baseTemplate = {
    signingMode: 'sequential' as const,
    defaultExpiryDays: 14,
    defaultMessage: 'Please sign.',
    usageCount: 0,
    version: 3,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const doc = {
    documentId: 'tpl-doc-1',
    order: 1,
    displayName: 'Contract',
    originalFilename: 'contract.pdf',
    pageCount: 2,
    storagePath: 'templates/contract.pdf',
  };
  const field = (recipientIndex: number) => ({
    type: 'signature' as const,
    page: 1,
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    required: true,
    recipientIndex,
  });
  return {
    /** Saved documents + complete field layout + all emails → express-eligible. */
    TPL_READY: {
      ...baseTemplate,
      id: 'tpl-ready',
      name: 'Std Contract',
      recipients: [
        { name: 'Client', email: 'client@x.co', order: 1, otpRequired: false },
        { name: 'Adviser', email: 'adviser@x.co', order: 2, otpRequired: true },
      ],
      documents: [doc],
      fields: [field(1)],
    },
    /** Saved documents + fields, but a recipient without an email. */
    TPL_NO_EMAIL: {
      ...baseTemplate,
      id: 'tpl-no-email',
      name: 'Blank Client',
      recipients: [{ name: 'Client', email: '', order: 1, otpRequired: false }],
      documents: [doc],
      fields: [field(0)],
    },
    /** Saved documents but zero recipients → recipients step starts empty. */
    TPL_EMPTY: {
      ...baseTemplate,
      id: 'tpl-empty',
      name: 'No Recipients',
      recipients: [],
      documents: [doc],
      fields: [],
    },
    /** No saved documents → wizard must go to the upload step. */
    TPL_NO_DOCS: {
      ...baseTemplate,
      id: 'tpl-no-docs',
      name: 'Doc-less',
      recipients: [{ name: 'Client', email: 'client@x.co', order: 1, otpRequired: false }],
      documents: [],
      fields: [],
    },
  };
});

const spies = vi.hoisted(() => ({
  uploadDocument: vi.fn(),
  sendInvites: vi.fn(
    async (
      _envelopeId: string,
      _payload: {
        signers: Array<{ email: string }>;
        fields: Array<Record<string, unknown>>;
        message: string;
        expiryDays: number;
      },
    ) => ({ success: true }),
  ),
  saveFields: vi.fn(async (_envelopeId: string, _fields: Array<Record<string, unknown>>) => ({
    success: true,
  })),
  voidEnvelope: vi.fn(async () => ({ success: true })),
  deleteEnvelope: vi.fn(async () => ({ success: true })),
  downloadDocument: vi.fn(),
  saveDraftSigners: vi.fn(async () => ({ success: true })),
  materialiseTemplateDraft: vi.fn(),
  getEnvelope: vi.fn(),
  getDocumentUrl: vi.fn(),
}));

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../hooks/useEnvelopeActions', () => ({
  useEnvelopeActions: () => ({
    uploadDocument: spies.uploadDocument,
    sendInvites: spies.sendInvites,
    saveFields: spies.saveFields,
    voidEnvelope: spies.voidEnvelope,
    deleteEnvelope: spies.deleteEnvelope,
    downloadDocument: spies.downloadDocument,
    uploading: false,
    sending: false,
    savingFields: false,
  }),
}));

vi.mock('../../personnel/hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({
    canDo: () => true,
    can: () => true,
    isSuperAdmin: false,
    isLoading: false,
    permissions: undefined,
  }),
}));

vi.mock('../api', () => ({
  esignApi: {
    saveDraftSigners: spies.saveDraftSigners,
    materialiseTemplateDraft: spies.materialiseTemplateDraft,
    getEnvelope: spies.getEnvelope,
    getDocumentUrl: spies.getDocumentUrl,
    getEnvelopes: vi.fn(async () => ({ envelopes: [], total: 0 })),
    getTemplates: vi.fn(async () => ({ templates: [] })),
  },
}));

vi.mock('../components/EsignDashboard', () => ({
  EsignDashboard: (props: {
    onUseTemplate: (t: unknown) => void;
    onResumePrepare: (e: { id: string }) => void;
    onBulkSend?: () => void;
    onAuditLog?: () => void;
    onRecoveryBin?: () => void;
  }) => (
    <div data-testid="esign-dashboard">
      <button data-testid="use-tpl-ready" onClick={() => props.onUseTemplate(fixtures.TPL_READY)}>
        use ready
      </button>
      <button
        data-testid="use-tpl-no-email"
        onClick={() => props.onUseTemplate(fixtures.TPL_NO_EMAIL)}
      >
        use no-email
      </button>
      <button data-testid="use-tpl-empty" onClick={() => props.onUseTemplate(fixtures.TPL_EMPTY)}>
        use empty
      </button>
      <button
        data-testid="use-tpl-no-docs"
        onClick={() => props.onUseTemplate(fixtures.TPL_NO_DOCS)}
      >
        use doc-less
      </button>
      <button data-testid="resume-draft" onClick={() => props.onResumePrepare({ id: 'env-9' })}>
        resume
      </button>
      <button data-testid="open-bulk-send" onClick={props.onBulkSend}>
        bulk
      </button>
      <button data-testid="open-audit-log" onClick={props.onAuditLog}>
        audit
      </button>
      <button data-testid="open-recovery-bin" onClick={props.onRecoveryBin}>
        bin
      </button>
    </div>
  ),
}));

vi.mock('../components/DocumentUploadStep', () => ({
  DocumentUploadStep: () => <div data-testid="upload-step" />,
}));

vi.mock('../components/RecipientsManager', () => {
  const RecipientsManager = ({ signers }: { signers: unknown[] }) => (
    <div data-testid="recipients-manager">{JSON.stringify(signers)}</div>
  );
  return { RecipientsManager, default: RecipientsManager };
});

vi.mock('../components/PrepareFormStudio', () => ({
  PrepareFormStudio: (props: {
    signers: unknown[];
    documentUrl?: string;
    autoPopulateSuggestedFields?: boolean;
    onSendForSignature: (fields: unknown[]) => void;
  }) => (
    <div
      data-testid="prepare-step"
      data-url={props.documentUrl ?? ''}
      data-autopopulate={String(props.autoPopulateSuggestedFields)}
    >
      <span data-testid="prepare-signers">{JSON.stringify(props.signers)}</span>
      <button
        data-testid="studio-send"
        onClick={() =>
          props.onSendForSignature([
            {
              id: 'f-1',
              envelope_id: 'env-9',
              signer_id: 'dana@x.co',
              type: 'signature',
              page: 1,
              x: 1,
              y: 2,
              width: 3,
              height: 4,
              required: true,
              metadata: {},
              created_at: 'now',
              updated_at: 'now',
            },
          ])
        }
      >
        send from studio
      </button>
    </div>
  ),
}));

vi.mock('../components/EnvelopeInspector', () => ({
  EnvelopeInspector: () => <div data-testid="inspector" />,
}));
vi.mock('../components/TemplatePickerDialog', () => ({
  TemplatePickerDialog: () => <div data-testid="template-picker" />,
}));
vi.mock('../components/BulkSendDialog', () => ({
  BulkSendDialog: () => <div data-testid="bulk-send-dialog" />,
}));
vi.mock('../components/PacketsDialog', () => ({ PacketsDialog: () => null }));
vi.mock('../components/NotificationPrefsDialog', () => ({ NotificationPrefsDialog: () => null }));
vi.mock('../components/WebhooksDialog', () => ({ WebhooksDialog: () => null }));
vi.mock('../components/RecoveryBinDialog', () => ({
  RecoveryBinDialog: () => <div data-testid="recovery-bin-dialog" />,
}));
vi.mock('../components/AuditLogDialog', () => ({
  AuditLogDialog: () => <div data-testid="audit-log-dialog" />,
}));
vi.mock('../components/RetentionPolicyDialog', () => ({ RetentionPolicyDialog: () => null }));
vi.mock('../components/BrandingDialog', () => ({ BrandingDialog: () => null }));

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

import { EsignModule } from '../index';

// ── helpers ──────────────────────────────────────────────────────────────────

const DRAFT_ENVELOPE = {
  id: 'env-42',
  client_id: '',
  title: 'Std Contract',
  status: 'draft',
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  document: {
    id: 'doc-live-1',
    filename: 'contract.pdf',
    storage_path: 'x',
    mime_type: 'application/pdf',
    size_bytes: 1,
    page_count: 2,
    upload_status: 'ready',
    created_at: '2026-08-01T00:00:00.000Z',
    url: 'https://x/materialised.pdf',
  },
};

async function openTemplate(testId: string) {
  render(<EsignModule />);
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => screen.getByText('Add Recipients'));
  // RecipientsManager is React.lazy — the heading paints before the child.
  await waitFor(() => screen.getByTestId('recipients-manager'));
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.materialiseTemplateDraft.mockResolvedValue({
    envelope: DRAFT_ENVELOPE,
    documentMap: { 'tpl-doc-1': 'doc-live-1' },
  });
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('EsignModule wizard flow', () => {
  it('template with saved documents jumps straight to recipients, signers hydrated from the template', async () => {
    await openTemplate('use-tpl-ready');

    const signers = JSON.parse(screen.getByTestId('recipients-manager').textContent || '[]');
    expect(signers).toHaveLength(2);
    expect(signers[0]).toMatchObject({
      name: 'Client',
      email: 'client@x.co',
      role: 'Signer',
      order: 1,
      otpRequired: false,
      isSystemClient: false,
    });
    expect(signers[1]).toMatchObject({
      name: 'Adviser',
      email: 'adviser@x.co',
      order: 2,
      otpRequired: true,
    });
  });

  it('template without saved documents goes to the upload step instead', async () => {
    render(<EsignModule />);
    fireEvent.click(screen.getByTestId('use-tpl-no-docs'));
    await waitFor(() => screen.getByTestId('upload-step'));
    expect(screen.queryByText('Add Recipients')).toBeNull();
  });

  it('shows the express banner and button for a template with a complete field layout', async () => {
    await openTemplate('use-tpl-ready');
    expect(screen.getByText('Express send from "Std Contract"')).toBeTruthy();
    expect(screen.getByRole('button', { name: /send now \(express\)/i })).toBeTruthy();
    // The auto-populate switch defaults to on.
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('Next with zero recipients shows an error toast and stays put', async () => {
    await openTemplate('use-tpl-empty');
    fireEvent.click(screen.getByRole('button', { name: /next: prepare fields/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please add at least one recipient.');
    });
    expect(screen.getByText('Add Recipients')).toBeTruthy();
    expect(spies.materialiseTemplateDraft).not.toHaveBeenCalled();
  });

  it('express send refuses when a recipient has no email', async () => {
    await openTemplate('use-tpl-no-email');
    fireEvent.click(screen.getByRole('button', { name: /send now \(express\)/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Each recipient needs an email before express send.',
      );
    });
    expect(spies.materialiseTemplateDraft).not.toHaveBeenCalled();
  });

  it('express send materialises the template draft, persists draft signers, and hydrates the field layout', async () => {
    await openTemplate('use-tpl-ready');
    fireEvent.click(screen.getByRole('button', { name: /send now \(express\)/i }));

    await waitFor(() => {
      expect(spies.saveFields).toHaveBeenCalledTimes(1);
    });

    expect(spies.materialiseTemplateDraft).toHaveBeenCalledWith({
      templateId: 'tpl-ready',
      title: 'Std Contract',
      message: 'Please sign.',
      expiryDays: 14,
      clientId: undefined,
      campaignId: undefined,
      packetRunId: undefined,
      packetStepIndex: undefined,
    });

    // Draft signers persisted with the wizard's normalised payload.
    expect(spies.saveDraftSigners).toHaveBeenCalledWith('env-42', [
      expect.objectContaining({ name: 'Client', email: 'client@x.co', role: 'Signer', order: 1 }),
      expect.objectContaining({ name: 'Adviser', email: 'adviser@x.co', order: 2 }),
    ]);

    // Template field (recipientIndex 1) lands on the live document, addressed
    // to that recipient's email, with geometry carried over verbatim.
    const [envelopeId, fields] = spies.saveFields.mock.calls[0];
    expect(envelopeId).toBe('env-42');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      envelope_id: 'env-42',
      document_id: 'doc-live-1',
      signer_id: 'adviser@x.co',
      type: 'signature',
      page: 1,
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      required: true,
    });

    // CHARACTERIZATION OF A LATENT BUG, pinned deliberately: handleSend is
    // invoked from the same render's closure, where `activeEnvelope` is still
    // null, so a first-time express send stops after materialising the draft —
    // no invite is dispatched and no success toast fires. Flagged to the
    // maintainer; a fix belongs in its own change, not in the file split.
    expect(spies.sendInvites).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith('Document sent for signature!');
  });

  it('Back from recipients with no files and no builder resets to the dashboard', async () => {
    await openTemplate('use-tpl-ready');
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    await waitFor(() => screen.getByTestId('esign-dashboard'));
    expect(screen.queryByText('Add Recipients')).toBeNull();
  });

  it('resume rebuilds signers from draft_signers and opens the studio on a fresh document URL', async () => {
    spies.getEnvelope.mockResolvedValue({
      ...DRAFT_ENVELOPE,
      id: 'env-9',
      title: 'Resumed Draft',
      signers: [],
      draft_signers: [
        { name: 'Rea', email: 'rea@x.co' },
        {
          name: 'Dana',
          email: 'dana@x.co',
          role: 'Witness',
          order: 2,
          otpRequired: true,
          accessCode: '1234',
          clientId: 'c-7',
        },
      ],
    });
    spies.getDocumentUrl.mockResolvedValue({ url: 'https://x/fresh.pdf' });

    render(<EsignModule />);
    fireEvent.click(screen.getByTestId('resume-draft'));
    await waitFor(() => screen.getByTestId('prepare-step'));

    expect(screen.getByTestId('prepare-step').getAttribute('data-url')).toBe('https://x/fresh.pdf');
    const signers = JSON.parse(screen.getByTestId('prepare-signers').textContent || '[]');
    expect(signers).toEqual([
      { name: 'Rea', email: 'rea@x.co', role: 'Signer', otpRequired: false, isSystemClient: false },
      {
        name: 'Dana',
        email: 'dana@x.co',
        role: 'Witness',
        order: 2,
        otpRequired: true,
        accessCode: '1234',
        clientId: 'c-7',
        isSystemClient: true,
      },
    ]);
    expect(toast.success).toHaveBeenCalledWith('Draft loaded — continue placing fields.');
  });

  it('resume prefers real signer records over draft_signers, mapping snake_case onto the wizard shape', async () => {
    spies.getEnvelope.mockResolvedValue({
      ...DRAFT_ENVELOPE,
      id: 'env-9',
      signers: [
        {
          id: 's-1',
          envelope_id: 'env-9',
          name: 'Rea',
          email: 'rea@x.co',
          order: 1,
          otp_required: false,
          access_code: null,
          client_id: null,
          access_token: 't',
          status: 'pending',
          created_at: 'x',
          updated_at: 'x',
        },
        {
          id: 's-2',
          envelope_id: 'env-9',
          name: 'Dana',
          email: 'dana@x.co',
          role: 'Witness',
          order: 2,
          otp_required: true,
          access_code: 'ac-9',
          client_id: 'c-7',
          access_token: 't2',
          status: 'pending',
          created_at: 'x',
          updated_at: 'x',
        },
      ],
      draft_signers: [{ name: 'Stale', email: 'stale@x.co' }],
    });
    spies.getDocumentUrl.mockResolvedValue({ url: 'https://x/fresh.pdf' });

    render(<EsignModule />);
    fireEvent.click(screen.getByTestId('resume-draft'));
    await waitFor(() => screen.getByTestId('prepare-step'));

    const signers = JSON.parse(screen.getByTestId('prepare-signers').textContent || '[]');
    expect(signers).toEqual([
      {
        name: 'Rea',
        email: 'rea@x.co',
        role: 'Signer',
        order: 1,
        otpRequired: false,
        isSystemClient: false,
      },
      {
        name: 'Dana',
        email: 'dana@x.co',
        role: 'Witness',
        order: 2,
        otpRequired: true,
        accessCode: 'ac-9',
        clientId: 'c-7',
        isSystemClient: true,
      },
    ]);
  });

  it('sending from the studio maps each field to its signer index and returns to the dashboard', async () => {
    spies.getEnvelope.mockResolvedValue({
      ...DRAFT_ENVELOPE,
      id: 'env-9',
      signers: [],
      draft_signers: [
        { name: 'Rea', email: 'rea@x.co' },
        { name: 'Dana', email: 'dana@x.co', order: 2 },
      ],
    });
    spies.getDocumentUrl.mockResolvedValue({ url: 'https://x/fresh.pdf' });

    render(<EsignModule />);
    fireEvent.click(screen.getByTestId('resume-draft'));
    await waitFor(() => screen.getByTestId('prepare-step'));

    fireEvent.click(screen.getByTestId('studio-send'));
    await waitFor(() => {
      expect(spies.sendInvites).toHaveBeenCalledTimes(1);
    });

    const [envelopeId, payload] = spies.sendInvites.mock.calls[0];
    expect(envelopeId).toBe('env-9');
    // The field addressed to dana@x.co resolves to index 1 of the wizard signers.
    expect(payload.fields).toHaveLength(1);
    expect(payload.fields[0]).toMatchObject({ signer_id: 'dana@x.co', signerIndex: 1 });
    expect(payload.signers.map((s: { email: string }) => s.email)).toEqual([
      'rea@x.co',
      'dana@x.co',
    ]);
    expect(toast.success).toHaveBeenCalledWith('Document sent for signature!');
    await waitFor(() => screen.getByTestId('esign-dashboard'));
  });

  it('dashboard actions mount the bulk-send, audit-log, and recovery-bin dialogs', async () => {
    render(<EsignModule />);
    fireEvent.click(screen.getByTestId('open-bulk-send'));
    await waitFor(() => screen.getByTestId('bulk-send-dialog'));
    fireEvent.click(screen.getByTestId('open-audit-log'));
    await waitFor(() => screen.getByTestId('audit-log-dialog'));
    fireEvent.click(screen.getByTestId('open-recovery-bin'));
    await waitFor(() => screen.getByTestId('recovery-bin-dialog'));
  });
});

// Type-level guard: the fixtures must stay assignable to the real template type.
const _typecheck: EsignTemplateRecord[] = [
  fixtures.TPL_READY,
  fixtures.TPL_NO_EMAIL,
  fixtures.TPL_EMPTY,
  fixtures.TPL_NO_DOCS,
];
void _typecheck;
