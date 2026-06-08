import { describe, it, expect, vi, beforeEach } from 'vitest';
import { esignApi } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock('../../../../../utils/supabase/info', () => ({
  projectId: 'test-project-id',
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MOCK_ENVELOPE = {
  id: 'env-001',
  title: 'Test Envelope',
  status: 'draft',
  signers: [],
};

const MOCK_TEMPLATE = {
  id: 'tmpl-001',
  name: 'Standard Template',
  status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('esignApi envelope operations', () => {
  it('getEnvelope returns envelope by ID', async () => {
    mockApiGet.mockResolvedValue(MOCK_ENVELOPE);
    const result = await esignApi.getEnvelope('env-001');
    expect(result).toEqual(MOCK_ENVELOPE);
    expect(mockApiGet).toHaveBeenCalledWith('/esign/envelopes/env-001');
  });

  it('saveFields puts fields to envelope endpoint', async () => {
    const fields = [{ id: 'f1', type: 'signature', x: 100, y: 200, page: 1 }];
    mockApiPut.mockResolvedValue({ success: true, fields });
    const result = await esignApi.saveFields('env-001', fields as never);
    expect(result.success).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith('/esign/envelopes/env-001/fields', { fields });
  });

  it('saveDraftSigners calls put on draft-signers endpoint', async () => {
    const signers = [{ name: 'Alice', email: 'alice@test.com', role: 'signer', order: 1 }];
    mockApiPut.mockResolvedValue({ success: true, count: 1 });
    const result = await esignApi.saveDraftSigners('env-001', signers);
    expect(result.count).toBe(1);
    expect(mockApiPut).toHaveBeenCalledWith('/esign/envelopes/env-001/draft-signers', { signers });
  });

  it('updateDraftSettings calls patch on draft-settings endpoint', async () => {
    mockApiPatch.mockResolvedValue({ success: true, changed: {}, envelope: MOCK_ENVELOPE });
    const result = await esignApi.updateDraftSettings('env-001', { title: 'Updated Title' });
    expect(mockApiPatch).toHaveBeenCalledWith('/esign/envelopes/env-001/draft-settings', {
      title: 'Updated Title',
    });
    expect(result.success).toBe(true);
  });

  it('sendInvites posts to invites endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, invitesSent: 2 });
    const result = await esignApi.sendInvites('env-001', { message: 'Please sign' } as never);
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/invites', {
      message: 'Please sign',
    });
  });

  it('getAllEnvelopes returns envelopes list', async () => {
    mockApiGet.mockResolvedValue({ envelopes: [MOCK_ENVELOPE] });
    const result = await esignApi.getAllEnvelopes();
    expect(result.envelopes.length).toBe(1);
  });

  it('getAllEnvelopes returns empty list on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Server error'));
    const result = await esignApi.getAllEnvelopes();
    expect(result.envelopes).toEqual([]);
  });

  it('getAllEnvelopes adds status query param when provided', async () => {
    mockApiGet.mockResolvedValue({ envelopes: [] });
    await esignApi.getAllEnvelopes('sent');
    expect(mockApiGet).toHaveBeenCalledWith('/esign/envelopes?status=sent');
  });

  it('getClientEnvelopes returns client envelopes', async () => {
    mockApiGet.mockResolvedValue({ envelopes: [MOCK_ENVELOPE] });
    const result = await esignApi.getClientEnvelopes('client-001');
    expect(result.envelopes.length).toBe(1);
  });

  it('getClientEnvelopes appends email param when provided', async () => {
    mockApiGet.mockResolvedValue({ envelopes: [] });
    await esignApi.getClientEnvelopes('client-001', 'alice@test.com');
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('email=alice%40test.com'));
  });

  it('getClientEnvelopes returns empty on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    const result = await esignApi.getClientEnvelopes('client-001');
    expect(result.envelopes).toEqual([]);
  });

  it('deleteEnvelope calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue({ success: true, deleted: true });
    const result = await esignApi.deleteEnvelope('env-001');
    expect(result.deleted).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith('/esign/envelopes/env-001');
  });

  it('voidEnvelope posts to void endpoint with reason', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await esignApi.voidEnvelope('env-001', 'Client request');
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/void', {
      reason: 'Client request',
    });
  });

  it('voidEnvelope uses default reason when none provided', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    await esignApi.voidEnvelope('env-001');
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/void', {
      reason: 'Voided by admin',
    });
  });
});

describe('esignApi signer operations', () => {
  it('sendOTP posts to OTP send endpoint', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await esignApi.sendOTP('env-001', 'signer-001');
    expect(mockApiPost).toHaveBeenCalledWith(
      '/esign/envelopes/env-001/signers/signer-001/otp/send',
    );
  });

  it('verifyOTP posts verification request', async () => {
    mockApiPost.mockResolvedValue({ success: true, token: 'jwt-token' });
    const result = await esignApi.verifyOTP('env-001', 'signer-001', { otp: '123456' } as never);
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/signers/signer-001/verify', {
      otp: '123456',
    });
  });

  it('submitSignature posts to sign endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await esignApi.submitSignature('env-001', {
      signature: 'data:image/png',
    } as never);
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/sign', {
      signature: 'data:image/png',
    });
  });

  it('rejectSigning posts to reject endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await esignApi.rejectSigning('env-001', {
      reason: 'Incorrect document',
    } as never);
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/reject', {
      reason: 'Incorrect document',
    });
  });

  it('sendReminder posts to remind endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, remindersSent: [], totalReminders: 2 });
    const result = await esignApi.sendReminder('env-001');
    expect(result.success).toBe(true);
  });

  it('recallEnvelope posts to recall endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    await esignApi.recallEnvelope('env-001', 'Client changed mind');
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/recall', {
      reason: 'Client changed mind',
    });
  });
});

describe('esignApi audit and document operations', () => {
  it('getAuditTrail returns events from API', async () => {
    mockApiGet.mockResolvedValue({ events: [{ id: 'evt-1', action: 'viewed' }] });
    const result = await esignApi.getAuditTrail('env-001');
    expect(result.events.length).toBe(1);
  });

  it('getAuditTrail returns empty events on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Audit unavailable'));
    const result = await esignApi.getAuditTrail('env-001');
    expect(result.events).toEqual([]);
  });

  it('getDocumentUrl returns URL from API', async () => {
    mockApiGet.mockResolvedValue({ url: 'https://example.com/doc.pdf', expiresAt: '2025-12-31' });
    const result = await esignApi.getDocumentUrl('env-001');
    expect(result.url).toBe('https://example.com/doc.pdf');
  });

  it('getCertificateUrl returns certificate URL', async () => {
    mockApiGet.mockResolvedValue({ url: 'https://example.com/cert.pdf' });
    const result = await esignApi.getCertificateUrl('env-001');
    expect(result.url).toBe('https://example.com/cert.pdf');
  });

  it('getApiBaseUrl returns correct URL with project ID', () => {
    const url = esignApi.getApiBaseUrl();
    expect(url).toContain('test-project-id');
    expect(url).toContain('/esign');
  });

  it('getAuditExportUrl returns URL string with envelope ID', () => {
    const url = esignApi.getAuditExportUrl('env-001');
    expect(url).toContain('env-001');
    expect(url).toContain('audit/export');
  });
});

describe('esignApi template operations', () => {
  it('listTemplates returns templates from API', async () => {
    mockApiGet.mockResolvedValue({ templates: [MOCK_TEMPLATE] });
    const result = await esignApi.listTemplates();
    expect(result.templates.length).toBe(1);
  });

  it('listTemplates returns empty on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Templates unavailable'));
    const result = await esignApi.listTemplates();
    expect(result.templates).toEqual([]);
  });

  it('getTemplate returns single template', async () => {
    mockApiGet.mockResolvedValue({ template: MOCK_TEMPLATE });
    const result = await esignApi.getTemplate('tmpl-001');
    expect(result.template).toEqual(MOCK_TEMPLATE);
    expect(mockApiGet).toHaveBeenCalledWith('/esign/templates/tmpl-001');
  });

  it('createTemplate posts to templates endpoint', async () => {
    mockApiPost.mockResolvedValue({ template: MOCK_TEMPLATE });
    const input = { name: 'New Template', envelopeId: 'env-001' };
    const result = await esignApi.createTemplate(input as never);
    expect(result.template).toEqual(MOCK_TEMPLATE);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/templates', input);
  });

  it('updateTemplate puts to template endpoint', async () => {
    const updated = { ...MOCK_TEMPLATE, name: 'Updated' };
    mockApiPut.mockResolvedValue({ template: updated });
    const result = await esignApi.updateTemplate('tmpl-001', { name: 'Updated' } as never);
    expect(result.template.name).toBe('Updated');
  });

  it('deleteTemplate calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue({ success: true });
    const result = await esignApi.deleteTemplate('tmpl-001');
    expect(result.success).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith('/esign/templates/tmpl-001');
  });

  it('useTemplate posts to use endpoint', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      usageCount: 5,
      version: 2,
      template: MOCK_TEMPLATE,
    });
    const result = await esignApi.useTemplate('tmpl-001');
    expect(result.success).toBe(true);
  });
});

describe('esignApi retention policy', () => {
  it('getRetentionPolicy returns policy', async () => {
    const policy = {
      firm_id: 'firm-1',
      completed_retention_days: 365,
      terminated_retention_days: 90,
      draft_retention_days: 30,
      delete_artifacts: false,
      updated_at: '2025-01-01',
    };
    mockApiGet.mockResolvedValue({ policy });
    const result = await esignApi.getRetentionPolicy();
    expect(result.policy?.completed_retention_days).toBe(365);
  });

  it('setRetentionPolicy calls put', async () => {
    mockApiPut.mockResolvedValue({ policy: {} });
    const result = await esignApi.setRetentionPolicy({ completed_retention_days: 365 });
    expect(mockApiPut).toHaveBeenCalledWith('/esign/retention', { completed_retention_days: 365 });
    expect(result.policy).toBeDefined();
  });

  it('deleteRetentionPolicy calls delete', async () => {
    mockApiDelete.mockResolvedValue({ ok: true });
    const result = await esignApi.deleteRetentionPolicy();
    expect(result.ok).toBe(true);
  });
});

describe('esignApi maintenance operations', () => {
  it('runExpirySweep posts with dryRun flag', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      scannedCount: 100,
      expiredCount: 5,
      skippedCount: 95,
      expired: [],
      errors: [],
      dryRun: true,
      durationMs: 250,
    });
    const result = await esignApi.runExpirySweep(true);
    expect(result.dryRun).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/maintenance/expiry-sweep', { dryRun: true });
  });

  it('bulkRemind posts envelope IDs with dryRun flag', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: true,
      envelopeCount: 2,
      totalPendingSigners: 4,
      totalRemindersSent: 0,
      results: [],
    });
    const result = await esignApi.bulkRemind(['env-001', 'env-002'], true);
    expect(result.envelopeCount).toBe(2);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/maintenance/bulk-remind', {
      envelopeIds: ['env-001', 'env-002'],
      dryRun: true,
    });
  });

  it('bulkVoid posts with reason and dryRun flag', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: true,
      envelopeCount: 1,
      voidedCount: 0,
      results: [],
    });
    const result = await esignApi.bulkVoid(['env-001'], 'Duplicate', true);
    expect(result.dryRun).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/maintenance/bulk-void', {
      envelopeIds: ['env-001'],
      reason: 'Duplicate',
      dryRun: true,
    });
  });

  it('verifyDocumentHash posts hash for verification', async () => {
    mockApiPost.mockResolvedValue({ verified: true, matchType: 'signed', message: 'Verified' });
    const result = await esignApi.verifyDocumentHash('abc123');
    expect(result.verified).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/verify-hash', { hash: 'abc123' });
  });
});

describe('esignApi webhook operations', () => {
  it('listWebhookSubscriptions returns subscriptions', async () => {
    mockApiGet.mockResolvedValue({ subscriptions: [{ id: 'wh-1', url: 'https://webhook.site' }] });
    const result = await esignApi.listWebhookSubscriptions();
    expect(result.subscriptions.length).toBe(1);
  });

  it('createWebhookSubscription posts to webhooks endpoint', async () => {
    mockApiPost.mockResolvedValue({
      subscription: {
        id: 'wh-1',
        secret: 'sec-123',
        url: 'https://wh.io',
        events: ['completed'],
        active: true,
      },
    });
    const result = await esignApi.createWebhookSubscription({
      url: 'https://wh.io',
      events: ['completed'],
    });
    expect(result.subscription.id).toBe('wh-1');
  });

  it('deleteWebhookSubscription calls delete', async () => {
    mockApiDelete.mockResolvedValue({ success: true });
    const result = await esignApi.deleteWebhookSubscription('wh-1');
    expect(result.success).toBe(true);
  });

  it('rotateWebhookSecret posts to rotate-secret endpoint', async () => {
    mockApiPost.mockResolvedValue({ subscription: { id: 'wh-1', secret: 'new-secret' } });
    const result = await esignApi.rotateWebhookSecret('wh-1');
    expect(result.subscription.secret).toBe('new-secret');
  });
});

describe('esignApi campaigns and packets', () => {
  it('listCampaigns returns campaigns', async () => {
    mockApiGet.mockResolvedValue({ campaigns: [{ id: 'camp-1', title: 'Bulk Sign' }] });
    const result = await esignApi.listCampaigns();
    expect(result.campaigns.length).toBe(1);
  });

  it('getCampaign returns single campaign', async () => {
    mockApiGet.mockResolvedValue({ campaign: { id: 'camp-1', title: 'Bulk Sign' } });
    const result = await esignApi.getCampaign('camp-1');
    expect(result.campaign.id).toBe('camp-1');
  });

  it('cancelCampaign posts to cancel endpoint', async () => {
    mockApiPost.mockResolvedValue({ campaign: { id: 'camp-1', status: 'cancelled' } });
    const result = await esignApi.cancelCampaign('camp-1');
    expect(mockApiPost).toHaveBeenCalledWith('/esign/campaigns/camp-1/cancel');
  });

  it('listPackets returns packets', async () => {
    mockApiGet.mockResolvedValue({ packets: [{ id: 'pkt-1', name: 'Onboarding Pack' }] });
    const result = await esignApi.listPackets();
    expect(result.packets.length).toBe(1);
  });

  it('deletePacket calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue({ ok: true });
    const result = await esignApi.deletePacket('pkt-1');
    expect(result.ok).toBe(true);
  });

  it('getPacketRun returns packet run by ID', async () => {
    mockApiGet.mockResolvedValue({ run: { id: 'run-1', status: 'in_progress' } });
    const result = await esignApi.getPacketRun('run-1');
    expect(result.run.id).toBe('run-1');
  });

  it('cancelPacketRun posts to cancel endpoint', async () => {
    mockApiPost.mockResolvedValue({ run: { id: 'run-1', status: 'cancelled' } });
    const result = await esignApi.cancelPacketRun('run-1');
    expect(result.run.status).toBe('cancelled');
  });
});

describe('esignApi notification preferences', () => {
  it('getNotificationPreferences calls get endpoint', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      preferences: { userId: 'u1', mode: 'every_event', updated_at: '2025-01-01' },
    });
    const result = await esignApi.getNotificationPreferences();
    expect(result.success).toBe(true);
    expect(result.preferences.mode).toBe('every_event');
  });

  it('setNotificationPreferences calls put endpoint', async () => {
    mockApiPut.mockResolvedValue({
      success: true,
      preferences: { userId: 'u1', mode: 'digest', updated_at: '2025-01-01' },
    });
    const result = await esignApi.setNotificationPreferences({ mode: 'digest' });
    expect(result.preferences.mode).toBe('digest');
    expect(mockApiPut).toHaveBeenCalledWith('/esign/me/notification-prefs', { mode: 'digest' });
  });
});

describe('esignApi page manifest operations', () => {
  it('getPageManifest returns manifest', async () => {
    mockApiGet.mockResolvedValue({ manifest: { version: 1, pages: [] } });
    const result = await esignApi.getPageManifest('env-001');
    expect(result.manifest?.version).toBe(1);
  });

  it('clearPageManifest calls delete on manifest endpoint', async () => {
    mockApiDelete.mockResolvedValue({ success: true });
    const result = await esignApi.clearPageManifest('env-001');
    expect(result.success).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith('/esign/envelopes/env-001/manifest');
  });

  it('savePageManifest calls put with manifest payload', async () => {
    const manifest = { version: 1 as const, pages: [{ sourcePage: 1, rotation: 0 as const }] };
    mockApiPut.mockResolvedValue({ success: true, manifest });
    const result = await esignApi.savePageManifest('env-001', manifest);
    expect(result.success).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith('/esign/envelopes/env-001/manifest', { manifest });
  });
});

describe('esignApi multi-document operations', () => {
  it('listEnvelopeDocuments returns documents', async () => {
    mockApiGet.mockResolvedValue({
      documents: [
        {
          document_id: 'doc-1',
          order: 0,
          display_name: 'Agreement.pdf',
          original_filename: 'agreement.pdf',
          page_count: 5,
          storage_path: 'path',
          added_at: '2025-01-01',
        },
      ],
    });
    const result = await esignApi.listEnvelopeDocuments('env-001');
    expect(result.documents.length).toBe(1);
  });

  it('removeEnvelopeDocument calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue({ documents: [] });
    const result = await esignApi.removeEnvelopeDocument('env-001', 'doc-1');
    expect(mockApiDelete).toHaveBeenCalledWith('/esign/envelopes/env-001/documents/doc-1');
    expect(result.documents).toEqual([]);
  });

  it('reorderEnvelopeDocuments calls put with order array', async () => {
    mockApiPut.mockResolvedValue({ documents: [] });
    await esignApi.reorderEnvelopeDocuments('env-001', ['doc-2', 'doc-1']);
    expect(mockApiPut).toHaveBeenCalledWith('/esign/envelopes/env-001/documents/order', {
      order: ['doc-2', 'doc-1'],
    });
  });
});

describe('esignApi recovery bin', () => {
  it('listRecoveryBin returns deleted envelopes', async () => {
    mockApiGet.mockResolvedValue({ envelopes: [], retention_days: 30 });
    const result = await esignApi.listRecoveryBin();
    expect(result.retention_days).toBe(30);
  });

  it('restoreEnvelope posts to restore endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, envelope: { id: 'env-001' } });
    const result = await esignApi.restoreEnvelope('env-001');
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/recovery-bin/env-001/restore', {});
  });

  it('purgeEnvelope calls delete on recovery bin', async () => {
    mockApiDelete.mockResolvedValue({ success: true, purged: true });
    const result = await esignApi.purgeEnvelope('env-001');
    expect(result.purged).toBe(true);
  });
});

describe('esignApi reminder and signing mode', () => {
  it('getReminderConfig returns config for envelope', async () => {
    const config = { enabled: true, intervalDays: 3, maxReminders: 5 };
    mockApiGet.mockResolvedValue({ config });
    const result = await esignApi.getReminderConfig('env-001');
    expect(result.config).toEqual(config);
  });

  it('updateReminderConfig calls put on reminder-config endpoint', async () => {
    const config = { enabled: false };
    mockApiPut.mockResolvedValue({ config });
    const result = await esignApi.updateReminderConfig('env-001', config as never);
    expect(mockApiPut).toHaveBeenCalledWith('/esign/envelopes/env-001/reminder-config', config);
  });

  it('updateSigningMode calls patch on signing-mode endpoint', async () => {
    mockApiPatch.mockResolvedValue({ success: true, signing_mode: 'sequential' });
    const result = await esignApi.updateSigningMode('env-001', 'sequential' as never);
    expect(result.signing_mode).toBe('sequential');
    expect(mockApiPatch).toHaveBeenCalledWith('/esign/envelopes/env-001/signing-mode', {
      signing_mode: 'sequential',
    });
  });
});

describe('esignApi metrics and diagnostics', () => {
  it('getMetrics returns org metrics bundle', async () => {
    const metrics = {
      firm_id: 'firm-1',
      generated_at: '2025-06-01',
      statusCounts: { draft: 10, sent: 5 },
      funnel: {
        sent: 5,
        opened: 4,
        started: 3,
        completed: 2,
        sentToOpenedPct: 80,
        openedToStartedPct: 75,
        startedToCompletedPct: 67,
      },
      timeToSign: { completedCount: 2, averageMs: null, medianMs: null, byTemplate: [] },
      stuckEnvelopes: [],
      throughput30d: [],
    };
    mockApiGet.mockResolvedValue(metrics);
    const result = await esignApi.getMetrics();
    expect(result.firm_id).toBe('firm-1');
    expect(result.funnel.sent).toBe(5);
  });

  it('getSyntheticProbe returns probe results', async () => {
    mockApiGet.mockResolvedValue({
      latest: { ok: true, latencyMs: 120, ranAt: '2025-01-01', checks: {} },
      history: [],
    });
    const result = await esignApi.getSyntheticProbe();
    expect(result.latest?.ok).toBe(true);
  });

  it('runSyntheticProbe posts to run endpoint', async () => {
    mockApiPost.mockResolvedValue({ ok: true, latencyMs: 200, ranAt: '2025-01-01' });
    const result = await esignApi.runSyntheticProbe();
    expect(result.ok).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/diagnostics/synthetic/run', {});
  });

  it('searchAudit calls get with query params', async () => {
    mockApiGet.mockResolvedValue({
      hits: [],
      total: 0,
      truncated: false,
      scanned: 100,
      durationMs: 50,
    });
    const result = await esignApi.searchAudit({ signer_email: 'alice@test.com', limit: 10 });
    expect(result.total).toBe(0);
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('signer_email=alice%40test.com'),
    );
  });

  it('searchAudit returns empty hits for no params', async () => {
    mockApiGet.mockResolvedValue({
      hits: [],
      total: 0,
      truncated: false,
      scanned: 0,
      durationMs: 10,
    });
    const result = await esignApi.searchAudit({});
    expect(result.hits).toEqual([]);
    expect(mockApiGet).toHaveBeenCalledWith('/esign/audit/search');
  });
});

describe('esignApi in-app notifications', () => {
  it('listInAppNotifications returns notification list', async () => {
    mockApiGet.mockResolvedValue({ success: true, items: [], unread: 0, total: 0 });
    const result = await esignApi.listInAppNotifications();
    expect(result.success).toBe(true);
  });

  it('listInAppNotifications passes unreadOnly param', async () => {
    mockApiGet.mockResolvedValue({ success: true, items: [], unread: 2, total: 2 });
    await esignApi.listInAppNotifications({ unreadOnly: true });
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('unreadOnly=true'));
  });

  it('markInAppNotificationRead posts to read endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await esignApi.markInAppNotificationRead('notif-001');
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/me/notifications/notif-001/read');
  });

  it('markAllInAppNotificationsRead posts to read-all endpoint', async () => {
    mockApiPost.mockResolvedValue({ success: true, updated: 5 });
    const result = await esignApi.markAllInAppNotificationsRead();
    expect(result.updated).toBe(5);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/me/notifications/read-all');
  });
});

describe('esignApi uploadDocument and saveAsTemplate', () => {
  it('uploadDocument posts FormData to upload endpoint', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const mockResponse = { envelope: { id: 'env-001', title: 'Test', status: 'draft' } };
    mockApiPost.mockResolvedValue(mockResponse);
    const result = await esignApi.uploadDocument({
      files: [file],
      context: { title: 'Test Envelope' },
    });
    expect(result).toEqual(mockResponse);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/upload', expect.any(FormData));
  });

  it('uploadDocument appends each file and context to FormData', async () => {
    const file1 = new File(['a'], 'a.pdf', { type: 'application/pdf' });
    const file2 = new File(['b'], 'b.pdf', { type: 'application/pdf' });
    mockApiPost.mockResolvedValue({ envelope: { id: 'env-001' } });
    await esignApi.uploadDocument({
      files: [file1, file2],
      context: { title: 'Multi-doc', clientId: 'client-001' },
    });
    const [, formData] = mockApiPost.mock.calls[0] as [string, FormData];
    expect(formData.getAll('files').length).toBe(2);
    expect(formData.get('context')).toContain('Multi-doc');
  });

  it('saveAsTemplate posts to envelope templates endpoint', async () => {
    const mockTemplate = { id: 'tmpl-001', name: 'My Template', envelopeId: 'env-001' };
    mockApiPost.mockResolvedValue({ template: mockTemplate, templateId: 'tmpl-001' });
    const result = await esignApi.saveAsTemplate('env-001', {
      name: 'My Template',
    } as never);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/envelopes/env-001/templates', {
      name: 'My Template',
    });
    expect(result.templateId).toBe('tmpl-001');
  });
});

describe('esignApi syncTemplateFromEnvelope', () => {
  it('posts to from-envelope endpoint with correct payload', async () => {
    const mockTemplate = { id: 'tmpl-001', name: 'Synced Template' };
    mockApiPost.mockResolvedValue({ template: mockTemplate });
    const result = await esignApi.syncTemplateFromEnvelope({
      templateId: 'tmpl-001',
      envelopeId: 'env-001',
      name: 'Synced Template',
      description: 'Updated from envelope',
      category: 'onboarding',
    });
    expect(result.template).toEqual(mockTemplate);
    expect(mockApiPost).toHaveBeenCalledWith('/esign/templates/tmpl-001/from-envelope', {
      envelopeId: 'env-001',
      name: 'Synced Template',
      description: 'Updated from envelope',
      category: 'onboarding',
    });
  });

  it('omits optional fields when not provided', async () => {
    mockApiPost.mockResolvedValue({ template: { id: 'tmpl-001' } });
    await esignApi.syncTemplateFromEnvelope({
      templateId: 'tmpl-001',
      envelopeId: 'env-002',
    });
    expect(mockApiPost).toHaveBeenCalledWith('/esign/templates/tmpl-001/from-envelope', {
      envelopeId: 'env-002',
      name: undefined,
      description: undefined,
      category: undefined,
    });
  });
});

describe('esignApi firm branding', () => {
  it('getFirmBranding returns branding from API', async () => {
    const branding = {
      firm_id: 'firm-1',
      display_name: 'Acme Wealth',
      logo_url: 'https://cdn.example.com/logo.png',
      accent_hex: '#4A90E2',
      support_email: 'support@acme.com',
      updated_at: '2025-01-01',
    };
    mockApiGet.mockResolvedValue({ branding });
    const result = await esignApi.getFirmBranding();
    expect(result.branding?.display_name).toBe('Acme Wealth');
    expect(mockApiGet).toHaveBeenCalledWith('/esign/branding');
  });

  it('getFirmBranding returns null branding when not configured', async () => {
    mockApiGet.mockResolvedValue({ branding: null });
    const result = await esignApi.getFirmBranding();
    expect(result.branding).toBeNull();
  });

  it('setFirmBranding calls put with branding payload', async () => {
    mockApiPut.mockResolvedValue({ branding: { display_name: 'Acme', logo_url: null } });
    const result = await esignApi.setFirmBranding({
      display_name: 'Acme',
      accent_hex: '#FF5733',
    });
    expect(result.branding).toBeDefined();
    expect(mockApiPut).toHaveBeenCalledWith('/esign/branding', {
      display_name: 'Acme',
      accent_hex: '#FF5733',
    });
  });

  it('deleteFirmBranding calls delete on branding endpoint', async () => {
    mockApiDelete.mockResolvedValue({ ok: true });
    const result = await esignApi.deleteFirmBranding();
    expect(result.ok).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith('/esign/branding');
  });
});
