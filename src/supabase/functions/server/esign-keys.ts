/**
 * E-Signature Key Management
 * Centralized key generation for Redis/KV store to prevent collisions and typos.
 */

export const EsignKeys = {
  // Envelope related keys
  envelope: (id: string) => `esign:envelope:${id}`,
  envelopeFields: (id: string) => `esign:envelope:${id}:fields`,
  envelopeSigners: (id: string) => `esign:envelope:${id}:signers`,
  envelopeAudit: (id: string) => `esign:envelope:${id}:audit`,
  // P3.3 — page-transformation manifest persisted on the envelope so
  // "save draft" / "continue editing" round-trips it without rewriting the
  // EsignEnvelope shape across every consumer.
  envelopeManifest: (id: string) => `esign:envelope:${id}:manifest`,
  // P3.4 — Multi-document envelopes persist their ordered list of
  // documents here. The legacy `envelope.document_id` is kept as a
  // mirror of `documents[0].document_id` so existing readers continue
  // to work; new consumers should prefer this index.
  envelopeDocuments: (id: string) => `esign:envelope:${id}:documents`,
  // P3.4 — per-document page transformation manifest. Keyed on
  // (envelopeId, documentId) so two documents in the same envelope can
  // each have their own reorder/rotate/delete operations applied
  // independently before being concatenated at send-time.
  envelopeDocumentManifest: (envelopeId: string, documentId: string) =>
    `esign:envelope:${envelopeId}:doc:${documentId}:manifest`,
  
  // Field related keys
  field: (id: string) => `esign:field:${id}`,
  
  // Signer related keys
  signerToken: (token: string) => `esign:token:${token}`, // Maps token to signer ID
  signerOtp: (id: string) => `esign:signer:${id}:otp`,
  
  // Template related keys
  template: (id: string) => `esign:template:${id}`,
  templatesList: () => `esign:templates:list`,
  // P4.2 — Template versioning. Every `updateTemplate` snapshots the
  // outgoing record into history under the (templateId, version) key
  // and bumps `template.version`. Envelopes created from a template
  // record `template_version` so the exact snapshot is retrievable
  // even after subsequent edits to the live template.
  templateVersion: (templateId: string, version: number) =>
    `esign:template:${templateId}:v:${version}`,
  templateVersionsIndex: (templateId: string) =>
    `esign:template:${templateId}:versions`,

  // P4.7 — Bulk-send "campaigns": one template fan-out to N recipients
  // tracked as a single object so the dashboard can show progress and
  // cancel mid-flight. An ordered child list of envelope ids lives at
  // `campaignEnvelopes`.
  campaign: (id: string) => `esign:campaign:${id}`,
  campaignsList: () => `esign:campaigns:list`,
  campaignEnvelopes: (id: string) => `esign:campaign:${id}:envelopes`,

  // P4.8 — Packet workflows: an ordered list of template ids that
  // chain together. Each envelope spawned from a packet records the
  // packet id + step index; completion of step N triggers send of N+1.
  packet: (id: string) => `esign:packet:${id}`,
  packetsList: () => `esign:packets:list`,
  packetRun: (id: string) => `esign:packet:run:${id}`,
  packetRunsList: () => `esign:packet:runs:list`,
  
  // Index keys
  clientEnvelopes: (clientId: string) => `esign:client:${clientId}:envelopes`,
  signerEmailEnvelopes: (email: string) => `esign:signer-email:${email.toLowerCase().trim()}:envelopes`,
  allEnvelopes: () => `esign:envelopes:all`,
  
  // Storage paths
  documentStoragePath: (id: string, filename: string) => `documents/${id}/${filename}`,
  certificateStoragePath: (id: string) => `certificates/${id}/certificate.pdf`,
  signedDocumentStoragePath: (id: string) => `completed/${id}/signed_document.pdf`,
  // P3.5 — Signer-uploaded attachments live under attachments/{envelopeId}/{attachmentId}.
  attachmentStoragePath: (envelopeId: string, attachmentId: string, filename: string) =>
    `attachments/${envelopeId}/${attachmentId}-${filename}`,
  // Per-envelope index of attachments so the certificate renderer can list them.
  envelopeAttachments: (envelopeId: string) => `esign:envelope:${envelopeId}:attachments`,
  
  // P5.7 — In-app notifications. Lightweight per-user queue surfaced by
  // the dashboard bell UI. `notification` stores the record itself;
  // `notificationsByUser` indexes the user's most-recent ids in reverse
  // chronological order. `notificationsUnread` is a small counter cache
  // to avoid scanning every time the bell renders.
  notification: (id: string) => `esign:inapp:notif:${id}`,
  notificationsByUser: (userId: string) => `esign:inapp:user:${userId}:notifs`,
  notificationsUnread: (userId: string) => `esign:inapp:user:${userId}:unread`,

  // P7.2 — Stuck-envelope alert idempotency. We record the last time a
  // stuck notification fired for an envelope so a single envelope only
  // generates one email per cooldown window.
  stuckAlert: (envelopeId: string) => `esign:stuck-alert:${envelopeId}`,

  // P7.4 — Synthetic probe result. The scheduler stamps the latest
  // create-sign-void round-trip result (success / latency) here so a
  // diagnostics endpoint can surface it without re-running the probe.
  syntheticProbeLatest: () => `esign:synthetic:latest`,
  syntheticProbeHistory: () => `esign:synthetic:history`,

  // P7.7 — Firm-scoped storage retention policy. When set, the
  // scheduler purges completed / declined / voided envelopes (and
  // their artifacts) beyond the configured retention age.
  retentionPolicy: (firmId: string) => `esign:retention:${firmId}`,
  retentionPoliciesIndex: () => `esign:retention:index`,

  // P8.6 — Per-firm signer-page branding. Stored as a small JSON blob
  // ({ displayName, logoUrl, accentHex, supportEmail }). Read once during
  // /signer/validate and embedded in the public session payload so the
  // signer page can theme without an extra round-trip.
  firmBranding: (firmId: string) => `esign:branding:${firmId}`,

  // Prefixes for bulk operations
  PREFIX_ENVELOPE: 'esign:envelope:',
  PREFIX_SIGNER: 'esign:signer:',
  PREFIX_FIELD: 'esign:field:',
  PREFIX_DOCUMENT: 'esign:document:',
  PREFIX_AUDIT: 'esign:audit:',
  PREFIX_TEMPLATE: 'esign:template:',
};