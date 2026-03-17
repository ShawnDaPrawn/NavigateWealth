/**
 * Reporting Service
 * Fresh file moved to root to fix bundling issues
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  DashboardReport,
  KeyStats,
  DateRange,
  ReportPeriod,
  RevenueReport,
  AUMReport,
  KvReportTask,
  KvReportClient,
  KvReportApplication,
  KvReportFna,
  ClientGrowthReport,
  ClientRetentionReport,
  ClientDemographicsReport,
  ApplicationsReport,
  FNAReport,
  CustomReportConfig,
  CustomReportResult,
  ExportConfig,
  ExportReportResult,
  ApplicationsPipelineRow,
  FNACompletionRow,
  ComplianceAuditRow,
  ClientLifecycleAuditRow,
} from './reporting-types.ts';

const log = createModuleLogger('reporting-service');

export class ReportingService {
  
  private getSupabaseClient() {
    return createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  // ========================================================================
  // DASHBOARD REPORTS
  // ========================================================================
  
  /**
   * Get dashboard overview
   */
  async getDashboardReport(): Promise<DashboardReport> {
    log.info('Generating dashboard report');
    
    // Get all data sources
    const clients = await kv.getByPrefix('user_profile:');
    const applications = await kv.getByPrefix('application:');
    const fnas = await kv.getByPrefix('fna:');
    const communications = await kv.getByPrefix('communication_history:');

    // Get tasks from Supabase DB
    const supabase = this.getSupabaseClient();
    const { data: tasksData } = await supabase.from('tasks_91ed8379').select('*');
    const tasks = tasksData || [];
    
    // Calculate metrics
    const totalClients = clients?.length || 0;
    const totalApplications = applications?.length || 0;
    const totalFNAs = fnas?.length || 0;
    const totalCommunications = communications?.length || 0;

    // Calculate Task Metrics
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const lastMonthDate = new Date();
    lastMonthDate.setDate(lastMonthDate.getDate() - 30);
    const lastMonthStr = lastMonthDate.toISOString().split('T')[0];
    
    const tasksDueToday = tasks.filter((t: KvReportTask) => {
      // Check if due_date matches today and task is not completed/archived
      if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
      return t.due_date.startsWith(todayStr);
    }).length;
    
    const tasksDueLastMonth = tasks.filter((t: KvReportTask) => {
      if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
      return t.due_date.startsWith(lastMonthStr);
    }).length;
    
    const tasksGrowth = tasksDueLastMonth > 0 
      ? ((tasksDueToday - tasksDueLastMonth) / tasksDueLastMonth) * 100
      : (tasksDueToday > 0 ? 100 : 0);
      
    const totalTasks = tasks.filter((t: KvReportTask) => t.status !== 'archived').length;
    const completedTasks = tasks.filter((t: KvReportTask) => t.status === 'completed').length;
    
    // Calculate growth (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);
    
    const recentClients = clients?.filter((c: KvReportClient) => 
      new Date(c.createdAt || c.created_at || '') >= thirtyDaysAgo
    ).length || 0;
    
    const previousClientsCount = totalClients - recentClients;
    const clientGrowth = previousClientsCount > 0 
      ? (recentClients / previousClientsCount) * 100 
      : (recentClients > 0 ? 100 : 0);
    
    const recentApplications = applications?.filter((a: KvReportApplication) =>
      new Date(a.created_at || a.createdAt || '') >= thirtyDaysAgo
    ).length || 0;

    // Calculate New Applications Growth (volume comparison vs previous 30 days)
    const previousPeriodApplications = applications?.filter((a: KvReportApplication) => {
      const date = new Date(a.created_at || a.createdAt || '');
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length || 0;

    const recentApplicationsGrowth = previousPeriodApplications > 0
      ? ((recentApplications - previousPeriodApplications) / previousPeriodApplications) * 100
      : (recentApplications > 0 ? 100 : 0);
    
    const previousApplicationsCount = totalApplications - recentApplications;
    const applicationGrowth = previousApplicationsCount > 0
      ? (recentApplications / previousApplicationsCount) * 100
      : (recentApplications > 0 ? 100 : 0);
    
    return {
      clients: {
        total: totalClients,
        recent: recentClients,
        growth: clientGrowth,
      },
      applications: {
        total: totalApplications,
        recent: recentApplications,
        growth: applicationGrowth,
        recentGrowth: recentApplicationsGrowth,
        pending: applications?.filter((a: KvReportApplication) => a.status === 'pending').length || 0,
        approved: applications?.filter((a: KvReportApplication) => a.status === 'approved').length || 0,
      },
      fnas: {
        total: totalFNAs,
        published: fnas?.filter((f: KvReportFna) => f.status === 'published').length || 0,
        draft: fnas?.filter((f: KvReportFna) => f.status === 'draft').length || 0,
      },
      tasks: {
        total: totalTasks,
        dueToday: tasksDueToday,
        dueTodayGrowth: tasksGrowth,
        completed: completedTasks,
      },
      activity: {
        communications: totalCommunications,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
  
  /**
   * Get key statistics
   */
  async getKeyStats(): Promise<KeyStats> {
    const dashboard = await this.getDashboardReport();
    
    return {
      totalClients: dashboard.clients.total,
      totalApplications: dashboard.applications.total,
      totalFNAs: dashboard.fnas.total,
      clientGrowth: dashboard.clients.growth,
      applicationApprovalRate: dashboard.applications.total > 0
        ? (dashboard.applications.approved / dashboard.applications.total) * 100
        : 0,
    };
  }
  
  // ========================================================================
  // FINANCIAL REPORTS
  // ========================================================================
  
  /**
   * Get revenue report
   */
  async getRevenueReport(dateRange?: DateRange): Promise<RevenueReport> {
    log.info('Generating revenue report', { dateRange });
    
    // TODO: Implement actual revenue tracking
    // For now, return placeholder data
    
    return {
      total: 0,
      currency: 'ZAR',
      period: dateRange,
      breakdown: {
        commissions: 0,
        fees: 0,
        recurring: 0,
      },
    };
  }
  
  /**
   * Get Assets Under Management (AUM) report
   */
  async getAUMReport(): Promise<AUMReport> {
    log.info('Generating AUM report');
    
    // TODO: Calculate from client portfolios
    
    return {
      total: 0,
      currency: 'ZAR',
      breakdown: {
        equities: 0,
        bonds: 0,
        cash: 0,
        alternatives: 0,
      },
    };
  }
  
  /**
   * Get commissions report
   */
  async getCommissionsReport(dateRange?: DateRange): Promise<RevenueReport> {
    log.info('Generating commissions report', { dateRange });
    
    return {
      total: 0,
      currency: 'ZAR',
      period: dateRange,
      byProduct: [],
      byAdviser: [],
    };
  }
  
  /**
   * Get Personal Clients report
   */
  async getPersonalClientsReport(): Promise<Record<string, unknown>[]> {
    log.info('Generating Personal Clients report');
    
    // Get all profiles
    const profiles = await kv.getByPrefix('user_profile:');
    
    if (!profiles || profiles.length === 0) {
      return [];
    }
    
    // Filter for personal clients and map to report format
    return profiles
      .filter((profile: KvReportClient) => !profile.accountType || profile.accountType === 'personal')
      .map((profile: KvReportClient) => {
        const info = (profile.personalInformation || {}) as Record<string, unknown>;
        
        return {
          'Client ID': profile.userId || 'Unknown',
          'Title': info.title || '',
          'First Name': info.firstName || '',
          'Middle Name': info.middleName || '',
          'Surname': info.lastName || '',
          'ID Number': info.idNumber || '',
          'Date of Birth': info.dateOfBirth || '',
          'Gender': info.gender || '',
          'Nationality': info.nationality || '',
          'Marital Status': info.maritalStatus || ''
        };
      });
  }

  /**
   * Export all personal client profiles as flat rows for spreadsheet download.
   * Queries KV directly (with keys) so we can extract the userId from the key pattern
   * `user_profile:{userId}:personal_info`.
   *
   * Returns one flat object per client with every profile field as a column.
   */
  async getPersonalClientsExport(): Promise<Record<string, unknown>[]> {
    log.info('Generating Personal Clients spreadsheet export');

    const supabase = this.getSupabaseClient();

    // Query all personal_info profile entries with their keys
    const { data, error } = await supabase
      .from('kv_store_91ed8379')
      .select('key, value')
      .like('key', 'user_profile:%:personal_info');

    if (error) {
      log.error('Failed to query client profiles for export', { error: error.message });
      throw new Error(`Failed to fetch client profiles: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: { key: string; value: Record<string, unknown> }) => {
      // Extract userId from key: user_profile:{userId}:personal_info
      const keyParts = row.key.split(':');
      const userId = keyParts.length >= 3 ? keyParts.slice(1, -1).join(':') : 'Unknown';
      const p = row.value || {};

      // Application meta sub-object
      const meta = p._applicationMeta || {};

      // Flatten employers array into first employer
      const employer = Array.isArray(p.employers) && p.employers.length > 0 ? p.employers[0] : {};

      // Flatten family members into spouse
      const spouse = Array.isArray(p.familyMembers) && p.familyMembers.length > 0
        ? p.familyMembers.find((f: Record<string, unknown>) => f.relationship === 'Spouse') || {}
        : {};

      // Flatten identity documents into first doc
      const idDoc = Array.isArray(p.identityDocuments) && p.identityDocuments.length > 0
        ? p.identityDocuments[0]
        : {};

      return {
        'User ID': userId,
        'Title': p.title || '',
        'First Name': p.firstName || '',
        'Middle Name': p.middleName || '',
        'Last Name': p.lastName || '',
        'Preferred Name': p.preferredName || '',
        'Date of Birth': p.dateOfBirth || '',
        'Gender': p.gender || '',
        'Nationality': p.nationality || '',
        'Marital Status': p.maritalStatus || '',
        'Marital Regime': p.maritalRegime || '',

        // Identity
        'ID Number': p.idNumber || '',
        'Passport Number': p.passportNumber || '',
        'Tax Number': p.taxNumber || '',
        'ID Doc Type': idDoc.type || '',
        'ID Doc Number': idDoc.number || '',
        'ID Doc Country': idDoc.countryOfIssue || '',
        'ID Verified': idDoc.isVerified ? 'Yes' : 'No',

        // Contact
        'Email': p.email || '',
        'Secondary Email': p.secondaryEmail || '',
        'Phone': p.phoneNumber || '',
        'Alternative Phone': p.alternativePhone || '',
        'Preferred Contact Method': p.preferredContactMethod || '',

        // Residential Address
        'Address Line 1': p.residentialAddressLine1 || '',
        'Address Line 2': p.residentialAddressLine2 || '',
        'Suburb': p.residentialSuburb || '',
        'City': p.residentialCity || '',
        'Province': p.residentialProvince || '',
        'Postal Code': p.residentialPostalCode || '',
        'Country': p.residentialCountry || '',

        // Employment
        'Employment Status': p.employmentStatus || '',
        'Job Title': employer.jobTitle || '',
        'Employer': employer.employerName || '',
        'Industry': employer.industry || '',
        'Self-Employed Company': p.selfEmployedCompanyName || '',
        'Self-Employed Industry': p.selfEmployedIndustry || '',
        'Self-Employed Description': p.selfEmployedDescription || '',

        // Financial
        'Gross Monthly Income': p.grossMonthlyIncome || 0,
        'Net Monthly Income': p.netMonthlyIncome || 0,
        'Gross Annual Income': p.grossAnnualIncome || 0,
        'Net Annual Income': p.netAnnualIncome || 0,

        // Spouse / Family
        'Spouse Name': spouse.fullName || '',
        'Spouse DOB': spouse.dateOfBirth || '',
        'Spouse Notes': spouse.notes || '',

        // Emergency Contact
        'Emergency Contact': p.emergencyContactName || '',
        'Emergency Contact Relationship': p.emergencyContactRelationship || '',
        'Emergency Contact Phone': p.emergencyContactPhone || '',

        // Health
        'Smoker': p.smokerStatus ? 'Yes' : 'No',
        'Has Chronic Conditions': p.hasChronicConditions ? 'Yes' : 'No',
        'Blood Type': p.bloodType || '',

        // Application Meta
        'SA Tax Resident': meta.isSATaxResident === true ? 'Yes' : meta.isSATaxResident === false ? 'No' : '',
        'Number of Dependants': meta.numberOfDependants || '',
        'Gross Income Range': meta.grossMonthlyIncomeRange || '',
        'Monthly Expenses Range': meta.monthlyExpensesRange || '',
        'Services Requested': Array.isArray(meta.servicesRequested) ? meta.servicesRequested.join('; ') : '',
        'Urgency': meta.urgency || '',
        'Existing Products': Array.isArray(meta.existingProducts) ? meta.existingProducts.join('; ') : '',
        'Financial Goals': meta.financialGoals || '',
        'Best Time to Contact': meta.bestTimeToContact || '',
        'WhatsApp Number': meta.whatsappNumber || '',
        'POPIA Consent': meta.popiaConsent ? 'Yes' : 'No',
        'FAIS Acknowledged': meta.faisAcknowledged ? 'Yes' : 'No',
        'Electronic Comms Consent': meta.electronicCommunicationConsent ? 'Yes' : 'No',
        'Marketing Consent': meta.communicationConsent ? 'Yes' : 'No',
      };
    });
  }

  // ========================================================================
  // CLIENT REPORTS
  // ========================================================================
  
  /**
   * Get client growth report
   */
  async getClientGrowthReport(period: ReportPeriod): Promise<ClientGrowthReport> {
    log.info('Generating client growth report', { period });
    
    const clients = await kv.getByPrefix('user_profile:');
    
    if (!clients || clients.length === 0) {
      return { data: [], total: 0 };
    }
    
    // Group by period
    const grouped: Record<string, number> = {};
    
    clients.forEach((client: KvReportClient) => {
      const date = new Date(client.createdAt || client.created_at || '');
      let key: string;
      
      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = String(date.getFullYear());
      }
      
      grouped[key] = (grouped[key] || 0) + 1;
    });
    
    const data = Object.entries(grouped).map(([period, count]) => ({
      period,
      count,
    })).sort((a, b) => a.period.localeCompare(b.period));
    
    return {
      data,
      total: clients.length,
    };
  }
  
  /**
   * Get client retention report
   */
  async getClientRetentionReport(): Promise<ClientRetentionReport> {
    log.info('Generating client retention report');
    
    const clients = await kv.getByPrefix('user_profile:');
    
    // TODO: Calculate actual retention metrics
    // For now, return basic stats
    
    return {
      totalClients: clients?.length || 0,
      activeClients: clients?.filter((c: KvReportClient) => !c.inactive).length || 0,
      retentionRate: 0,
    };
  }
  
  /**
   * Get client demographics report
   */
  async getClientDemographicsReport(): Promise<ClientDemographicsReport> {
    log.info('Generating client demographics report');
    
    const clients = await kv.getByPrefix('user_profile:');
    
    if (!clients || clients.length === 0) {
      return { total: 0, byAge: [], byAccountType: [] };
    }
    
    // Group by account type
    const byAccountType: Record<string, number> = {};
    
    clients.forEach((client: KvReportClient) => {
      const type = client.accountType || 'personal';
      byAccountType[type] = (byAccountType[type] || 0) + 1;
    });
    
    return {
      total: clients.length,
      byAccountType: Object.entries(byAccountType).map(([type, count]) => ({
        type,
        count,
        percentage: (count / clients.length) * 100,
      })),
    };
  }
  
  // ========================================================================
  // ACTIVITY REPORTS
  // ========================================================================
  
  /**
   * Get applications report
   */
  async getApplicationsReport(dateRange?: DateRange): Promise<ApplicationsReport> {
    log.info('Generating applications report', { dateRange });
    
    const applications = await kv.getByPrefix('application:');
    
    if (!applications || applications.length === 0) {
      return { total: 0, byStatus: [] };
    }
    
    // Filter by date range if provided
    let filtered = applications;
    
    if (dateRange?.startDate) {
      filtered = filtered.filter((a: KvReportApplication) =>
        new Date(a.created_at || a.createdAt || '') >= new Date(dateRange.startDate!)
      );
    }
    
    if (dateRange?.endDate) {
      filtered = filtered.filter((a: KvReportApplication) =>
        new Date(a.created_at || a.createdAt || '') <= new Date(dateRange.endDate!)
      );
    }
    
    // Group by status
    const byStatus: Record<string, number> = {};
    
    filtered.forEach((app: KvReportApplication) => {
      const status = app.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    return {
      total: filtered.length,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({
        status,
        count,
        percentage: (count / filtered.length) * 100,
      })),
    };
  }
  
  /**
   * Get FNA report
   */
  async getFNAReport(dateRange?: DateRange): Promise<FNAReport> {
    log.info('Generating FNA report', { dateRange });
    
    const fnas = await kv.getByPrefix('fna:');
    
    if (!fnas || fnas.length === 0) {
      return { total: 0, byType: [], byStatus: [] };
    }
    
    // Group by type and status
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    fnas.forEach((fna: KvReportFna) => {
      const type = fna.type || 'unknown';
      const status = fna.status || 'unknown';
      
      byType[type] = (byType[type] || 0) + 1;
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    return {
      total: fnas.length,
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    };
  }
  
  // ========================================================================
  // CUSTOM REPORTS
  // ========================================================================

  // ========================================================================
  // EXPORT REPORTS (Spreadsheet Downloads)
  // ========================================================================

  /**
   * Export applications pipeline data as flat rows for spreadsheet download.
   * Queries all application: KV entries with their keys and flattens to tabular format.
   */
  async getApplicationsPipelineExport(dateRange?: DateRange): Promise<ApplicationsPipelineRow[]> {
    log.info('Generating Applications Pipeline spreadsheet export', { dateRange });

    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from('kv_store_91ed8379')
      .select('key, value')
      .like('key', 'application:%');

    if (error) {
      log.error('Failed to query applications for pipeline export', { error: error.message });
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const now = new Date();
    const startFilter = dateRange?.startDate ? new Date(dateRange.startDate) : null;
    const endFilter = dateRange?.endDate ? new Date(dateRange.endDate + 'T23:59:59') : null;

    const rows: ApplicationsPipelineRow[] = [];

    for (const row of data) {
      const keyParts = row.key.split(':');
      const applicationId = keyParts.length >= 2 ? keyParts.slice(1).join(':') : 'Unknown';
      const a = row.value || {};

      // Extract personal info if embedded
      const personal = (a.personalInformation || a.personal || {}) as Record<string, unknown>;
      const meta = (a._applicationMeta || a.meta || {}) as Record<string, unknown>;

      const firstName = (personal.firstName || a.firstName || '') as string;
      const lastName = (personal.lastName || a.lastName || '') as string;
      const applicantName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

      const submittedDate = (a.created_at || a.createdAt || a.submittedAt || '') as string;

      // Apply date range filter if provided
      if (submittedDate && (startFilter || endFilter)) {
        const submitted = new Date(submittedDate);
        if (startFilter && submitted < startFilter) continue;
        if (endFilter && submitted > endFilter) continue;
      }

      const updatedDate = (a.updated_at || a.updatedAt || '') as string;

      // Calculate days since submission
      let daysSinceSubmission = 0;
      if (submittedDate) {
        const submitted = new Date(submittedDate);
        daysSinceSubmission = Math.floor((now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24));
      }

      const status = (a.status || 'unknown') as string;
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

      const servicesRequested = Array.isArray(meta.servicesRequested)
        ? (meta.servicesRequested as string[]).join('; ')
        : (meta.servicesRequested as string || '');

      rows.push({
        'Application ID': applicationId,
        'Applicant Name': applicantName,
        'Email': (personal.email || a.email || '') as string,
        'Phone': (personal.phoneNumber || personal.phone || a.phone || '') as string,
        'Status': statusLabel,
        'Services Requested': servicesRequested,
        'Urgency': (meta.urgency || a.urgency || '') as string,
        'Submitted Date': submittedDate ? new Date(submittedDate).toLocaleDateString('en-ZA') : '',
        'Last Updated': updatedDate ? new Date(updatedDate).toLocaleDateString('en-ZA') : '',
        'Days Since Submission': daysSinceSubmission,
      });
    }

    return rows;
  }

  /**
   * Export FNA completion data as flat rows for spreadsheet download.
   * Queries all fna: KV entries and flattens to tabular format.
   */
  async getFNACompletionExport(dateRange?: DateRange): Promise<FNACompletionRow[]> {
    log.info('Generating FNA Completion spreadsheet export', { dateRange });

    const supabase = this.getSupabaseClient();

    const { data, error } = await supabase
      .from('kv_store_91ed8379')
      .select('key, value')
      .like('key', 'fna:%');

    if (error) {
      log.error('Failed to query FNAs for completion export', { error: error.message });
      throw new Error(`Failed to fetch FNAs: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const startFilter = dateRange?.startDate ? new Date(dateRange.startDate) : null;
    const endFilter = dateRange?.endDate ? new Date(dateRange.endDate + 'T23:59:59') : null;

    // FNA type label mapping
    const FNA_TYPE_LABELS: Record<string, string> = {
      'risk': 'Risk Planning',
      'risk-planning': 'Risk Planning',
      'medical': 'Medical Aid',
      'medical-aid': 'Medical Aid',
      'retirement': 'Retirement Planning',
      'retirement-planning': 'Retirement Planning',
      'estate': 'Estate Planning',
      'estate-planning': 'Estate Planning',
      'tax': 'Tax Planning',
      'tax-planning': 'Tax Planning',
      'investment': 'Investment Analysis',
      'investment-ina': 'Investment Analysis',
    };

    const rows: FNACompletionRow[] = [];

    for (const row of data) {
      const keyParts = row.key.split(':');
      const fnaId = keyParts.length >= 2 ? keyParts.slice(1).join(':') : 'Unknown';
      const f = row.value || {};

      const fnaType = (f.type || f.fnaType || 'unknown') as string;
      const typeLabel = FNA_TYPE_LABELS[fnaType] || fnaType.charAt(0).toUpperCase() + fnaType.slice(1);

      const status = (f.status || 'unknown') as string;
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

      const createdDate = (f.createdAt || f.created_at || '') as string;

      // Apply date range filter if provided
      if (createdDate && (startFilter || endFilter)) {
        const created = new Date(createdDate);
        if (startFilter && created < startFilter) continue;
        if (endFilter && created > endFilter) continue;
      }

      const updatedDate = (f.updatedAt || f.updated_at || '') as string;
      const publishedDate = (f.publishedAt || f.published_at || '') as string;

      // Calculate days to complete (created → published, or created → now if still in progress)
      let daysToComplete: number | string = '';
      if (createdDate) {
        const created = new Date(createdDate);
        if (publishedDate) {
          const published = new Date(publishedDate);
          daysToComplete = Math.floor((published.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        } else if (status !== 'published') {
          const now = new Date();
          daysToComplete = `${Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))} (in progress)`;
        }
      }

      rows.push({
        'FNA ID': fnaId,
        'Type': typeLabel,
        'Status': statusLabel,
        'Client ID': (f.clientId || f.client_id || '') as string,
        'Client Name': (f.clientName || f.client_name || '') as string,
        'Adviser': (f.adviserName || f.adviser_name || f.adviserId || '') as string,
        'Created Date': createdDate ? new Date(createdDate).toLocaleDateString('en-ZA') : '',
        'Last Updated': updatedDate ? new Date(updatedDate).toLocaleDateString('en-ZA') : '',
        'Published Date': publishedDate ? new Date(publishedDate).toLocaleDateString('en-ZA') : '',
        'Days to Complete': daysToComplete,
      });
    }

    return rows;
  }

  /**
   * Export POPIA/FAIS compliance audit data as flat rows for spreadsheet download.
   * Queries all personal_info profile entries, extracts _applicationMeta consent fields,
   * and cross-references security entries for account status.
   */
  async getComplianceAuditExport(): Promise<ComplianceAuditRow[]> {
    log.info('Generating POPIA/FAIS Compliance Audit spreadsheet export');

    const supabase = this.getSupabaseClient();

    // Fetch profiles and security entries in parallel for belt-and-suspenders checking
    const [profileResult, securityResult] = await Promise.all([
      supabase
        .from('kv_store_91ed8379')
        .select('key, value')
        .like('key', 'user_profile:%:personal_info'),
      supabase
        .from('kv_store_91ed8379')
        .select('key, value')
        .like('key', 'security:%'),
    ]);

    if (profileResult.error) {
      log.error('Failed to query profiles for compliance audit', { error: profileResult.error.message });
      throw new Error(`Failed to fetch profiles: ${profileResult.error.message}`);
    }

    if (!profileResult.data || profileResult.data.length === 0) {
      return [];
    }

    // Build security lookup map: userId → security record
    const securityMap = new Map<string, Record<string, unknown>>();
    if (securityResult.data) {
      for (const row of securityResult.data) {
        // Key pattern: security:{userId}
        const userId = row.key.replace('security:', '');
        securityMap.set(userId, row.value || {});
      }
    }

    return profileResult.data.map((row: { key: string; value: Record<string, unknown> }) => {
      // Extract userId from key: user_profile:{userId}:personal_info
      const keyParts = row.key.split(':');
      const userId = keyParts.length >= 3 ? keyParts.slice(1, -1).join(':') : 'Unknown';
      const p = row.value || {};
      const meta = (p._applicationMeta || {}) as Record<string, unknown>;
      const security = securityMap.get(userId) || {};

      // Derive account status (two-layer guard per §12.3)
      const profileStatus = (p.accountStatus || 'active') as string;
      const isDeleted = security.deleted === true;
      const isSuspended = security.suspended === true;

      let accountStatus = profileStatus;
      if (isDeleted || profileStatus === 'closed') {
        accountStatus = 'Closed';
      } else if (isSuspended || profileStatus === 'suspended') {
        accountStatus = 'Suspended';
      } else {
        accountStatus = 'Active';
      }

      const firstName = (p.firstName || '') as string;
      const lastName = (p.lastName || '') as string;
      const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

      // Consent flags
      const popiaConsent = meta.popiaConsent === true;
      const faisAcknowledged = meta.faisAcknowledged === true;
      const electronicCommsConsent = meta.electronicCommunicationConsent === true;
      const marketingConsent = meta.communicationConsent === true;

      // Calculate compliance score
      const consentChecks = [
        { name: 'POPIA Consent', value: popiaConsent },
        { name: 'FAIS Acknowledgement', value: faisAcknowledged },
        { name: 'Electronic Communications', value: electronicCommsConsent },
        { name: 'Marketing Consent', value: marketingConsent },
      ];

      const compliantCount = consentChecks.filter(c => c.value).length;
      const totalChecks = consentChecks.length;
      const complianceScore = `${compliantCount}/${totalChecks}`;

      const nonCompliantItems = consentChecks
        .filter(c => !c.value)
        .map(c => c.name)
        .join('; ');

      const createdAt = (p.createdAt || p.created_at || '') as string;

      return {
        'User ID': userId,
        'Client Name': clientName,
        'Email': (p.email || '') as string,
        'Account Status': accountStatus,
        'POPIA Consent': popiaConsent ? 'Yes' : 'No',
        'FAIS Acknowledged': faisAcknowledged ? 'Yes' : 'No',
        'Electronic Comms Consent': electronicCommsConsent ? 'Yes' : 'No',
        'Marketing Consent': marketingConsent ? 'Yes' : 'No',
        'Compliance Score': complianceScore,
        'Non-Compliant Items': nonCompliantItems || 'None',
        'Profile Created': createdAt ? new Date(createdAt).toLocaleDateString('en-ZA') : '',
      };
    });
  }

  /**
   * Export client lifecycle audit data as flat rows for spreadsheet download.
   * Cross-references user_profile:*:personal_info and security:* KV entries
   * to surface status inconsistencies per §12.3 downstream guards.
   *
   * Issue types:
   *   CONSISTENT       – profile and security agree
   *   STATUS_MISMATCH  – profile.accountStatus contradicts security flags
   *   MISSING_SECURITY – profile exists but no security entry found
   *   ORPHANED_SECURITY– security entry exists but no matching profile
   */
  async getClientLifecycleAuditExport(): Promise<ClientLifecycleAuditRow[]> {
    log.info('Generating Client Lifecycle Audit spreadsheet export');

    const supabase = this.getSupabaseClient();

    // Fetch profiles and security entries in parallel
    const [profileResult, securityResult] = await Promise.all([
      supabase
        .from('kv_store_91ed8379')
        .select('key, value')
        .like('key', 'user_profile:%:personal_info'),
      supabase
        .from('kv_store_91ed8379')
        .select('key, value')
        .like('key', 'security:%'),
    ]);

    if (profileResult.error) {
      log.error('Failed to query profiles for lifecycle audit', { error: profileResult.error.message });
      throw new Error(`Failed to fetch profiles: ${profileResult.error.message}`);
    }

    // Build maps: userId → record
    const profileMap = new Map<string, Record<string, unknown>>();
    if (profileResult.data) {
      for (const row of profileResult.data) {
        // Key: user_profile:{userId}:personal_info
        const parts = row.key.split(':');
        const userId = parts.length >= 3 ? parts.slice(1, -1).join(':') : row.key;
        profileMap.set(userId, row.value || {});
      }
    }

    const securityMap = new Map<string, Record<string, unknown>>();
    if (securityResult.data) {
      for (const row of securityResult.data) {
        const userId = row.key.replace('security:', '');
        securityMap.set(userId, row.value || {});
      }
    }

    // Collect all unique user IDs from both maps
    const allUserIds = new Set([...profileMap.keys(), ...securityMap.keys()]);

    const rows: ClientLifecycleAuditRow[] = [];

    for (const userId of allUserIds) {
      const profile = profileMap.get(userId);
      const security = securityMap.get(userId);

      const firstName = profile ? (profile.firstName || '') as string : '';
      const lastName = profile ? (profile.lastName || '') as string : '';
      const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
      const email = profile ? (profile.email || '') as string : '';
      const createdAt = profile ? (profile.createdAt || profile.created_at || '') as string : '';

      const profileStatus = profile ? (profile.accountStatus || 'active') as string : 'N/A';
      const secDeleted = security ? security.deleted === true : false;
      const secSuspended = security ? security.suspended === true : false;

      // Derive the "correct" status from security flags (authoritative source)
      let derivedStatus: string;
      if (secDeleted) {
        derivedStatus = 'Closed';
      } else if (secSuspended) {
        derivedStatus = 'Suspended';
      } else {
        derivedStatus = 'Active';
      }

      // Determine issue type and details
      let issueType = 'Consistent';
      let severity = 'None';
      let details = 'Profile and security entries are aligned';
      let recommendedAction = 'No action required';

      if (!profile && security) {
        // Orphaned security entry — no matching profile
        issueType = 'Orphaned Security';
        severity = 'Medium';
        details = 'Security entry exists but no corresponding profile was found';
        recommendedAction = 'Investigate whether this user was partially deleted or never fully onboarded';
      } else if (profile && !security) {
        // Missing security entry — profile exists without security guard
        issueType = 'Missing Security';
        severity = 'High';
        details = 'Profile exists but no security entry found — downstream guards cannot enforce lifecycle state';
        recommendedAction = 'Create a security entry for this user with appropriate flags';
      } else if (profile && security) {
        // Both exist — check for mismatches
        const normProfileStatus = profileStatus.toLowerCase();

        // Mismatch: security says deleted but profile doesn't say closed
        if (secDeleted && normProfileStatus !== 'closed') {
          issueType = 'Status Mismatch';
          severity = 'Critical';
          details = `Security entry has deleted=true but profile.accountStatus='${profileStatus}' (expected 'closed')`;
          recommendedAction = "Update profile.accountStatus to 'closed' to match security flags";
        }
        // Mismatch: security says suspended but profile doesn't reflect it
        else if (secSuspended && !secDeleted && normProfileStatus !== 'suspended') {
          issueType = 'Status Mismatch';
          severity = 'High';
          details = `Security entry has suspended=true but profile.accountStatus='${profileStatus}' (expected 'suspended')`;
          recommendedAction = "Update profile.accountStatus to 'suspended' to match security flags";
        }
        // Mismatch: profile says closed/suspended but security flags don't agree
        else if (normProfileStatus === 'closed' && !secDeleted) {
          issueType = 'Status Mismatch';
          severity = 'High';
          details = `Profile.accountStatus='closed' but security.deleted=false — client may still receive communications`;
          recommendedAction = 'Set security.deleted=true and security.suspended=true to match profile status';
        }
        else if (normProfileStatus === 'suspended' && !secSuspended) {
          issueType = 'Status Mismatch';
          severity = 'Medium';
          details = `Profile.accountStatus='suspended' but security.suspended=false — lifecycle state is ambiguous`;
          recommendedAction = 'Set security.suspended=true to match profile status';
        }
      }

      rows.push({
        'User ID': userId,
        'Client Name': clientName,
        'Email': email,
        'Profile Account Status': profileStatus,
        'Security Deleted': security ? (secDeleted ? 'Yes' : 'No') : 'N/A',
        'Security Suspended': security ? (secSuspended ? 'Yes' : 'No') : 'N/A',
        'Derived Status': derivedStatus,
        'Issue Type': issueType,
        'Severity': severity,
        'Details': details,
        'Recommended Action': recommendedAction,
        'Profile Created': createdAt ? new Date(createdAt).toLocaleDateString('en-ZA') : '',
      });
    }

    // Sort: Critical first, then High, Medium, None
    const severityOrder: Record<string, number> = { 'Critical': 0, 'High': 1, 'Medium': 2, 'None': 3 };
    rows.sort((a, b) => (severityOrder[a['Severity']] ?? 4) - (severityOrder[b['Severity']] ?? 4));

    return rows;
  }

  // ========================================================================
  // CUSTOM REPORTS (placeholder)
  // ========================================================================

  /**
   * Generate custom report
   */
  async generateCustomReport(config: CustomReportConfig): Promise<CustomReportResult> {
    log.info('Generating custom report', { config });
    
    // TODO: Implement custom report generator
    
    return {
      type: config.type,
      data: [],
      generatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Export report
   */
  async exportReport(config: ExportConfig): Promise<ExportReportResult> {
    log.info('Exporting report', { format: config.format });
    
    // TODO: Implement export to CSV, PDF, Excel
    
    return {
      format: config.format,
      url: null,
      message: 'Export functionality coming soon',
    };
  }
}