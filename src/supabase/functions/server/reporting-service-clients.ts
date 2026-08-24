/**
 * Client reports: personal book, growth, retention, demographics, and the personal-clients export.
 * One slice of the reporting service — the ReportingService facade in
 * reporting-service.ts binds these as its methods.
 */
/**
 * Reporting Service
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  ReportPeriod,
  KvReportClient,
  ClientGrowthReport,
  ClientRetentionReport,
  ClientDemographicsReport,
} from './reporting-types.ts';

import { getReportingSupabaseClient } from './reporting-service-helpers.ts';

const log = createModuleLogger('reporting-service');

/**
 * Get Personal Clients report
 */
export async function getPersonalClientsReport(): Promise<Record<string, unknown>[]> {
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
        Title: info.title || '',
        'First Name': info.firstName || '',
        'Middle Name': info.middleName || '',
        Surname: info.lastName || '',
        'ID Number': info.idNumber || '',
        'Date of Birth': info.dateOfBirth || '',
        Gender: info.gender || '',
        Nationality: info.nationality || '',
        'Marital Status': info.maritalStatus || '',
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
export async function getPersonalClientsExport(): Promise<Record<string, unknown>[]> {
  log.info('Generating Personal Clients spreadsheet export');

  const supabase = getReportingSupabaseClient();

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
    const meta = (p._applicationMeta || {}) as Record<string, unknown>;

    // Flatten employers array into first employer
    const employer = (
      Array.isArray(p.employers) && p.employers.length > 0 ? p.employers[0] : {}
    ) as Record<string, unknown>;

    // Flatten family members into spouse
    const spouse = (
      Array.isArray(p.familyMembers) && p.familyMembers.length > 0
        ? p.familyMembers.find((f: Record<string, unknown>) => f.relationship === 'Spouse') || {}
        : {}
    ) as Record<string, unknown>;

    // Flatten identity documents into first doc
    const idDoc = (
      Array.isArray(p.identityDocuments) && p.identityDocuments.length > 0
        ? p.identityDocuments[0]
        : {}
    ) as Record<string, unknown>;

    return {
      'User ID': userId,
      Title: p.title || '',
      'First Name': p.firstName || '',
      'Middle Name': p.middleName || '',
      'Last Name': p.lastName || '',
      'Preferred Name': p.preferredName || '',
      'Date of Birth': p.dateOfBirth || '',
      Gender: p.gender || '',
      Nationality: p.nationality || '',
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
      Email: p.email || '',
      'Secondary Email': p.secondaryEmail || '',
      Phone: p.phoneNumber || '',
      'Alternative Phone': p.alternativePhone || '',
      'Preferred Contact Method': p.preferredContactMethod || '',

      // Residential Address
      'Address Line 1': p.residentialAddressLine1 || '',
      'Address Line 2': p.residentialAddressLine2 || '',
      Suburb: p.residentialSuburb || '',
      City: p.residentialCity || '',
      Province: p.residentialProvince || '',
      'Postal Code': p.residentialPostalCode || '',
      Country: p.residentialCountry || '',

      // Employment
      'Employment Status': p.employmentStatus || '',
      'Job Title': employer.jobTitle || '',
      Employer: employer.employerName || '',
      Industry: employer.industry || '',
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
      Smoker: p.smokerStatus ? 'Yes' : 'No',
      'Has Chronic Conditions': p.hasChronicConditions ? 'Yes' : 'No',
      'Blood Type': p.bloodType || '',

      // Application Meta
      'SA Tax Resident':
        meta.isSATaxResident === true ? 'Yes' : meta.isSATaxResident === false ? 'No' : '',
      'Number of Dependants': meta.numberOfDependants || '',
      'Gross Income Range': meta.grossMonthlyIncomeRange || '',
      'Monthly Expenses Range': meta.monthlyExpensesRange || '',
      'Services Requested': Array.isArray(meta.servicesRequested)
        ? meta.servicesRequested.join('; ')
        : '',
      Urgency: meta.urgency || '',
      'Existing Products': Array.isArray(meta.existingProducts)
        ? meta.existingProducts.join('; ')
        : '',
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
export async function getClientGrowthReport(period: ReportPeriod): Promise<ClientGrowthReport> {
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

  const data = Object.entries(grouped)
    .map(([period, count]) => ({
      period,
      count,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    data,
    total: clients.length,
  };
}

/**
 * Get client retention report
 */
export async function getClientRetentionReport(): Promise<ClientRetentionReport> {
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
export async function getClientDemographicsReport(): Promise<ClientDemographicsReport> {
  log.info('Generating client demographics report');

  const clients = await kv.getByPrefix('user_profile:');

  if (!clients || clients.length === 0) {
    return { total: 0, byAccountType: [] };
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
