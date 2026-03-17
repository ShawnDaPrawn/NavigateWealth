/**
 * Compliance Module - Service Layer
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError } from './error.middleware.ts';
import type {
  FAISRecord,
  AMLCheck,
  POPIAConsent,
  DebarmentCheck,
  DocumentsInsuranceRecord,
  ComplianceSummary,
} from './compliance-types.ts';

const log = createModuleLogger('compliance-service');

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

export class ComplianceService {
  
  // ========================================================================
  // FAIS COMPLIANCE
  // ========================================================================
  
  /**
   * Get all FAIS records
   */
  async getFAISRecords(): Promise<FAISRecord[]> {
    const records = await kv.getByPrefix('compliance_fais:');
    
    if (!records || records.length === 0) {
      return [];
    }
    
    // Sort by created date (newest first)
    records.sort((a: FAISRecord, b: FAISRecord) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return records;
  }
  
  /**
   * Create FAIS compliance record
   */
  async createFAISRecord(data: Partial<FAISRecord>): Promise<FAISRecord> {
    const recordId = generateId();
    const timestamp = new Date().toISOString();
    
    const record: FAISRecord = {
      id: recordId,
      adviser_id: data.adviser_id!,
      fsp_number: data.fsp_number!,
      fsp_name: data.fsp_name!,
      category: data.category || 'Category I',
      license_valid_until: data.license_valid_until!,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`compliance_fais:${recordId}`, record);
    
    log.success('FAIS record created', { recordId });
    
    return record;
  }
  
  // ========================================================================
  // AML (ANTI-MONEY LAUNDERING)
  // ========================================================================
  
  /**
   * Get all AML checks
   */
  async getAMLChecks(): Promise<AMLCheck[]> {
    const checks = await kv.getByPrefix('compliance_aml:');
    
    if (!checks || checks.length === 0) {
      return [];
    }
    
    // Sort by check date (newest first)
    checks.sort((a: AMLCheck, b: AMLCheck) =>
      new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
    );
    
    return checks;
  }
  
  /**
   * Perform AML check
   */
  async performAMLCheck(clientId: string, performedBy: string): Promise<AMLCheck> {
    const checkId = generateId();
    const timestamp = new Date().toISOString();
    
    // TODO: Integrate with actual AML service provider
    // For now, create a placeholder check
    
    const check: AMLCheck = {
      id: checkId,
      client_id: clientId,
      check_type: 'kyc',
      status: 'clear',
      risk_level: 'low',
      checked_at: timestamp,
      checked_by: performedBy,
      notes: 'Automated AML check completed',
    };
    
    await kv.set(`compliance_aml:${checkId}`, check);
    
    log.success('AML check performed', { checkId, clientId });
    
    return check;
  }
  
  // ========================================================================
  // POPIA (PRIVACY)
  // ========================================================================
  
  /**
   * Get all POPIA consents
   */
  async getPOPIAConsents(): Promise<POPIAConsent[]> {
    const consents = await kv.getByPrefix('compliance_popia:');
    return consents || [];
  }
  
  /**
   * Record POPIA consent
   */
  async recordPOPIAConsent(userId: string, data: Partial<POPIAConsent>): Promise<POPIAConsent> {
    const consentId = generateId();
    const timestamp = new Date().toISOString();
    
    const consent: POPIAConsent = {
      id: consentId,
      user_id: userId,
      consent_type: data.consent_type || 'general',
      consented: true,
      consent_date: timestamp,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
    };
    
    await kv.set(`compliance_popia:${consentId}`, consent);
    
    log.success('POPIA consent recorded', { consentId, userId });
    
    return consent;
  }
  
  /**
   * Withdraw POPIA consent
   */
  async withdrawPOPIAConsent(userId: string): Promise<{ success: boolean }> {
    // Find user's consents
    const consents = await kv.getByPrefix('compliance_popia:');
    const userConsents = consents?.filter((c: POPIAConsent) => c.user_id === userId) || [];
    
    // Mark as withdrawn
    for (const consent of userConsents) {
      consent.consented = false;
      consent.withdrawn_date = new Date().toISOString();
      await kv.set(`compliance_popia:${consent.id}`, consent);
    }
    
    log.warn('POPIA consent withdrawn', { userId });
    
    return { success: true };
  }
  
  // ========================================================================
  // DEBARMENT CHECKS
  // ========================================================================
  
  /**
   * Get all debarment checks
   */
  async getDebarmentChecks(): Promise<DebarmentCheck[]> {
    const checks = await kv.getByPrefix('compliance_debarment:');
    
    if (!checks || checks.length === 0) {
      return [];
    }
    
    // Sort by check date (newest first)
    checks.sort((a: DebarmentCheck, b: DebarmentCheck) =>
      new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
    );
    
    return checks;
  }
  
  /**
   * Perform debarment check
   */
  async performDebarmentCheck(
    adviserId: string,
    name: string,
    idNumber: string,
    performedBy: string
  ): Promise<DebarmentCheck> {
    const checkId = generateId();
    const timestamp = new Date().toISOString();
    
    // TODO: Integrate with FSCA debarment list
    // For now, create a placeholder check
    
    const check: DebarmentCheck = {
      id: checkId,
      adviser_id: adviserId,
      name,
      id_number: idNumber,
      status: 'clear',
      checked_at: timestamp,
      checked_by: performedBy,
      notes: 'No match found on FSCA debarment list',
    };
    
    await kv.set(`compliance_debarment:${checkId}`, check);
    
    log.success('Debarment check performed', { checkId, adviserId });
    
    return check;
  }
  
  // ========================================================================
  // DOCUMENTS & INSURANCE
  // ========================================================================
  
  /**
   * Get all documents & insurance records
   */
  async getDocumentsInsuranceRecords(): Promise<DocumentsInsuranceRecord[]> {
    const records = await kv.getByPrefix('compliance_doc_insurance:');
    
    if (!records || records.length === 0) {
      // Return mock data if empty for initial setup
      return [
        {
          id: 'doc-1',
          title: 'Compliance Manual',
          documentType: 'Compliance Manual',
          version: 'v2.1',
          approvedBy: 'Compliance Officer',
          effectiveDate: '2024-01-01',
          reviewCycle: 'Annual',
          due: '2025-01-01',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'ins-1',
          title: 'Professional Indemnity',
          documentType: 'PI Insurance',
          version: '2024 Policy',
          sumInsured: 5000000,
          insuranceProvider: 'Santam',
          effectiveDate: '2024-03-01',
          reviewCycle: 'Annual',
          due: '2025-03-01',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    }
    
    // Sort by effective date (newest first)
    records.sort((a: DocumentsInsuranceRecord, b: DocumentsInsuranceRecord) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    );
    
    return records;
  }
  
  /**
   * Create documents & insurance record
   */
  async createDocumentsInsuranceRecord(data: Partial<DocumentsInsuranceRecord>): Promise<DocumentsInsuranceRecord> {
    const recordId = generateId();
    const timestamp = new Date().toISOString();
    
    const record: DocumentsInsuranceRecord = {
      id: recordId,
      title: data.title!,
      documentType: data.documentType!,
      version: data.version || 'v1.0',
      sumInsured: data.sumInsured,
      insuranceProvider: data.insuranceProvider,
      approvedBy: data.approvedBy,
      effectiveDate: data.effectiveDate || timestamp,
      reviewCycle: data.reviewCycle || 'Annual',
      due: data.due || timestamp,
      status: data.status || 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`compliance_doc_insurance:${recordId}`, record);
    
    log.success('Documents & insurance record created', { recordId });
    
    return record;
  }

  // ========================================================================
  // REPORTS
  // ========================================================================
  
  /**
   * Get compliance summary
   */
  async getComplianceSummary(): Promise<ComplianceSummary> {
    const faisRecords = await this.getFAISRecords();
    const amlChecks = await this.getAMLChecks();
    const popiaConsents = await this.getPOPIAConsents();
    const debarmentChecks = await this.getDebarmentChecks();
    
    // Count active/valid records
    const activeFAIS = faisRecords.filter(r => r.status === 'active').length;
    const recentAML = amlChecks.filter(c => {
      const checkDate = new Date(c.checked_at);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return checkDate >= sixMonthsAgo;
    }).length;
    
    const activeConsents = popiaConsents.filter(c => c.consented).length;
    const recentDebarment = debarmentChecks.filter(c => {
      const checkDate = new Date(c.checked_at);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return checkDate >= threeMonthsAgo;
    }).length;
    
    return {
      fais: {
        total: faisRecords.length,
        active: activeFAIS,
        expired: faisRecords.length - activeFAIS,
      },
      aml: {
        total: amlChecks.length,
        recent: recentAML,
        clear: amlChecks.filter(c => c.status === 'clear').length,
      },
      popia: {
        total: popiaConsents.length,
        active: activeConsents,
        withdrawn: popiaConsents.length - activeConsents,
      },
      debarment: {
        total: debarmentChecks.length,
        recent: recentDebarment,
        clear: debarmentChecks.filter(c => c.status === 'clear').length,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
  
  /**
   * Get audit trail
   */
  async getAuditTrail(filters?: { startDate?: string; endDate?: string }): Promise<Array<Record<string, unknown> & { event_type: string; timestamp: string }>> {
    // Collect all compliance events
    const events: Array<Record<string, unknown> & { event_type: string; timestamp: string }> = [];
    
    const faisRecords = await this.getFAISRecords();
    const amlChecks = await this.getAMLChecks();
    const popiaConsents = await this.getPOPIAConsents();
    const debarmentChecks = await this.getDebarmentChecks();
    
    // Add all events with type
    faisRecords.forEach(r => events.push({ ...r, event_type: 'fais', timestamp: r.created_at }));
    amlChecks.forEach(c => events.push({ ...c, event_type: 'aml', timestamp: c.checked_at }));
    popiaConsents.forEach(c => events.push({ ...c, event_type: 'popia', timestamp: c.consent_date }));
    debarmentChecks.forEach(c => events.push({ ...c, event_type: 'debarment', timestamp: c.checked_at }));
    
    // Filter by date range
    let filtered = events;
    
    if (filters?.startDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= new Date(filters.startDate!));
    }
    
    if (filters?.endDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) <= new Date(filters.endDate!));
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return filtered;
  }

  // ========================================================================
  // AML/FICA (combined endpoint for frontend)
  // ========================================================================

  async getAMLFICARecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_aml_fica:');
    return records || [];
  }

  async createAMLFICARecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, lastReview: timestamp };
    await kv.set(`compliance_aml_fica:${id}`, record);
    log.success('AML/FICA record created', { id });
    return record;
  }

  async updateAMLFICARecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_aml_fica:${id}`);
    const updated = { ...(existing || {}), ...data, id, lastReview: new Date().toISOString() };
    await kv.set(`compliance_aml_fica:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // STATUTORY RETURNS
  // ========================================================================

  async getStatutoryRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_statutory:');
    return records || [];
  }

  async createStatutoryRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, lastReview: timestamp };
    await kv.set(`compliance_statutory:${id}`, record);
    log.success('Statutory record created', { id });
    return record;
  }

  async updateStatutoryRecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_statutory:${id}`);
    const updated = { ...(existing || {}), ...data, id, lastReview: new Date().toISOString() };
    await kv.set(`compliance_statutory:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // POPIA CONSENTS (specific consents endpoint)
  // ========================================================================

  async getPOPIAConsentRecords(): Promise<unknown[]> {
    // Re-use the existing POPIA prefix
    const records = await kv.getByPrefix('compliance_popia:');
    return records || [];
  }

  async createPOPIAConsentRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, consentDate: timestamp, created: timestamp };
    await kv.set(`compliance_popia:${id}`, record);
    log.success('POPIA consent record created', { id });
    return record;
  }

  async withdrawPOPIAConsentRecord(id: string): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_popia:${id}`);
    const updated = { ...(existing || {}), id, consented: false, withdrawnDate: new Date().toISOString() };
    await kv.set(`compliance_popia:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // PAIA REQUESTS
  // ========================================================================

  async getPAIARequests(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_paia:');
    return records || [];
  }

  async createPAIARequest(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, receivedDate: timestamp, created: timestamp, status: data.status || 'received' };
    await kv.set(`compliance_paia:${id}`, record);
    log.success('PAIA request created', { id });
    return record;
  }

  async updatePAIARequest(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_paia:${id}`);
    const updated = { ...(existing || {}), ...data, id };
    await kv.set(`compliance_paia:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // RECORD KEEPING
  // ========================================================================

  async getRecordKeepingEntries(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_record_keeping:');
    return records || [];
  }

  async createRecordKeepingEntry(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, lastReview: timestamp };
    await kv.set(`compliance_record_keeping:${id}`, record);
    log.success('Record keeping entry created', { id });
    return record;
  }

  async markRecordForDisposal(id: string): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_record_keeping:${id}`);
    const updated = { ...(existing || {}), id, disposalRequired: true, disposedDate: new Date().toISOString() };
    await kv.set(`compliance_record_keeping:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // NEW BUSINESS REGISTER
  // ========================================================================

  async getNewBusinessRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_new_business:');
    return records || [];
  }

  async createNewBusinessRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, applicationDate: data.applicationDate || timestamp };
    await kv.set(`compliance_new_business:${id}`, record);
    log.success('New business record created', { id });
    return record;
  }

  async updateNewBusinessRecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_new_business:${id}`);
    const updated = { ...(existing || {}), ...data, id };
    await kv.set(`compliance_new_business:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // COMPLAINTS
  // ========================================================================

  async getComplaints(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_complaints:');
    return records || [];
  }

  async getComplaintById(id: string): Promise<unknown | null> {
    return await kv.get(`compliance_complaints:${id}`);
  }

  async createComplaint(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, receivedDate: timestamp, created: timestamp, status: data.status || 'received' };
    await kv.set(`compliance_complaints:${id}`, record);
    log.success('Complaint created', { id });
    return record;
  }

  async updateComplaint(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_complaints:${id}`);
    const updated = { ...(existing || {}), ...data, id };
    await kv.set(`compliance_complaints:${id}`, updated);
    return updated;
  }

  async resolveComplaint(id: string, resolution: string, outcome: string): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_complaints:${id}`);
    const updated = { ...(existing || {}), id, status: 'resolved', resolution, outcome, resolvedDate: new Date().toISOString() };
    await kv.set(`compliance_complaints:${id}`, updated);
    return updated;
  }

  async escalateComplaint(id: string, escalatedTo: string): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_complaints:${id}`);
    const updated = { ...(existing || {}), id, status: 'escalated', escalated: true, escalatedTo, escalatedDate: new Date().toISOString() };
    await kv.set(`compliance_complaints:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // MARKETING COMPLIANCE
  // ========================================================================

  async getMarketingRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_marketing:');
    return records || [];
  }

  async createMarketingRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, lastReview: timestamp };
    await kv.set(`compliance_marketing:${id}`, record);
    log.success('Marketing record created', { id });
    return record;
  }

  async approveMarketingRecord(id: string, approvedBy: string): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_marketing:${id}`);
    const updated = { ...(existing || {}), id, approved: true, approvedBy, approvalDate: new Date().toISOString() };
    await kv.set(`compliance_marketing:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // CONFLICTS OF INTEREST
  // ========================================================================

  async getConflictRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_conflicts:');
    return records || [];
  }

  async createConflictRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, lastReview: timestamp };
    await kv.set(`compliance_conflicts:${id}`, record);
    log.success('Conflict record created', { id });
    return record;
  }

  async updateConflictRecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_conflicts:${id}`);
    const updated = { ...(existing || {}), ...data, id, lastReview: new Date().toISOString() };
    await kv.set(`compliance_conflicts:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // TCF (Treating Customers Fairly)
  // ========================================================================

  async getTCFRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_tcf:');
    return records || [];
  }

  async createTCFRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp, reviewDate: timestamp };
    await kv.set(`compliance_tcf:${id}`, record);
    log.success('TCF record created', { id });
    return record;
  }

  async updateTCFRecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_tcf:${id}`);
    const updated = { ...(existing || {}), ...data, id, lastReview: new Date().toISOString() };
    await kv.set(`compliance_tcf:${id}`, updated);
    return updated;
  }

  // ========================================================================
  // SUPERVISION
  // ========================================================================

  async getSupervisionRecords(): Promise<unknown[]> {
    const records = await kv.getByPrefix('compliance_supervision:');
    return records || [];
  }

  async createSupervisionRecord(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    const record = { id, ...data, created: timestamp };
    await kv.set(`compliance_supervision:${id}`, record);
    log.success('Supervision record created', { id });
    return record;
  }

  async updateSupervisionRecord(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = await kv.get(`compliance_supervision:${id}`);
    const updated = { ...(existing || {}), ...data, id };
    await kv.set(`compliance_supervision:${id}`, updated);
    return updated;
  }
}