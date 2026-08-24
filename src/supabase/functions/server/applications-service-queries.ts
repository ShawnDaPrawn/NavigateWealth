/**
 * Application listing, detail lookup, and statistics.
 * One slice of the admin applications service — the AdminApplicationsService
 * facade in applications-service.ts binds these as its static methods.
 */
import * as kv from './kv_store.tsx';
import type {
  ApplicationStats,
  ApplicationListResponse,
  ApplicationDetailResponse,
  EnrichedApplication,
  DetailedApplication,
} from './types.ts';
import { ERROR_MESSAGES } from './constants.ts';

import { createModuleLogger } from './stderr-logger.ts';
import type { KvApplication, KvTask, KvRequest, KvEsignEnvelope } from './applications-types.ts';
import {
  isRootApplicationRecord,
  excludeApplicationsForDeletedClients,
  createServiceClient,
  isValidUUID,
} from './applications-service-helpers.ts';

const log = createModuleLogger('admin-applications-service');

/**
 * Get all applications with filtering and sorting
 */
export async function getApplications(
  status?: string,
  sortBy: string = 'created_at',
  sortOrder: string = 'desc',
): Promise<ApplicationListResponse> {
  const allApplications = await kv.getByPrefix('application:');

  if (!allApplications || allApplications.length === 0) {
    return { applications: [], total: 0 };
  }

  // Filter deprecated, root documents only (same as getStats — excludes step KV rows)
  let applications = allApplications
    .filter((app: KvApplication) => app.deprecated !== true)
    .filter(isRootApplicationRecord);

  applications = await excludeApplicationsForDeletedClients(applications, true);

  // Filter by status
  if (status) {
    applications = applications.filter((app: KvApplication) => app.status === status);
  }

  // Sort
  applications.sort((a: KvApplication, b: KvApplication) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'created_at':
        aVal = new Date(a.created_at || 0).getTime();
        bVal = new Date(b.created_at || 0).getTime();
        break;
      case 'updated_at':
        aVal = new Date(a.updated_at || 0).getTime();
        bVal = new Date(b.updated_at || 0).getTime();
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      default:
        aVal = new Date(a.created_at || 0).getTime();
        bVal = new Date(b.created_at || 0).getTime();
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : aVal < bVal ? 1 : -1;
  });

  const supabase = createServiceClient();

  // Enrich with user data
  const enrichedApplications = await Promise.all(
    applications.map(async (app: KvApplication) => {
      // Common fields included in all enrichment paths
      const baseFields = {
        id: app.id,
        user_id: app.user_id,
        status: app.status,
        created_at: app.created_at,
        updated_at: app.updated_at,
        submitted_at: app.submitted_at || null,
        reviewed_at: app.reviewed_at || null,
        reviewed_by: app.reviewed_by || null,
        review_notes: app.review_notes || null,
        application_number: app.application_number || null,
        origin: app.origin || null,
        onboarded_by: app.onboarded_by || null,
        application_data: app.application_data || {},
      };

      try {
        const pi = app.application_data?.personalInfo as Record<string, unknown> | undefined;
        const piName = `${String(pi?.firstName ?? '')} ${String(pi?.lastName ?? '')}`.trim();
        if (!app.user_id || !isValidUUID(app.user_id)) {
          return {
            ...baseFields,
            user_email: null,
            user_name: piName || 'Unknown',
          };
        }

        const { data, error: authError } = await supabase.auth.admin.getUserById(app.user_id);

        if (authError || !data?.user) {
          return {
            ...baseFields,
            user_email: null,
            user_name: piName || 'Unknown',
          };
        }

        const user = data.user;
        return {
          ...baseFields,
          user_email: user?.email || null,
          user_name: (user?.user_metadata?.name as string) || piName || null,
        };
      } catch (_error) {
        const pi = app.application_data?.personalInfo as Record<string, unknown> | undefined;
        const piName = `${String(pi?.firstName ?? '')} ${String(pi?.lastName ?? '')}`.trim();
        return {
          ...baseFields,
          user_email: null,
          user_name: piName || 'Unknown',
        };
      }
    }),
  );

  return {
    applications: enrichedApplications as unknown as EnrichedApplication[],
    total: enrichedApplications.length,
  };
}

/**
 * Get single application details
 */
export async function getApplicationById(
  applicationId: string,
): Promise<ApplicationDetailResponse> {
  const application = await kv.get(`application:${applicationId}`);

  if (!application) {
    throw new Error(ERROR_MESSAGES.APPLICATION.NOT_FOUND);
  }

  const supabase = createServiceClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.admin.getUserById(application.user_id);

    const detailedApplication = {
      id: application.id,
      user_id: application.user_id,
      status: application.status,
      created_at: application.created_at,
      updated_at: application.updated_at,
      reviewed_at: application.reviewed_at || null,
      reviewed_by: application.reviewed_by || null,
      review_notes: application.review_notes || null,
      application_data: application.application_data || {},
      user_email: user?.email || null,
      user_name: (() => {
        const pi = application.application_data?.personalInfo as
          | Record<string, unknown>
          | undefined;
        const piName = `${String(pi?.firstName ?? '')} ${String(pi?.lastName ?? '')}`.trim();
        return (user?.user_metadata?.name as string) || piName || null;
      })(),
      user_metadata: user?.user_metadata || {},
    };

    return { application: detailedApplication as unknown as DetailedApplication };
  } catch (_error) {
    return {
      application: {
        ...application,
        user_email: null,
        user_name: null,
        user_metadata: {},
      } as unknown as DetailedApplication,
    };
  }
}

/**
 * Get application statistics
 */
export async function getStats(): Promise<ApplicationStats> {
  // Wrap entire method in top-level try/catch so a crash here never
  // kills the Edge Function response
  let applications: KvApplication[] = [];
  try {
    const raw = ((await kv.getByPrefix('application:')) || []) as KvApplication[];
    // Exclude deprecated applications and per-step KV rows (not root application documents)
    applications = raw
      .filter((a: KvApplication) => a.deprecated !== true)
      .filter(isRootApplicationRecord);
    applications = await excludeApplicationsForDeletedClients(applications, false);
  } catch (kvError) {
    log.error('getStats: Failed to fetch applications from KV', kvError as Error);
    // Return safe defaults so the endpoint still responds
  }

  const draftCount = applications.filter((a) => a.status === 'draft').length;
  const inProgressCount = applications.filter((a) => a.status === 'in_progress').length;
  // incomplete = draft + in_progress (same as filtering for either status)
  const incompleteCount = draftCount + inProgressCount;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Calculate monthly stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const newThisMonth = applications.filter((a: KvApplication) => {
    const d = new Date(a.created_at);
    return d >= startOfMonth;
  }).length;

  const newLastMonth = applications.filter((a: KvApplication) => {
    const d = new Date(a.created_at);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  }).length;

  const taskStats = { new_tasks: 0, pending_tasks: 0 };
  try {
    // Tasks are stored in KV store (not a Postgres table)
    const kvTasks = (await kv.getByPrefix('task:')) as KvTask[];
    if (Array.isArray(kvTasks)) {
      taskStats.new_tasks = kvTasks.filter((t) => t && t.status === 'new').length;
      taskStats.pending_tasks = kvTasks.filter(
        (t) => t && (t.status === 'new' || t.status === 'in_progress'),
      ).length;
    }
  } catch (taskError) {
    log.error('getStats: Failed to fetch task stats', taskError as Error);
  }

  // Client count MUST match Client Management (same eligibility as ClientsService.getAllClients)
  let activeUsers: number;

  try {
    const { ClientsService } = await import('./client-management-service.ts');
    const allEligible = await new ClientsService().getAllClients();
    activeUsers = allEligible.length;
  } catch (criticalError) {
    log.error(
      'getStats: ClientsService eligible count failed; falling back to application user IDs',
      criticalError as Error,
    );
    const uniqueUserIds = new Set(applications.map((a) => a.user_id).filter(Boolean));
    activeUsers = uniqueUserIds.size;
  }

  let pendingRequests = 0;
  let totalRequests = 0;
  let pendingEsignatures = 0;
  try {
    // Get request stats
    const requests = (await kv.getByPrefix('requests:request:')) as KvRequest[];
    if (requests) {
      totalRequests = requests.length;
      pendingRequests = requests.filter(
        (r) =>
          r.status === 'New' ||
          r.status === 'In Compliance Review' ||
          r.status === 'In Lifecycle' ||
          r.status === 'In Sign-Off',
      ).length;
    }

    // Get pending e-signatures
    const esignItems = (await kv.getByPrefix('esign:envelope:')) as KvEsignEnvelope[];
    pendingEsignatures = esignItems
      ? esignItems.filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            item.status &&
            (item.status === 'sent' || item.status === 'in_progress'),
        ).length
      : 0;
  } catch (requestError) {
    log.error('getStats: Failed to fetch request/esign stats', requestError as Error);
  }

  return {
    total: applications.length,
    submitted_for_review: applications.filter(
      (a) => a.status === 'submitted' || a.status === ('pending' as string),
    ).length,
    approved: applications.filter((a) => a.status === 'approved').length,
    declined: applications.filter((a) => a.status === 'declined').length,
    application_in_progress: inProgressCount,
    invited: applications.filter((a) => a.status === 'invited').length,
    draft: draftCount,
    incomplete: incompleteCount,
    no_application: 0,
    new_applications_7d: applications.filter(
      (a) => a.status === 'submitted' && a.created_at && new Date(a.created_at) >= sevenDaysAgo,
    ).length,
    new_this_month: newThisMonth,
    new_last_month: newLastMonth,
    new_tasks: taskStats.new_tasks,
    pending_tasks: taskStats.pending_tasks,
    pending_requests: pendingRequests,
    total_requests: totalRequests,
    pending_esignatures: pendingEsignatures,
    active_users: activeUsers,
    total_clients: activeUsers,
  };
}
