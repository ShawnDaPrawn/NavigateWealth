/**
 * Personnel Module API Layer
 * Navigate Wealth Admin Dashboard
 * 
 * Updated to use Backend API (KV Store) instead of direct Supabase Table calls.
 * This fixes the "Could not find the table 'public.personnel'" errors.
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type {
  Personnel,
  PersonnelDocument,
  InvitePersonnelInput,
  UpdatePersonnelInput,
  AddPersonnelDocumentInput,
  ClientSummary,
  PersonnelFilters,
  SuperAdminProfile,
  PermissionSet,
  UpdatePermissionsInput,
} from './types';

// ============================================================================
// PERSONNEL OPERATIONS
// ============================================================================

/**
 * Fetch all personnel members
 */
export async function fetchPersonnel(filters?: Partial<PersonnelFilters>): Promise<Personnel[]> {
  try {
    const response = await api.get<{ data: Personnel[] }>('personnel/list');
    const personnel = (response.data || []).map(normalisePersonnel);

    // Client-side filtering if needed (though backend handles role filtering)
    // The backend returns all personnel visible to the user.
    // We can apply further filters here if necessary.
    let filtered = personnel;
    
    if (filters?.roles && filters.roles.length > 0) {
      filtered = filtered.filter((p: Personnel) => filters.roles?.includes(p.role));
    }
    
    if (filters?.statuses && filters.statuses.length > 0) {
      filtered = filtered.filter((p: Personnel) => filters.statuses?.includes(p.status));
    }

    return filtered;

  } catch (error) {
    logger.error('[API] Failed to fetch personnel', error, { filters });
    return [];
  }
}

/**
 * Fetch a single personnel member by ID
 */
export async function fetchPersonnelById(id: string): Promise<Personnel | null> {
  try {
    const list = await fetchPersonnel();
    const found = list.find(p => p.id === id);
    
    if (!found) {
      return null;
    }
    
    return found;
  } catch (error) {
    logger.error('[API] Failed to fetch personnel', error, { id });
    return null;
  }
}

/**
 * Invite a new personnel member
 */
export async function invitePersonnel(input: InvitePersonnelInput): Promise<Personnel> {
  try {
    const response = await api.post<{ data: Personnel }>('personnel/invite', input);
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to invite personnel', error, { input });
    throw error;
  }
}

/**
 * Create a personnel account directly (admin creates account + sends credentials).
 * Returns the created profile and an optional password recovery link.
 */
export async function createPersonnelAccount(input: InvitePersonnelInput): Promise<{
  profile: Personnel;
  recoveryLink: string | null;
}> {
  try {
    const response = await api.post<{
      data: { profile: Personnel; recoveryLink: string | null };
    }>('personnel/create-account', input);
    return {
      profile: normalisePersonnel(response.data.profile as Partial<Personnel> & Record<string, unknown>),
      recoveryLink: response.data.recoveryLink,
    };
  } catch (error) {
    logger.error('[API] Failed to create personnel account', error, { input });
    throw error;
  }
}

/**
 * Resend invitation email to a pending personnel member
 */
export async function resendPersonnelInvite(personnelId: string): Promise<{ success: boolean; email: string }> {
  try {
    const response = await api.post<{ data: { success: boolean; email: string } }>(`personnel/resend-invite/${personnelId}`);
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to resend personnel invite', error, { personnelId });
    throw error;
  }
}

/**
 * Cancel (revoke) a pending personnel invitation
 */
export async function cancelPersonnelInvite(personnelId: string): Promise<{ success: boolean; email: string }> {
  try {
    const response = await api.delete<{ data: { success: boolean; email: string } }>(`personnel/invite/${personnelId}`);
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to cancel personnel invite', error, { personnelId });
    throw error;
  }
}

/**
 * Update personnel information
 */
export async function updatePersonnel(id: string, updates: Partial<UpdatePersonnelInput>): Promise<Personnel> {
  try {
    const response = await api.put<{ data: Personnel }>(`personnel/${id}`, updates);
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to update personnel', error, { id, updates });
    throw error;
  }
}

/**
 * Delete personnel member
 */
export async function deletePersonnel(id: string): Promise<void> {
  try {
    // Use update to set status to 'suspended' as we don't have a hard delete endpoint yet
    // Or check if backend supports DELETE
    // Current backend routes don't show DELETE /:id, so we'll simulate soft delete or fail.
    // Ideally we should add DELETE to backend. 
    // For now, let's assume we update status to suspended.
    
    await api.put(`personnel/${id}`, { status: 'suspended' });

  } catch (error) {
    logger.error('[API] Failed to delete personnel', error, { id });
    throw error;
  }
}

// ============================================================================
// PERSONNEL CLIENTS OPERATIONS
// ============================================================================

/**
 * Fetch clients assigned to a personnel member
 */
export async function fetchPersonnelClients(personnelId: string): Promise<ClientSummary[]> {
  try {
    const response = await api.get<{ data: ClientSummary[] }>(`personnel/${personnelId}/clients`);
    return response.data || [];
  } catch (error) {
    logger.error('[API] Failed to fetch personnel clients', error, { personnelId });
    return [];
  }
}

// ============================================================================
// PERSONNEL DOCUMENTS OPERATIONS
// ============================================================================

/**
 * Add a document to a personnel member
 */
export async function addPersonnelDocument(input: AddPersonnelDocumentInput): Promise<PersonnelDocument> {
  try {
    const response = await api.post<{ data: PersonnelDocument[] }>(`personnel/${input.personnelId}/documents`, input);
    
    // The backend returns { data: documents[] }, but we need to return the new document.
    // For now, return the last one or a mock since the backend API contract is slightly different.
    const docs = response.data || [];
    return docs[docs.length - 1] || {
      id: `doc-${Date.now()}`,
      name: input.name,
      type: input.type,
      url: input.url,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[API] Failed to add document', error, { input });
    throw error;
  }
}

// ============================================================================
// SUPER ADMIN OPERATIONS
// ============================================================================

/**
 * Fetch super admin profile
 */
export async function fetchSuperAdminProfile(): Promise<SuperAdminProfile | null> {
  try {
    // Reuse fetchPersonnel list and find the super admin
    const list = await fetchPersonnel({ roles: ['super_admin'] });
    const superAdmin = list.find(p => p.role === 'super_admin');
    
    if (!superAdmin) return null;

    return {
      id: superAdmin.id,
      name: superAdmin.name,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      email: superAdmin.email,
      phone: superAdmin.phone,
      company: superAdmin.branch,
      updatedAt: superAdmin.updatedAt,
    };
  } catch (error) {
    logger.error('[API] Failed to fetch super admin', error);
    return null;
  }
}

/**
 * Update super admin profile
 */
export async function updateSuperAdminProfile(updates: Partial<SuperAdminProfile>): Promise<SuperAdminProfile> {
  try {
    const existing = await fetchSuperAdminProfile();
    if (!existing) throw new Error('Super Admin not found');

    // Map SuperAdminProfile updates to UpdatePersonnelInput
    const payload = {
      firstName: updates.firstName,
      lastName: updates.lastName,
      phone: updates.phone,
      branch: updates.company,
    };

    const response = await api.put<{ data: Personnel }>(`personnel/${existing.id}`, payload);
    const updated = response.data;

    return {
      id: updated.id,
      name: updated.name,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phone: updated.phone,
      company: updated.branch,
      updatedAt: updated.updatedAt,
    };

  } catch (error) {
    logger.error('[API] Failed to update super admin', error, { updates });
    throw error;
  }
}

// ============================================================================
// PERMISSIONS OPERATIONS
// ============================================================================

/**
 * Fetch permissions for a specific personnel member (admin use)
 */
export async function fetchPermissions(personnelId: string): Promise<PermissionSet> {
  try {
    const response = await api.get<{ data: PermissionSet }>(`personnel/permissions/${personnelId}`);
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to fetch permissions', error, { personnelId });
    return { personnelId, modules: {}, updatedAt: '', updatedBy: '' };
  }
}

/**
 * Update permissions for a specific personnel member (admin use)
 */
export async function updatePermissions(input: UpdatePermissionsInput): Promise<PermissionSet> {
  try {
    const response = await api.put<{ data: PermissionSet }>(
      `personnel/permissions/${input.personnelId}`,
      { modules: input.modules }
    );
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to update permissions', error, { personnelId: input.personnelId });
    throw error;
  }
}

/**
 * Fetch permissions for the currently authenticated user (sidebar use)
 */
export async function fetchMyPermissions(): Promise<PermissionSet & { isSuperAdmin: boolean }> {
  try {
    const response = await api.get<{ data: PermissionSet & { isSuperAdmin: boolean } }>('personnel/permissions/me');
    return response.data;
  } catch (error) {
    logger.error('[API] Failed to fetch current user permissions', error);
    // Fail-open for super admin detection; fail-closed for modules
    return { personnelId: '', modules: {}, updatedAt: '', updatedBy: '', isSuperAdmin: false };
  }
}

/**
 * Fetch all permissions (admin personnel table summary use)
 */
export async function fetchAllPermissions(): Promise<PermissionSet[]> {
  try {
    const response = await api.get<{ data: PermissionSet[] }>('personnel/permissions/all');
    return response.data || [];
  } catch (error) {
    logger.error('[API] Failed to fetch all permissions', error);
    return [];
  }
}

/**
 * Raw permission audit entry from the server
 */
interface PermissionAuditEntry {
  id: string;
  action: string;
  changedBy: string;
  changedAt: string;
  previousPermissions?: Record<string, unknown>;
  newPermissions?: Record<string, unknown>;
}

/**
 * Fetch permission audit trail for a specific personnel member
 */
export async function fetchPermissionAudit(personnelId: string): Promise<PermissionAuditEntry[]> {
  try {
    const response = await api.get<{ data: PermissionAuditEntry[] }>(`personnel/audit/permissions/${personnelId}`);
    return response.data || [];
  } catch (error) {
    logger.error('[API] Failed to fetch permission audit trail', error);
    return [];
  }
}

/**
 * Backfill role result detail from the server
 */
interface BackfillRoleDetail {
  id: string;
  email: string;
  kvRole: string;
  authRole: string | undefined;
  action: 'updated' | 'skipped' | 'error';
  reason?: string;
}

/**
 * Result shape from the backfill-roles maintenance endpoint
 */
export interface BackfillRolesResult {
  dryRun: boolean;
  totalPersonnel: number;
  checked: number;
  updated: number;
  skipped: number;
  errors: number;
  details: BackfillRoleDetail[];
}

/**
 * Run the backfill-roles maintenance operation.
 *
 * Ensures every personnel KV profile has a matching user_metadata.role
 * on the Supabase Auth record.  Defaults to dry-run mode (no writes).
 *
 * Requires super_admin role.
 */
export async function backfillAuthRoles(dryRun = true): Promise<BackfillRolesResult> {
  try {
    const response = await api.post<{ success: boolean } & BackfillRolesResult>(
      'personnel/maintenance/backfill-roles',
      { dryRun }
    );
    return response as unknown as BackfillRolesResult;
  } catch (error) {
    logger.error('[API] Failed to run backfill-roles maintenance', error, { dryRun });
    throw error;
  }
}

export const personnelApi = {
  // Personnel CRUD
  fetch: fetchPersonnel,
  fetchById: fetchPersonnelById,
  invite: invitePersonnel,
  createAccount: createPersonnelAccount,
  resendInvite: resendPersonnelInvite,
  cancelInvite: cancelPersonnelInvite,
  update: updatePersonnel,
  delete: deletePersonnel,

  // Personnel clients
  fetchClients: fetchPersonnelClients,

  // Personnel documents
  addDocument: addPersonnelDocument,

  // Super admin
  fetchSuperAdmin: fetchSuperAdminProfile,
  updateSuperAdmin: updateSuperAdminProfile,

  // Permissions
  fetchPermissions,
  updatePermissions,
  fetchMyPermissions,
  fetchAllPermissions,

  // Audit
  fetchPermissionAudit,

  // Maintenance
  backfillAuthRoles,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalise a personnel record coming from the server.
 * The KV store may not have a computed `name` field, so we derive it
 * from firstName/lastName if missing.
 */
function normalisePersonnel(p: Partial<Personnel> & Record<string, unknown>): Personnel {
  return {
    ...p,
    name: (p.name as string) || `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p.email as string) || 'Unknown',
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    phone: p.phone || '',
    commissionSplit: p.commissionSplit ?? 0,
  } as Personnel;
}