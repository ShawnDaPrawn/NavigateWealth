/**
 * Compliance Module API
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized API layer for all compliance-related data operations.
 * Uses the shared API client for consistent error handling and authentication.
 */

import { api } from '../../../../utils/api/client';
import type {
  FAISRecord,
  AMLFICARecord,
  POPIAConsentRecord,
  PAIARequest,
  StatutoryRecord,
  TCFRecord,
  RecordKeepingEntry,
  DebarmentRecord,
  SupervisionRecord,
  ConflictRecord,
  MarketingRecord,
  DocumentsInsuranceRecord,
  NewBusinessRecord,
  ComplaintRecord,
  ComplianceActivity,
  ComplianceDeadline,
  ComplianceStats,
  ComplianceListResponse,
  CreateRecordRequest,
  UpdateRecordRequest,
} from './types';

// ============================================================================
// FAIS (Financial Advisory and Intermediary Services) API
// ============================================================================

export const faisApi = {
  /**
   * Get all FAIS records
   */
  async getAll(): Promise<FAISRecord[]> {
    const response = await api.get<ComplianceListResponse<FAISRecord>>('/compliance/fais');
    return response.data || [];
  },

  /**
   * Get single FAIS record by ID
   */
  async getById(id: string): Promise<FAISRecord> {
    return api.get<FAISRecord>(`/compliance/fais/${id}`);
  },

  /**
   * Create new FAIS record
   */
  async create(data: CreateRecordRequest<FAISRecord>): Promise<FAISRecord> {
    return api.post<FAISRecord>('/compliance/fais', data);
  },

  /**
   * Update existing FAIS record
   */
  async update(id: string, data: UpdateRecordRequest<FAISRecord>): Promise<FAISRecord> {
    return api.put<FAISRecord>(`/compliance/fais/${id}`, data);
  },

  /**
   * Delete FAIS record
   */
  async delete(id: string): Promise<void> {
    return api.delete(`/compliance/fais/${id}`);
  },

  /**
   * Get FAIS records by adviser
   */
  async getByAdviser(adviserId: string): Promise<FAISRecord[]> {
    const response = await api.get<ComplianceListResponse<FAISRecord>>(`/compliance/fais/adviser/${adviserId}`);
    return response.data || [];
  },
};

// ============================================================================
// AML/FICA (Anti-Money Laundering) API
// ============================================================================

export const amlFicaApi = {
  /**
   * Get all AML/FICA records
   */
  async getAll(): Promise<AMLFICARecord[]> {
    const response = await api.get<ComplianceListResponse<AMLFICARecord>>('/compliance/aml-fica');
    return response.data || [];
  },

  /**
   * Get AML/FICA record by ID
   */
  async getById(id: string): Promise<AMLFICARecord> {
    return api.get<AMLFICARecord>(`/compliance/aml-fica/${id}`);
  },

  /**
   * Create new AML/FICA check
   */
  async create(data: CreateRecordRequest<AMLFICARecord>): Promise<AMLFICARecord> {
    return api.post<AMLFICARecord>('/compliance/aml-fica', data);
  },

  /**
   * Update AML/FICA record
   */
  async update(id: string, data: UpdateRecordRequest<AMLFICARecord>): Promise<AMLFICARecord> {
    return api.put<AMLFICARecord>(`/compliance/aml-fica/${id}`, data);
  },

  /**
   * Get AML/FICA records for a client
   */
  async getByClient(clientId: string): Promise<AMLFICARecord[]> {
    const response = await api.get<ComplianceListResponse<AMLFICARecord>>(`/compliance/aml-fica/client/${clientId}`);
    return response.data || [];
  },

  /**
   * Run screening check for a client
   */
  async runScreening(clientId: string): Promise<AMLFICARecord> {
    return api.post<AMLFICARecord>(`/compliance/aml-fica/screen/${clientId}`, {});
  },
};

// ============================================================================
// POPI/PAIA (Data Protection) API
// ============================================================================

export const popiPaiaApi = {
  /**
   * Get all POPIA consent records
   */
  async getAllConsents(): Promise<POPIAConsentRecord[]> {
    const response = await api.get<ComplianceListResponse<POPIAConsentRecord>>('/compliance/popia/consents');
    return response.data || [];
  },

  /**
   * Record new consent
   */
  async recordConsent(data: CreateRecordRequest<POPIAConsentRecord>): Promise<POPIAConsentRecord> {
    return api.post<POPIAConsentRecord>('/compliance/popia/consents', data);
  },

  /**
   * Withdraw consent
   */
  async withdrawConsent(id: string): Promise<POPIAConsentRecord> {
    return api.post<POPIAConsentRecord>(`/compliance/popia/consents/${id}/withdraw`, {});
  },

  /**
   * Get consents by user
   */
  async getConsentsByUser(userId: string): Promise<POPIAConsentRecord[]> {
    const response = await api.get<ComplianceListResponse<POPIAConsentRecord>>(`/compliance/popia/consents/user/${userId}`);
    return response.data || [];
  },

  /**
   * Get all PAIA requests
   */
  async getAllPAIARequests(): Promise<PAIARequest[]> {
    const response = await api.get<ComplianceListResponse<PAIARequest>>('/compliance/paia/requests');
    return response.data || [];
  },

  /**
   * Create PAIA request
   */
  async createPAIARequest(data: CreateRecordRequest<PAIARequest>): Promise<PAIARequest> {
    return api.post<PAIARequest>('/compliance/paia/requests', data);
  },

  /**
   * Update PAIA request
   */
  async updatePAIARequest(id: string, data: UpdateRecordRequest<PAIARequest>): Promise<PAIARequest> {
    return api.put<PAIARequest>(`/compliance/paia/requests/${id}`, data);
  },
};

// ============================================================================
// STATUTORY RETURNS API
// ============================================================================

export const statutoryApi = {
  /**
   * Get all statutory records
   */
  async getAll(): Promise<StatutoryRecord[]> {
    const response = await api.get<ComplianceListResponse<StatutoryRecord>>('/compliance/statutory');
    return response.data || [];
  },

  /**
   * Get statutory record by ID
   */
  async getById(id: string): Promise<StatutoryRecord> {
    return api.get<StatutoryRecord>(`/compliance/statutory/${id}`);
  },

  /**
   * Create statutory record
   */
  async create(data: CreateRecordRequest<StatutoryRecord>): Promise<StatutoryRecord> {
    return api.post<StatutoryRecord>('/compliance/statutory', data);
  },

  /**
   * Update statutory record
   */
  async update(id: string, data: UpdateRecordRequest<StatutoryRecord>): Promise<StatutoryRecord> {
    return api.put<StatutoryRecord>(`/compliance/statutory/${id}`, data);
  },

  /**
   * Mark as submitted
   */
  async markAsSubmitted(id: string, submittedBy: string): Promise<StatutoryRecord> {
    return api.post<StatutoryRecord>(`/compliance/statutory/${id}/submit`, { submittedBy });
  },
};

// ============================================================================
// TCF (Treating Customers Fairly) API
// ============================================================================

export const tcfApi = {
  /**
   * Get all TCF records
   */
  async getAll(): Promise<TCFRecord[]> {
    const response = await api.get<ComplianceListResponse<TCFRecord>>('/compliance/tcf');
    return response.data || [];
  },

  /**
   * Create TCF assessment
   */
  async create(data: CreateRecordRequest<TCFRecord>): Promise<TCFRecord> {
    return api.post<TCFRecord>('/compliance/tcf', data);
  },

  /**
   * Update TCF assessment
   */
  async update(id: string, data: UpdateRecordRequest<TCFRecord>): Promise<TCFRecord> {
    return api.put<TCFRecord>(`/compliance/tcf/${id}`, data);
  },
};

// ============================================================================
// RECORD KEEPING API
// ============================================================================

export const recordKeepingApi = {
  /**
   * Get all record keeping entries
   */
  async getAll(): Promise<RecordKeepingEntry[]> {
    const response = await api.get<ComplianceListResponse<RecordKeepingEntry>>('/compliance/record-keeping');
    return response.data || [];
  },

  /**
   * Create record keeping entry
   */
  async create(data: CreateRecordRequest<RecordKeepingEntry>): Promise<RecordKeepingEntry> {
    return api.post<RecordKeepingEntry>('/compliance/record-keeping', data);
  },

  /**
   * Mark for disposal
   */
  async markForDisposal(id: string): Promise<RecordKeepingEntry> {
    return api.post<RecordKeepingEntry>(`/compliance/record-keeping/${id}/dispose`, {});
  },
};

// ============================================================================
// DEBARMENT & SUPERVISION API
// ============================================================================

export const debarmentSupervisionApi = {
  /**
   * Get all debarment records
   */
  async getAllDebarments(): Promise<DebarmentRecord[]> {
    const response = await api.get<ComplianceListResponse<DebarmentRecord>>('/compliance/debarment');
    return response.data || [];
  },

  /**
   * Run debarment check
   */
  async runCheck(adviserId: string): Promise<DebarmentRecord> {
    return api.post<DebarmentRecord>(`/compliance/debarment/check/${adviserId}`, {});
  },

  /**
   * Get all supervision records
   */
  async getAllSupervision(): Promise<SupervisionRecord[]> {
    const response = await api.get<ComplianceListResponse<SupervisionRecord>>('/compliance/supervision');
    return response.data || [];
  },

  /**
   * Create supervision record
   */
  async createSupervision(data: CreateRecordRequest<SupervisionRecord>): Promise<SupervisionRecord> {
    return api.post<SupervisionRecord>('/compliance/supervision', data);
  },

  /**
   * Update supervision record
   */
  async updateSupervision(id: string, data: UpdateRecordRequest<SupervisionRecord>): Promise<SupervisionRecord> {
    return api.put<SupervisionRecord>(`/compliance/supervision/${id}`, data);
  },
};

// ============================================================================
// CONFLICTS & MARKETING API
// ============================================================================

export const conflictsMarketingApi = {
  /**
   * Get all conflict records
   */
  async getAllConflicts(): Promise<ConflictRecord[]> {
    const response = await api.get<ComplianceListResponse<ConflictRecord>>('/compliance/conflicts');
    return response.data || [];
  },

  /**
   * Create conflict record
   */
  async createConflict(data: CreateRecordRequest<ConflictRecord>): Promise<ConflictRecord> {
    return api.post<ConflictRecord>('/compliance/conflicts', data);
  },

  /**
   * Update conflict record
   */
  async updateConflict(id: string, data: UpdateRecordRequest<ConflictRecord>): Promise<ConflictRecord> {
    return api.put<ConflictRecord>(`/compliance/conflicts/${id}`, data);
  },

  /**
   * Get all marketing records
   */
  async getAllMarketing(): Promise<MarketingRecord[]> {
    const response = await api.get<ComplianceListResponse<MarketingRecord>>('/compliance/marketing');
    return response.data || [];
  },

  /**
   * Create marketing record
   */
  async createMarketing(data: CreateRecordRequest<MarketingRecord>): Promise<MarketingRecord> {
    return api.post<MarketingRecord>('/compliance/marketing', data);
  },

  /**
   * Approve marketing material
   */
  async approveMarketing(id: string, approvedBy: string): Promise<MarketingRecord> {
    return api.post<MarketingRecord>(`/compliance/marketing/${id}/approve`, { approvedBy });
  },
};

// ============================================================================
// DOCUMENTS & INSURANCE API
// ============================================================================

export const documentsInsuranceApi = {
  /**
   * Get all documents & insurance records
   */
  async getAll(): Promise<DocumentsInsuranceRecord[]> {
    const response = await api.get<ComplianceListResponse<DocumentsInsuranceRecord>>('/compliance/documents-insurance');
    return response.data || [];
  },

  /**
   * Create documents & insurance record
   */
  async create(data: CreateRecordRequest<DocumentsInsuranceRecord>): Promise<DocumentsInsuranceRecord> {
    return api.post<DocumentsInsuranceRecord>('/compliance/documents-insurance', data);
  },

  /**
   * Update documents & insurance record
   */
  async update(id: string, data: UpdateRecordRequest<DocumentsInsuranceRecord>): Promise<DocumentsInsuranceRecord> {
    return api.put<DocumentsInsuranceRecord>(`/compliance/documents-insurance/${id}`, data);
  },

  /**
   * Mark as renewed
   */
  async markAsRenewed(id: string): Promise<DocumentsInsuranceRecord> {
    return api.post<DocumentsInsuranceRecord>(`/compliance/documents-insurance/${id}/renew`, {});
  },
};

// ============================================================================
// NEW BUSINESS REGISTER API
// ============================================================================

export const newBusinessApi = {
  /**
   * Get all new business records
   */
  async getAll(): Promise<NewBusinessRecord[]> {
    const response = await api.get<ComplianceListResponse<NewBusinessRecord>>('/compliance/new-business');
    return response.data || [];
  },

  /**
   * Create new business record
   */
  async create(data: CreateRecordRequest<NewBusinessRecord>): Promise<NewBusinessRecord> {
    return api.post<NewBusinessRecord>('/compliance/new-business', data);
  },

  /**
   * Update new business record
   */
  async update(id: string, data: UpdateRecordRequest<NewBusinessRecord>): Promise<NewBusinessRecord> {
    return api.put<NewBusinessRecord>(`/compliance/new-business/${id}`, data);
  },

  /**
   * Get records by client
   */
  async getByClient(clientId: string): Promise<NewBusinessRecord[]> {
    const response = await api.get<ComplianceListResponse<NewBusinessRecord>>(`/compliance/new-business/client/${clientId}`);
    return response.data || [];
  },
};

// ============================================================================
// COMPLAINTS API
// ============================================================================

export const complaintsApi = {
  /**
   * Get all complaints
   */
  async getAll(): Promise<ComplaintRecord[]> {
    const response = await api.get<ComplianceListResponse<ComplaintRecord>>('/compliance/complaints');
    return response.data || [];
  },

  /**
   * Get complaint by ID
   */
  async getById(id: string): Promise<ComplaintRecord> {
    return api.get<ComplaintRecord>(`/compliance/complaints/${id}`);
  },

  /**
   * Create complaint
   */
  async create(data: CreateRecordRequest<ComplaintRecord>): Promise<ComplaintRecord> {
    return api.post<ComplaintRecord>('/compliance/complaints', data);
  },

  /**
   * Update complaint
   */
  async update(id: string, data: UpdateRecordRequest<ComplaintRecord>): Promise<ComplaintRecord> {
    return api.put<ComplaintRecord>(`/compliance/complaints/${id}`, data);
  },

  /**
   * Resolve complaint
   */
  async resolve(id: string, resolution: string, outcome: string): Promise<ComplaintRecord> {
    return api.post<ComplaintRecord>(`/compliance/complaints/${id}/resolve`, { resolution, outcome });
  },

  /**
   * Escalate complaint
   */
  async escalate(id: string, escalatedTo: string): Promise<ComplaintRecord> {
    return api.post<ComplaintRecord>(`/compliance/complaints/${id}/escalate`, { escalatedTo });
  },
};

// ============================================================================
// OVERVIEW & STATISTICS API
// ============================================================================

export const complianceOverviewApi = {
  /**
   * Get recent compliance activities
   */
  async getRecentActivities(limit: number = 20): Promise<ComplianceActivity[]> {
    const response = await api.get<ComplianceListResponse<ComplianceActivity>>(`/compliance/activities?limit=${limit}`);
    return response.data || [];
  },

  /**
   * Get upcoming deadlines
   */
  async getUpcomingDeadlines(days: number = 30): Promise<ComplianceDeadline[]> {
    const response = await api.get<ComplianceListResponse<ComplianceDeadline>>(`/compliance/deadlines?days=${days}`);
    return response.data || [];
  },

  /**
   * Get compliance statistics
   */
  async getStats(): Promise<ComplianceStats> {
    const stats = await api.get<ComplianceStats>('/compliance/stats');
    return stats;
  },

  /**
   * Refresh all compliance checks
   */
  async refreshAll(): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/compliance/refresh', {});
  },
};

// ============================================================================
// LEGACY SUPPORT (backward compatibility)
// ============================================================================

/**
 * Legacy API object for backward compatibility
 */
export const complianceApi = {
  getFAISRecords: faisApi.getAll,
  getStatutoryRecords: statutoryApi.getAll,
  getDocumentsInsuranceRecords: documentsInsuranceApi.getAll,
  getRecentActivities: complianceOverviewApi.getRecentActivities,
  getUpcomingDeadlines: complianceOverviewApi.getUpcomingDeadlines,
  getComplianceStats: complianceOverviewApi.getStats,
  createFAISRecord: faisApi.create,
  updateFAISRecord: faisApi.update,
};
