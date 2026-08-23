/**
 * Dialog layer of the e-sign module: every dashboard-launched dialog plus the
 * envelope inspector, all lazy-loaded. The module root owns the open/closed
 * state and the handlers; this component owns the mounting and the lazy
 * chunking, so index.tsx stays focused on the wizard state machine.
 */
import React, { Suspense } from 'react';
import { logger } from '../../../../../utils/logger';
import { esignApi } from '../api';
import { StepFallback } from './StepFallback';
import type { EsignEnvelope, EsignTemplateRecord } from '../types';

const EnvelopeInspector = React.lazy(() =>
  import('./EnvelopeInspector').then((m) => ({ default: m.EnvelopeInspector })),
);
const TemplatePickerDialog = React.lazy(() =>
  import('./TemplatePickerDialog').then((m) => ({ default: m.TemplatePickerDialog })),
);
const BulkSendDialog = React.lazy(() =>
  import('./BulkSendDialog').then((m) => ({ default: m.BulkSendDialog })),
);
const PacketsDialog = React.lazy(() =>
  import('./PacketsDialog').then((m) => ({ default: m.PacketsDialog })),
);
const NotificationPrefsDialog = React.lazy(() =>
  import('./NotificationPrefsDialog').then((m) => ({
    default: m.NotificationPrefsDialog,
  })),
);
const WebhooksDialog = React.lazy(() =>
  import('./WebhooksDialog').then((m) => ({ default: m.WebhooksDialog })),
);
const RecoveryBinDialog = React.lazy(() =>
  import('./RecoveryBinDialog').then((m) => ({ default: m.RecoveryBinDialog })),
);
// P7.3 — searchable global audit log; lazy-loaded when the admin opens it.
const AuditLogDialog = React.lazy(() =>
  import('./AuditLogDialog').then((m) => ({ default: m.AuditLogDialog })),
);
// P7.7 — retention policy editor; lazy-loaded.
const RetentionPolicyDialog = React.lazy(() =>
  import('./RetentionPolicyDialog').then((m) => ({ default: m.RetentionPolicyDialog })),
);
// P8.6 — Per-firm signer-page branding dialog; lazy-loaded.
const BrandingDialog = React.lazy(() =>
  import('./BrandingDialog').then((m) => ({ default: m.BrandingDialog })),
);

interface EsignModuleDialogsProps {
  templatePickerOpen: boolean;
  onTemplatePickerOpenChange: (open: boolean) => void;
  onStartBlank: () => void;
  onSelectTemplate: (template: EsignTemplateRecord) => void;
  bulkSendOpen: boolean;
  onBulkSendOpenChange: (open: boolean) => void;
  packetsOpen: boolean;
  onPacketsOpenChange: (open: boolean) => void;
  notificationPrefsOpen: boolean;
  onNotificationPrefsOpenChange: (open: boolean) => void;
  webhooksOpen: boolean;
  onWebhooksOpenChange: (open: boolean) => void;
  recoveryBinOpen: boolean;
  onRecoveryBinOpenChange: (open: boolean) => void;
  auditLogOpen: boolean;
  onAuditLogOpenChange: (open: boolean) => void;
  retentionOpen: boolean;
  onRetentionOpenChange: (open: boolean) => void;
  brandingOpen: boolean;
  onBrandingOpenChange: (open: boolean) => void;
  /** Bump the dashboard's refresh trigger after a dialog changed data. */
  onRefresh: () => void;
  /** Open the envelope inspector on the given envelope (audit-log deep link). */
  onInspectEnvelope: (envelope: EsignEnvelope) => void;
  selectedEnvelope: EsignEnvelope | null;
  detailsDialogOpen: boolean;
  onDetailsOpenChange: (open: boolean) => void;
  onDownloadDocument: (envelopeId: string) => void;
  onResumePrepare?: (envelope: EsignEnvelope) => void;
  resumingEnvelopeId: string | null;
  onVoidEnvelope?: (envelopeId: string, reason: string) => void;
  onDeleteEnvelope?: (envelopeId: string) => void;
}

export function EsignModuleDialogs({
  templatePickerOpen,
  onTemplatePickerOpenChange,
  onStartBlank,
  onSelectTemplate,
  bulkSendOpen,
  onBulkSendOpenChange,
  packetsOpen,
  onPacketsOpenChange,
  notificationPrefsOpen,
  onNotificationPrefsOpenChange,
  webhooksOpen,
  onWebhooksOpenChange,
  recoveryBinOpen,
  onRecoveryBinOpenChange,
  auditLogOpen,
  onAuditLogOpenChange,
  retentionOpen,
  onRetentionOpenChange,
  brandingOpen,
  onBrandingOpenChange,
  onRefresh,
  onInspectEnvelope,
  selectedEnvelope,
  detailsDialogOpen,
  onDetailsOpenChange,
  onDownloadDocument,
  onResumePrepare,
  resumingEnvelopeId,
  onVoidEnvelope,
  onDeleteEnvelope,
}: EsignModuleDialogsProps) {
  return (
    <>
      {/* P4.1 / P4.3 — Template picker is shown when starting a new
          envelope. "Start blank" jumps to the upload step; "Use
          template" pre-fills recipients/message/expiry and pins the
          template on the eventual envelope. */}
      {templatePickerOpen && (
        <Suspense fallback={null}>
          <TemplatePickerDialog
            open={templatePickerOpen}
            onOpenChange={onTemplatePickerOpenChange}
            onStartBlank={onStartBlank}
            onSelectTemplate={(template) => onSelectTemplate(template)}
          />
        </Suspense>
      )}

      {/* P4.7 — Bulk send dialog. Mounted lazily; the dialog drives the
          campaign + per-row dispatch loop on the client side. */}
      {bulkSendOpen && (
        <Suspense fallback={null}>
          <BulkSendDialog
            open={bulkSendOpen}
            onOpenChange={onBulkSendOpenChange}
            onCompleted={onRefresh}
          />
        </Suspense>
      )}

      {/* P4.8 — Packet workflows dialog (author packets, start runs,
          monitor live chains). */}
      {packetsOpen && (
        <Suspense fallback={null}>
          <PacketsDialog
            open={packetsOpen}
            onOpenChange={onPacketsOpenChange}
            onCompleted={onRefresh}
          />
        </Suspense>
      )}

      {/* P5.2 — Sender notification preferences dialog. */}
      {notificationPrefsOpen && (
        <Suspense fallback={null}>
          <NotificationPrefsDialog
            open={notificationPrefsOpen}
            onOpenChange={onNotificationPrefsOpenChange}
          />
        </Suspense>
      )}

      {/* P5.4 — Webhook management dialog (endpoints, recent deliveries, DLQ). */}
      {webhooksOpen && (
        <Suspense fallback={null}>
          <WebhooksDialog open={webhooksOpen} onOpenChange={onWebhooksOpenChange} />
        </Suspense>
      )}

      {/* P6.8 — Recovery Bin. Lists soft-deleted envelopes and offers
          restore / immediate purge for the 90-day retention window. */}
      {recoveryBinOpen && (
        <Suspense fallback={null}>
          <RecoveryBinDialog
            open={recoveryBinOpen}
            onOpenChange={onRecoveryBinOpenChange}
            onChanged={onRefresh}
          />
        </Suspense>
      )}

      {/* P7.3 — Global audit log search across the firm. */}
      {auditLogOpen && (
        <Suspense fallback={null}>
          <AuditLogDialog
            open={auditLogOpen}
            onOpenChange={onAuditLogOpenChange}
            onOpenEnvelope={(envelopeId) => {
              esignApi
                .getEnvelope(envelopeId)
                .then((env) => {
                  if (env) {
                    onInspectEnvelope(env);
                  }
                })
                .catch((err) => logger.warn('Failed to open envelope from audit log', err));
            }}
          />
        </Suspense>
      )}

      {/* P7.7 — Retention policy editor. */}
      {retentionOpen && (
        <Suspense fallback={null}>
          <RetentionPolicyDialog open={retentionOpen} onOpenChange={onRetentionOpenChange} />
        </Suspense>
      )}

      {/* P8.6 — Per-firm signer-page branding editor. */}
      {brandingOpen && (
        <Suspense fallback={null}>
          <BrandingDialog open={brandingOpen} onOpenChange={onBrandingOpenChange} />
        </Suspense>
      )}

      {/* Details Modal */}
      {selectedEnvelope && (
        <Suspense fallback={<StepFallback />}>
          <EnvelopeInspector
            envelope={selectedEnvelope}
            open={detailsDialogOpen}
            onOpenChange={onDetailsOpenChange}
            onDownloadDocument={onDownloadDocument}
            onResumePrepare={onResumePrepare}
            resumingEnvelopeId={resumingEnvelopeId}
            onVoidEnvelope={onVoidEnvelope}
            onDeleteEnvelope={onDeleteEnvelope}
          />
        </Suspense>
      )}
    </>
  );
}
