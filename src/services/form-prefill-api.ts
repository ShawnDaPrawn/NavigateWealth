/**
 * Form Prefill API — client-side service for the unified prefill resolver.
 */

import { api } from '../utils/api';
import type {
  FormPrefillId,
  FormTemplateRecord,
  PrefillApplyAuditRequest,
  PrefillResolveRequest,
  PrefillResolveResponse,
  TemplatePrefillResolveResponse,
} from '../shared/form-prefill/types';

export async function listPrefillForms(): Promise<FormPrefillId[]> {
  const response = await api.get<{ success: boolean; data: FormPrefillId[] }>('/prefill/forms');
  return response.data;
}

export async function resolveFormPrefill(
  request: PrefillResolveRequest,
): Promise<PrefillResolveResponse> {
  const response = await api.post<{ success: boolean; data: PrefillResolveResponse }>(
    '/prefill/resolve',
    request,
  );
  return response.data;
}

export async function logPrefillAudit(request: PrefillApplyAuditRequest): Promise<void> {
  await api.post('/prefill/apply-audit', request);
}

export interface PrefillAuditRecord {
  timestamp?: string;
  formId?: string;
  appliedFields?: string[];
  adminUserId?: string;
  resolverVersion?: string;
  clientId?: string;
}

export async function fetchPrefillAudit(
  clientId: string,
  limit = 50,
): Promise<PrefillAuditRecord[]> {
  const response = await api.get<{ success: boolean; data: PrefillAuditRecord[] }>(
    `/prefill/audit/${encodeURIComponent(clientId)}?limit=${limit}`,
  );
  return response.data;
}

export async function normalizeIntakeInputs(
  domain: string,
  inputs: Record<string, unknown>,
  clientId?: string,
): Promise<{ wizardInputs: Record<string, unknown>; prefill?: PrefillResolveResponse }> {
  const response = await api.post<{
    success: boolean;
    data: { wizardInputs: Record<string, unknown>; prefill?: PrefillResolveResponse };
  }>('/prefill/normalize-intake', { domain, inputs, clientId });
  return response.data;
}

export async function listFormTemplates(): Promise<FormTemplateRecord[]> {
  const response = await api.get<{ success: boolean; data: FormTemplateRecord[] }>(
    '/form-templates',
  );
  return response.data;
}

export async function uploadFormTemplate(payload: {
  name: string;
  description?: string;
  fileName: string;
  mimeType: string;
  base64Content: string;
}): Promise<FormTemplateRecord> {
  const response = await api.post<{ success: boolean; data: FormTemplateRecord }>(
    '/form-templates',
    payload,
  );
  return response.data;
}

export async function updateTemplateMappings(
  templateId: string,
  fields: FormTemplateRecord['fields'],
  status?: FormTemplateRecord['status'],
): Promise<FormTemplateRecord> {
  const response = await api.put<{ success: boolean; data: FormTemplateRecord }>(
    `/form-templates/${templateId}/mappings`,
    { fields, status },
  );
  return response.data;
}

export async function fillFormTemplate(
  templateId: string,
  clientId: string,
  options?: { attachToDocuments?: boolean },
): Promise<{
  filledBase64: string;
  filledFields: string[];
  unresolvedFields: string[];
  fileName: string;
  attachedDocument?: { documentId: string; filePath: string };
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      filledBase64: string;
      filledFields: string[];
      unresolvedFields: string[];
      fileName: string;
      attachedDocument?: { documentId: string; filePath: string };
    };
  }>(`/form-templates/${templateId}/fill`, {
    clientId,
    attachToDocuments: options?.attachToDocuments ?? false,
  });
  return response.data;
}

export async function previewTemplatePrefill(
  templateId: string,
  clientId: string,
): Promise<TemplatePrefillResolveResponse> {
  const response = await api.post<{ success: boolean; data: TemplatePrefillResolveResponse }>(
    `/form-templates/${templateId}/preview`,
    { clientId },
  );
  return response.data;
}
