/**
 * Compliance and client-lifecycle audit exports, plus the custom-report and export stubs.
 * One slice of the reporting service — the ReportingService facade in
 * reporting-service.ts binds these as its methods.
 */
/**
 * Reporting Service
 * Fresh file moved to root to fix bundling issues
 */

import { createModuleLogger } from './stderr-logger.ts';
import type {
  CustomReportConfig,
  CustomReportResult,
  ExportConfig,
  ExportReportResult,
  ComplianceAuditRow,
  ClientLifecycleAuditRow,
} from './reporting-types.ts';

import { getReportingSupabaseClient } from './reporting-service-helpers.ts';

const log = createModuleLogger('reporting-service');

/**
 * Export POPIA/FAIS compliance audit data as flat rows for spreadsheet download.
 * Queries all personal_info profile entries, extracts _applicationMeta consent fields,
 * and cross-references security entries for account status.
 */
export async function getComplianceAuditExport(): Promise<ComplianceAuditRow[]> {
  log.info('Generating POPIA/FAIS Compliance Audit spreadsheet export');

  const supabase = getReportingSupabaseClient();

  // Fetch profiles and security entries in parallel for belt-and-suspenders checking
  const [profileResult, securityResult] = await Promise.all([
    supabase
      .from('kv_store_91ed8379')
      .select('key, value')
      .like('key', 'user_profile:%:personal_info'),
    supabase.from('kv_store_91ed8379').select('key, value').like('key', 'security:%'),
  ]);

  if (profileResult.error) {
    log.error('Failed to query profiles for compliance audit', {
      error: profileResult.error.message,
    });
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

    const accountStatus =
      isDeleted || profileStatus === 'closed'
        ? 'Closed'
        : isSuspended || profileStatus === 'suspended'
          ? 'Suspended'
          : 'Active';

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

    const compliantCount = consentChecks.filter((c) => c.value).length;
    const totalChecks = consentChecks.length;
    const complianceScore = `${compliantCount}/${totalChecks}`;

    const nonCompliantItems = consentChecks
      .filter((c) => !c.value)
      .map((c) => c.name)
      .join('; ');

    const createdAt = (p.createdAt || p.created_at || '') as string;

    return {
      'User ID': userId,
      'Client Name': clientName,
      Email: (p.email || '') as string,
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
export async function getClientLifecycleAuditExport(): Promise<ClientLifecycleAuditRow[]> {
  log.info('Generating Client Lifecycle Audit spreadsheet export');

  const supabase = getReportingSupabaseClient();

  // Fetch profiles and security entries in parallel
  const [profileResult, securityResult] = await Promise.all([
    supabase
      .from('kv_store_91ed8379')
      .select('key, value')
      .like('key', 'user_profile:%:personal_info'),
    supabase.from('kv_store_91ed8379').select('key, value').like('key', 'security:%'),
  ]);

  if (profileResult.error) {
    log.error('Failed to query profiles for lifecycle audit', {
      error: profileResult.error.message,
    });
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

    const firstName = profile ? ((profile.firstName || '') as string) : '';
    const lastName = profile ? ((profile.lastName || '') as string) : '';
    const clientName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
    const email = profile ? ((profile.email || '') as string) : '';
    const createdAt = profile ? ((profile.createdAt || profile.created_at || '') as string) : '';

    const profileStatus = profile ? ((profile.accountStatus || 'active') as string) : 'N/A';
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
      recommendedAction =
        'Investigate whether this user was partially deleted or never fully onboarded';
    } else if (profile && !security) {
      // Missing security entry — profile exists without security guard
      issueType = 'Missing Security';
      severity = 'High';
      details =
        'Profile exists but no security entry found — downstream guards cannot enforce lifecycle state';
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
        recommendedAction =
          'Set security.deleted=true and security.suspended=true to match profile status';
      } else if (normProfileStatus === 'suspended' && !secSuspended) {
        issueType = 'Status Mismatch';
        severity = 'Medium';
        details = `Profile.accountStatus='suspended' but security.suspended=false — lifecycle state is ambiguous`;
        recommendedAction = 'Set security.suspended=true to match profile status';
      }
    }

    rows.push({
      'User ID': userId,
      'Client Name': clientName,
      Email: email,
      'Profile Account Status': profileStatus,
      'Security Deleted': security ? (secDeleted ? 'Yes' : 'No') : 'N/A',
      'Security Suspended': security ? (secSuspended ? 'Yes' : 'No') : 'N/A',
      'Derived Status': derivedStatus,
      'Issue Type': issueType,
      Severity: severity,
      Details: details,
      'Recommended Action': recommendedAction,
      'Profile Created': createdAt ? new Date(createdAt).toLocaleDateString('en-ZA') : '',
    });
  }

  // Sort: Critical first, then High, Medium, None
  const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, None: 3 };
  rows.sort((a, b) => (severityOrder[a['Severity']] ?? 4) - (severityOrder[b['Severity']] ?? 4));

  return rows;
}

// ========================================================================
// CUSTOM REPORTS (placeholder)
// ========================================================================

/**
 * Generate custom report
 */
export async function generateCustomReport(
  config: CustomReportConfig,
): Promise<CustomReportResult> {
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
export async function exportReport(config: ExportConfig): Promise<ExportReportResult> {
  log.info('Exporting report', { format: config.format });

  // TODO: Implement export to CSV, PDF, Excel

  return {
    format: config.format,
    url: null,
    message: 'Export functionality coming soon',
  };
}
