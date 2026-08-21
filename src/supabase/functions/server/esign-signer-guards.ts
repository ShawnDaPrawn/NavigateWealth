const FACTOR_SESSION_MS = 30 * 60 * 1000;
const ACTIVE_ENVELOPE_STATUSES = new Set(['sent', 'partially_signed']);
const ACTIVE_SIGNER_STATUSES = new Set(['pending', 'sent', 'viewed', 'otp_verified']);

type RecordLike = Record<string, any>;

function isFresh(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < FACTOR_SESSION_MS;
}

export function assertActiveSigningState(envelope: RecordLike, signer: RecordLike): void {
  if (!ACTIVE_ENVELOPE_STATUSES.has(String(envelope.status || ''))) {
    throw new Error('Envelope is not available for signing');
  }
  const expiresAt = new Date(String(envelope.expires_at || '')).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Document has expired');
  }
  if (!ACTIVE_SIGNER_STATUSES.has(String(signer.status || ''))) {
    throw new Error('Signer is not in an active signing state');
  }
}

export function getMissingSignerFactors(envelope: RecordLike, signer: RecordLike): string[] {
  const missing: string[] = [];
  if (signer.requires_otp && (!signer.otp_verified || !isFresh(signer.otp_verified_at))) {
    missing.push('otp');
  }
  if (signer.access_code && !isFresh(signer.access_code_verified_at)) {
    missing.push('access_code');
  }
  if (
    envelope.kba_required &&
    (signer.kba?.status !== 'passed' || !isFresh(signer.kba?.verified_at))
  ) {
    missing.push('kba');
  }
  return missing;
}

export function isSignerTurn(envelope: RecordLike, signer: RecordLike): boolean {
  if ((envelope.signing_mode || 'sequential') === 'parallel') return true;
  const signerOrder = Number(signer.order || 1);
  const signers = Array.isArray(envelope.signers) ? envelope.signers : [];
  return signers
    .filter((candidate: RecordLike) => Number(candidate.order || 0) < signerOrder)
    .every((candidate: RecordLike) => candidate.status === 'signed');
}

export function assertSignerFieldOwnership(
  envelope: RecordLike,
  signerId: string,
  values: unknown,
): void {
  if (!Array.isArray(values)) return;
  const ownedIds = new Set(
    (Array.isArray(envelope.fields) ? envelope.fields : [])
      .filter((field: RecordLike) => field.signer_id === signerId)
      .map((field: RecordLike) => field.id),
  );
  for (const value of values) {
    const fieldId = (value as RecordLike)?.field_id;
    if (typeof fieldId !== 'string' || !ownedIds.has(fieldId)) {
      throw new Error('Field does not belong to this signer');
    }
  }
}
