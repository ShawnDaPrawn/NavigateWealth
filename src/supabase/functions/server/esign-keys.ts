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
  
  // Field related keys
  field: (id: string) => `esign:field:${id}`,
  
  // Signer related keys
  signerToken: (token: string) => `esign:token:${token}`, // Maps token to signer ID
  signerOtp: (id: string) => `esign:signer:${id}:otp`,
  
  // Template related keys
  template: (id: string) => `esign:template:${id}`,
  templatesList: () => `esign:templates:list`,
  
  // Index keys
  clientEnvelopes: (clientId: string) => `esign:client:${clientId}:envelopes`,
  signerEmailEnvelopes: (email: string) => `esign:signer-email:${email.toLowerCase().trim()}:envelopes`,
  allEnvelopes: () => `esign:envelopes:all`,
  
  // Storage paths
  documentStoragePath: (id: string, filename: string) => `documents/${id}/${filename}`,
  certificateStoragePath: (id: string) => `certificates/${id}/certificate.pdf`,
  signedDocumentStoragePath: (id: string) => `completed/${id}/signed_document.pdf`,
  
  // Prefixes for bulk operations
  PREFIX_ENVELOPE: 'esign:envelope:',
  PREFIX_SIGNER: 'esign:signer:',
  PREFIX_FIELD: 'esign:field:',
  PREFIX_DOCUMENT: 'esign:document:',
  PREFIX_AUDIT: 'esign:audit:',
  PREFIX_TEMPLATE: 'esign:template:',
};