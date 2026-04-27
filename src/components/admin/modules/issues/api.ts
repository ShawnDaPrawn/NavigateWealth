import { api } from '../../../../utils/api/client';
import type { QualityIssueSnapshot } from './types';

export async function fetchQualityIssuesSnapshot(): Promise<QualityIssueSnapshot> {
  const response = await api.get<{ success: boolean; snapshot: QualityIssueSnapshot }>('/quality-issues');
  return response.snapshot;
}
