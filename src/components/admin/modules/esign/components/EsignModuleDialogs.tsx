/**
 * Dialog layer of the e-sign module: the template picker, bulk send and the
 * envelope inspector, all lazy-loaded. The module root owns the open/closed
 * state and the handlers; this component owns the mounting and the lazy
 * chunking, so index.tsx stays focused on the wizard state machine.
 */
import React, { Suspense } from 'react';
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

interface EsignModuleDialogsProps {
  templatePickerOpen: boolean;
  onTemplatePickerOpenChange: (open: boolean) => void;
  onStartBlank: () => void;
  onSelectTemplate: (template: EsignTemplateRecord) => void;
  bulkSendOpen: boolean;
  onBulkSendOpenChange: (open: boolean) => void;
  /** Bump the dashboard's refresh trigger after a dialog changed data. */
  onRefresh: () => void;
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
  onRefresh,
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
