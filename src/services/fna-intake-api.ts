/**
 * FNA Intake API — client-led financial discovery
 */

import { api } from '../utils/api';

export type FnaIntakeDomain =
  | 'risk'
  | 'medical'
  | 'retirement'
  | 'investment'
  | 'tax'
  | 'estate';

export type FnaIntakeSessionStatus = 'client_draft' | 'submitted' | 'accepted';

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
  consentAcceptedAt?: string | null;
  linkedFnaId?: string | null;
  requestInfoAt?: string | null;
  intakeSource: 'client';
}

export interface AcceptIntakeResult {
  session: FnaIntakeSession;
  linkedFnaId: string;
  domain: FnaIntakeDomain;
  clientId: string;
  initialStep: number;
}

export const FNA_INTAKE_CONSENT_TEXT =
  'I understand this is not financial advice. Navigate Wealth will review my information and may publish a formal Financial Needs Analysis after adviser review.';

export async function getIntakeDraft(
  clientId: string,
  domain: FnaIntakeDomain,
): Promise<FnaIntakeSession | null> {
  const response = await api.get<{ success: boolean; data: FnaIntakeSession | null }>(
    `/fna-intake/${domain}/draft/${clientId}`,
  );
  return response.data ?? null;
}

export async function saveIntakeDraft(
  clientId: string,
  domain: FnaIntakeDomain,
  inputs: Record<string, unknown>,
): Promise<FnaIntakeSession> {
  const response = await api.put<{ success: boolean; data: FnaIntakeSession }>(
    `/fna-intake/${domain}/draft/${clientId}`,
    { inputs },
  );
  if (!response.data) throw new Error('Failed to save intake draft');
  return response.data;
}

export async function submitIntakeSession(
  sessionId: string,
): Promise<FnaIntakeSession> {
  const response = await api.post<{ success: boolean; data: FnaIntakeSession }>(
    `/fna-intake/session/${sessionId}/submit`,
    { consentAccepted: true },
  );
  if (!response.data) throw new Error('Failed to submit intake');
  return response.data;
}

export async function listSubmittedIntakes(): Promise<FnaIntakeSession[]> {
  const response = await api.get<{ success: boolean; data: FnaIntakeSession[] }>(
    '/fna-intake/queue/list',
  );
  return response.data ?? [];
}

export async function acceptIntakeSession(sessionId: string): Promise<AcceptIntakeResult> {
  const response = await api.post<{ success: boolean; data: AcceptIntakeResult }>(
    `/fna-intake/session/${sessionId}/accept`,
    {},
  );
  if (!response.data) throw new Error('Failed to accept intake');
  return response.data;
}

export async function requestIntakeMoreInfo(sessionId: string): Promise<FnaIntakeSession> {
  const response = await api.post<{ success: boolean; data: FnaIntakeSession }>(
    `/fna-intake/session/${sessionId}/request-info`,
    {},
  );
  if (!response.data) throw new Error('Failed to return intake to client');
  return response.data;
}
