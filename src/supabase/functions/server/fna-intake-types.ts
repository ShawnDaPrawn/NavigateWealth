export const FNA_INTAKE_DOMAINS = [
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
] as const;

export type FnaIntakeDomain = (typeof FNA_INTAKE_DOMAINS)[number];

export type FnaIntakeSessionStatus = 'client_draft' | 'submitted' | 'accepted';

export interface FnaIntakeSubmittedBy {
  id: string;
  email: string;
}

export interface FnaIntakeSession {
  id: string;
  clientId: string;
  domain: FnaIntakeDomain;
  status: FnaIntakeSessionStatus;
  inputs: Record<string, unknown>;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  submittedBy?: FnaIntakeSubmittedBy | null;
  consentAcceptedAt?: string | null;
  consentTextVersion?: string;
  acceptedAt?: string | null;
  acceptedBy?: FnaIntakeSubmittedBy | null;
  linkedFnaId?: string | null;
  requestInfoAt?: string | null;
  intakeSource: 'client';
}

export const FNA_INTAKE_CONSENT_VERSION = '2026-05-v1';

export const FNA_INTAKE_CONSENT_TEXT =
  'I understand this is not financial advice. Navigate Wealth will review my information and may publish a formal Financial Needs Analysis after adviser review.';

export function isFnaIntakeDomain(value: string): value is FnaIntakeDomain {
  return (FNA_INTAKE_DOMAINS as readonly string[]).includes(value);
}

export type BatchIntakeOverlayStatus = 'client_draft' | 'submitted' | null;
