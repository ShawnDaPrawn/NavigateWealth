/**
 * Client Management Module - Service Layer
 * 
 * Business logic for client management
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import type { Client, ClientFilters, ClientProfile, ClientSecurity, PaginatedClientResponse, GroupMatcherData, CommunicationRecord } from './client-management-types.ts';
import { shouldIncludeInClientManagement } from './client-management-visibility.ts';

const log = createModuleLogger('clients-service');

// Helper to create Supabase client
function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export class ClientsService {
  
  /**
   * Convert client data to group matcher format
   * Handles both flat and nested profile structures
   */
  private clientToMatcherFormat(client: Client): GroupMatcherData {
    const profile = client.profile || {} as ClientProfile;
    
    // Extract fields - try flat first, then nested
    const gender = profile.gender || profile.personalInformation?.gender;
    const nationality = profile.nationality || profile.personalInformation?.nationality;
    const maritalStatus = profile.maritalStatus || profile.personalInformation?.maritalStatus;
    const dateOfBirth = profile.dateOfBirth || profile.personalInformation?.dateOfBirth;
    const occupation = profile.occupation || profile.employmentInformation?.occupation;
    const employmentStatus = profile.employmentStatus || profile.employmentInformation?.employmentStatus;
    const grossIncome = profile.grossIncome || profile.personalInformation?.grossIncome;
    const netIncome = profile.netIncome || profile.personalInformation?.netIncome;
    const netWorth = profile.netWorth || profile.financialInformation?.netWorth;
    const dependants = profile.dependants || profile.additionalInformation?.dependants;
    const retirementAge = profile.retirementAge || profile.additionalInformation?.retirementAge;
    
    return {
      id: client.id,
      gender,
      country: nationality,
      maritalStatus,
      dateOfBirth,
      occupation,
      employmentStatus,
      income: grossIncome || netIncome,
      netWorth,
      dependants,
      retirementAge,
      age: dateOfBirth ? 
        Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
        undefined,
      productIds: profile.productIds || [],
    };
  }
  
  /**
   * Trigger group membership recalculation
   * Excludes deleted and suspended clients — they should not be in
   * communication groups.
   */
  private async triggerGroupRecalculation(): Promise<void> {
    try {
      log.info('Triggering group membership recalculation');
      // Use the communication-repo's fetchMatcherClients which properly
      // fetches policies for product filter matching
      const { fetchMatcherClients, recalculateAllGroupMemberships } = await import('./communication-repo.ts');
      const matcherClients = await fetchMatcherClients();
      await recalculateAllGroupMemberships(matcherClients);
      log.success('Group memberships recalculated', {
        activeClients: matcherClients.length,
      });
    } catch (error) {
      log.error('Failed to recalculate group memberships', error as Error);
      // Don't throw - group recalculation is a background task
    }
  }
  
  /**
   * Get all clients with profiles
   * 
   * Returns ALL clients (including deleted/suspended) for admin visibility.
   * The `deleted`, `suspended`, and `accountStatus` fields are exposed so
   * the frontend can show status indicators and apply client-side filters.
   */
  async getAllClients(filters?: Partial<ClientFilters>): Promise<Client[]> {
    log.info('Getting all clients', { filters });
    
    const supabase = createServiceClient();
    
    // Get all users from Supabase Auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      log.error('Failed to fetch users', error);
      throw new Error('Failed to fetch clients');
    }
    
    // ── Personnel exclusion ─────────────────────────────────────────
    // Batch-fetch personnel IDs to exclude staff from the client list.
    const personnelProfiles = await kv.getByPrefix('personnel:profile:');
    const personnelIds = new Set<string>(
      personnelProfiles.map((p: Record<string, unknown>) => p.id as string).filter(Boolean)
    );

    // Filter out personnel users before the expensive per-user KV reads
    const clientUsers = users.filter(user => shouldIncludeInClientManagement({
      user,
      personnelIds,
      profile: undefined,
      applicationStatus: undefined,
    }));

    log.info('Personnel filtered from client list', {
      totalAuthUsers: users.length,
      personnelExcluded: users.length - clientUsers.length,
      clientsToProcess: clientUsers.length,
    });

    // Enhance users with profile data
    const enhancedUsers = await Promise.all(
      clientUsers.map(async (user) => {
        try {
          // Get profile from KV
          const profileKey = `user_profile:${user.id}:personal_info`;
          const profile = await kv.get(profileKey);
          
          // Get application if exists
          let application = null;
          const appId = profile?.applicationId || profile?.application_id;
          
          if (appId) {
            application = await kv.get(`application:${appId}`);
          }
          
          // Get security status
          const security = await kv.get(`security:${user.id}`);
          
          return {
            id: user.id,
            email: user.email,
            firstName: user.user_metadata?.firstName || profile?.personalInformation?.firstName || '',
            lastName: user.user_metadata?.surname || profile?.personalInformation?.lastName || '',
            createdAt: user.created_at,
            accountType: user.user_metadata?.accountType || 'personal',
            applicationStatus: application?.status || user.user_metadata?.applicationStatus || 'none',
            suspended: security?.suspended || false,
            deleted: security?.deleted || false,
            accountStatus: profile?.accountStatus,
            role: user.user_metadata?.role || 'client',
            profile,
            application,
          };
        } catch (err) {
          log.error('Error fetching client data', err as Error, { userId: user.id });
          return {
            id: user.id,
            email: user.email,
            firstName: '',
            lastName: '',
            createdAt: user.created_at,
            accountType: 'personal',
            applicationStatus: 'unknown',
            suspended: false,
            deleted: false,
            accountStatus: undefined,
            role: 'client',
          };
        }
      })
    );
    
    // Apply filters
    let filteredClients = enhancedUsers.filter(client => shouldIncludeInClientManagement({
      user: {
        id: client.id,
        user_metadata: {
          role: client.role,
          accountStatus: client.accountStatus,
          applicationStatus: client.applicationStatus,
        },
      },
      personnelIds,
      profile: client.profile as Record<string, unknown> | undefined,
      applicationStatus: client.applicationStatus,
    }));
    
    if (filters?.status) {
      filteredClients = filteredClients.filter(c => c.applicationStatus === filters.status);
    }
    
    if (filters?.accountType) {
      filteredClients = filteredClients.filter(c => c.accountType === filters.accountType);
    }
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filteredClients = filteredClients.filter(c =>
        c.email.toLowerCase().includes(search) ||
        c.firstName?.toLowerCase().includes(search) ||
        c.lastName?.toLowerCase().includes(search)
      );
    }
    
    return filteredClients;
  }
  
  /**
   * Get paginated clients with profiles
   *
   * Wraps getAllClients with server-side pagination to reduce payload
   * size. The full dataset is still fetched and filtered server-side
   * (Supabase Auth doesn't support metadata-based queries), but only
   * the requested page is returned to the frontend.
   */
  async getClientsPaginated(filters?: Partial<ClientFilters>): Promise<PaginatedClientResponse> {
    const page = Math.max(1, filters?.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters?.perPage ?? 50));

    // Fetch and filter the full dataset
    const allClients = await this.getAllClients(filters);

    const total = allClients.length;
    const totalPages = Math.ceil(total / perPage);
    const offset = (page - 1) * perPage;
    const clients = allClients.slice(offset, offset + perPage);

    return { clients, total, page, perPage, totalPages };
  }

  /**
   * Get client by ID
   */
  async getClientById(clientId: string): Promise<Client> {
    const supabase = createServiceClient();
    
    const { data: { user }, error } = await supabase.auth.admin.getUserById(clientId);
    
    if (error || !user) {
      throw new NotFoundError('Client not found');
    }
    
    // Get profile
    const profile = await kv.get(`user_profile:${clientId}:personal_info`);
    
    // Get application
    let application = null;
    const appId = profile?.applicationId || profile?.application_id;
    if (appId) {
      application = await kv.get(`application:${appId}`);
    }
    
    // Get security status
    const security = await kv.get(`security:${clientId}`);
    
    return {
      id: user.id,
      email: user.email,
      firstName: user.user_metadata?.firstName || profile?.personalInformation?.firstName || '',
      lastName: user.user_metadata?.surname || profile?.personalInformation?.lastName || '',
      createdAt: user.created_at,
      accountType: user.user_metadata?.accountType || 'personal',
      applicationStatus: application?.status || user.user_metadata?.applicationStatus || 'none',
      suspended: security?.suspended || false,
      deleted: security?.deleted || false,
      accountStatus: profile?.accountStatus,
      role: user.user_metadata?.role || 'client',
      profile,
      application,
    };
  }
  
  /**
   * Update client
   */
  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    const supabase = createServiceClient();
    
    // Update user metadata in Supabase Auth
    if (updates.firstName || updates.lastName || updates.accountType) {
      await supabase.auth.admin.updateUserById(clientId, {
        user_metadata: {
          firstName: updates.firstName,
          surname: updates.lastName,
          accountType: updates.accountType,
        },
      });
    }
    
    // Update profile in KV if provided
    if (updates.profile) {
      await kv.set(`user_profile:${clientId}:personal_info`, updates.profile);
    }
    
    log.success('Client updated', { clientId });
    
    // Trigger group recalculation in background
    this.triggerGroupRecalculation().catch(err => 
      log.error('Background group recalculation failed', err)
    );
    
    return this.getClientById(clientId);
  }
  
  /**
   * Delete client (soft delete by marking as inactive)
   * Sets security.deleted flag AND updates accountStatus on the profile
   * so all consumers (search, listings, etc.) can filter without cross-referencing.
   *
   * Per Guidelines §12.3: Multi-entry consistency is non-negotiable.
   * Both security and profile KV entries must be updated together.
   */
  async deleteClient(clientId: string): Promise<void> {
    // Read both entries before writing either
    const security = await kv.get(`security:${clientId}`) || {};
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    // Stash previous accountStatus for potential reinstatement
    if (profile?.accountStatus && profile.accountStatus !== 'closed') {
      security.previousAccountStatus = profile.accountStatus;
    }

    // Mark as deleted + suspended in security store
    security.deleted = true;
    security.suspended = true;
    security.deletedAt = new Date().toISOString();

    // Update profile accountStatus to closed
    if (profile) {
      profile.accountStatus = 'closed';
      profile.updatedAt = new Date().toISOString();
    }

    // Write both entries together (multi-entry consistency)
    await Promise.all([
      kv.set(`security:${clientId}`, security),
      profile ? kv.set(profileKey, profile) : Promise.resolve(),
    ]);

    // ── Cascade-deprecate all applications belonging to a client.
    // Applications are keyed as `application:{applicationId}` with a `user_id`
    // field linking to the client. This method scans all applications, finds
    // those matching the clientId, and marks them as deprecated so they no
    // longer appear in active listings.
    //
    // Per Guidelines §12.3: downstream data must reflect the entity's
    // lifecycle state.
    await this.cascadeDeprecateApplications(clientId, 'Client soft-deleted');
    
    log.warn('Client deleted (soft)', { clientId });
  }

  /**
   * Close client account (soft-delete with full audit trail)
   *
   * Per Guidelines §12.3 — Client Lifecycle Management:
   *   Active → Closed (soft-delete)
   *   Suspended → Closed (soft-delete)
   *
   * Sets deleted: true and suspended: true on the security entry.
   * Sets accountStatus: 'closed' on the profile entry.
   * Auth account is NOT removed (compliance retention).
   * Both entries updated atomically.
   */
  async closeAccount(clientId: string, adminUserId: string, reason: string): Promise<{ success: boolean; message: string }> {
    // Read both entries before writing either
    const security = await kv.get(`security:${clientId}`) || {};
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    // Guard: already closed
    if (security.deleted) {
      return { success: false, message: 'Account is already closed' };
    }

    // Stash previous accountStatus for reinstatement
    if (profile?.accountStatus && profile.accountStatus !== 'closed') {
      security.previousAccountStatus = profile.accountStatus;
    }
    // Also stash whether the account was suspended before closure
    security.wasSuspendedBeforeClosure = !!security.suspended;

    // Mark as closed
    security.deleted = true;
    security.suspended = true;
    security.deletedAt = new Date().toISOString();
    security.closedBy = adminUserId;
    security.closureReason = reason;

    // Update profile
    if (profile) {
      profile.accountStatus = 'closed';
      profile.updatedAt = new Date().toISOString();
    }

    // Write both entries together (multi-entry consistency §12.3)
    await Promise.all([
      kv.set(`security:${clientId}`, security),
      profile ? kv.set(profileKey, profile) : Promise.resolve(),
    ]);

    log.warn('Client account closed', { clientId, adminUserId, reason });

    // Cascade-deprecate applications — closed clients' applications
    // should not appear in active listings
    await this.cascadeDeprecateApplications(clientId, `Account closed: ${reason}`);

    // Trigger group recalculation — closed clients must be excluded
    this.triggerGroupRecalculation().catch(err =>
      log.error('Background group recalculation failed after account closure', err)
    );

    return { success: true, message: 'Account closed successfully' };
  }

  /**
   * Reinstate a closed client account
   *
   * Reverses a soft-delete: clears deleted flag, restores previous
   * accountStatus, and optionally clears suspension if the account
   * was not suspended before closure.
   *
   * Per Guidelines §12.3: Both security and profile entries must be
   * updated together.
   */
  async reinstateAccount(clientId: string, adminUserId: string, note?: string): Promise<{ success: boolean; message: string }> {
    // Read both entries
    const security = await kv.get(`security:${clientId}`) || {};
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    // Guard: not closed
    if (!security.deleted) {
      return { success: false, message: 'Account is not closed — nothing to reinstate' };
    }

    // Determine what accountStatus to restore
    const previousStatus = security.previousAccountStatus || 'approved';
    const wasSuspendedBefore = security.wasSuspendedBeforeClosure === true;

    // Clear closure flags
    security.deleted = false;
    security.reinstatedAt = new Date().toISOString();
    security.reinstatedBy = adminUserId;
    if (note) security.reinstatementNote = note;

    // If the account was NOT suspended before closure, also clear suspension
    if (!wasSuspendedBefore) {
      security.suspended = false;
      delete security.reason;
      delete security.suspendedAt;
      delete security.suspendedBy;
    }
    // Clean up closure metadata (keep for audit trail)
    delete security.previousAccountStatus;
    delete security.wasSuspendedBeforeClosure;

    // Restore profile accountStatus
    if (profile) {
      profile.accountStatus = wasSuspendedBefore ? 'suspended' : previousStatus;
      profile.updatedAt = new Date().toISOString();
    }

    // Write both entries together (multi-entry consistency §12.3)
    await Promise.all([
      kv.set(`security:${clientId}`, security),
      profile ? kv.set(profileKey, profile) : Promise.resolve(),
    ]);

    log.success('Client account reinstated', { clientId, adminUserId, restoredStatus: previousStatus });

    // Trigger group recalculation — reinstated client may rejoin groups
    this.triggerGroupRecalculation().catch(err =>
      log.error('Background group recalculation failed after account reinstatement', err)
    );

    return { success: true, message: 'Account reinstated successfully' };
  }
  
  /**
   * Get client profile
   */
  async getClientProfile(clientId: string): Promise<ClientProfile | null> {
    const profile = await kv.get(`user_profile:${clientId}:personal_info`);
    return profile || null;
  }
  
  /**
   * Update client profile
   */
  async updateClientProfile(clientId: string, profileData: Partial<ClientProfile>): Promise<ClientProfile> {
    const profile = await kv.get(`user_profile:${clientId}:personal_info`) || {};
    
    Object.assign(profile, profileData);
    profile.updatedAt = new Date().toISOString();
    
    await kv.set(`user_profile:${clientId}:personal_info`, profile);
    
    log.success('Client profile updated', { clientId });
    
    // Trigger group recalculation in background
    this.triggerGroupRecalculation().catch(err => 
      log.error('Background group recalculation failed', err)
    );
    
    return profile;
  }
  
  /**
   * Get client documents
   */
  async getClientDocuments(clientId: string): Promise<unknown[]> {
    const documents = await kv.getByPrefix(`document:${clientId}:`);
    return documents || [];
  }
  
  /**
   * Get client communication history
   */
  async getClientCommunication(clientId: string): Promise<CommunicationRecord[]> {
    const communications = (await kv.getByPrefix(`communication_log:${clientId}:`)) as CommunicationRecord[];
    
    if (!communications || communications.length === 0) {
      return [];
    }
    
    // Sort by created date (newest first)
    communications.sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    return communications;
  }
  
  /**
   * Get client security status
   */
  async getClientSecurity(clientId: string): Promise<ClientSecurity> {
    const security = await kv.get(`security:${clientId}`) || {};
    
    return {
      suspended: security.suspended || false,
      suspendedAt: security.suspendedAt,
      suspendedBy: security.suspendedBy,
      suspensionReason: security.reason,
      twoFactorEnabled: security.twoFactorEnabled || false,
      last2faVerifiedAt: security.last2faVerifiedAt,
    };
  }
  
  /**
   * Suspend client account
   * Sets security.suspended flag AND updates accountStatus on the profile.
   *
   * Per Guidelines §12.3: Multi-entry consistency is non-negotiable.
   * Both security and profile KV entries must be updated together.
   */
  async suspendClient(clientId: string, adminUserId: string, reason: string) {
    // Read both entries before writing either
    const security = await kv.get(`security:${clientId}`) || {};
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    // Preserve the previous accountStatus so it can be restored on unsuspend
    if (profile?.accountStatus && profile.accountStatus !== 'suspended') {
      security.previousAccountStatus = profile.accountStatus;
    }

    // Mark as suspended in security store
    security.suspended = true;
    security.suspendedAt = new Date().toISOString();
    security.suspendedBy = adminUserId;
    security.reason = reason;

    // Update profile accountStatus to suspended
    if (profile) {
      profile.accountStatus = 'suspended';
      profile.updatedAt = new Date().toISOString();
    }

    // Write both entries together (multi-entry consistency §12.3)
    await Promise.all([
      kv.set(`security:${clientId}`, security),
      profile ? kv.set(profileKey, profile) : Promise.resolve(),
    ]);
    
    log.warn('Client suspended', { clientId, adminUserId, reason });
    
    return {
      success: true,
      message: 'Client account suspended',
    };
  }
  
  /**
   * Unsuspend client account
   * Clears security.suspended flag AND restores accountStatus on the profile.
   *
   * Per Guidelines §12.3: Multi-entry consistency is non-negotiable.
   * Both security and profile KV entries must be updated together.
   */
  async unsuspendClient(clientId: string, adminUserId: string) {
    // Read both entries before writing either
    const security = await kv.get(`security:${clientId}`) || {};
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    const previousStatus = security.previousAccountStatus || 'approved';
    
    security.suspended = false;
    security.unsuspendedAt = new Date().toISOString();
    security.unsuspendedBy = adminUserId;
    delete security.reason;
    delete security.previousAccountStatus;
    
    // Restore the previous accountStatus on the profile
    if (profile) {
      profile.accountStatus = previousStatus;
      profile.updatedAt = new Date().toISOString();
    }

    // Write both entries together (multi-entry consistency §12.3)
    await Promise.all([
      kv.set(`security:${clientId}`, security),
      profile ? kv.set(profileKey, profile) : Promise.resolve(),
    ]);
    
    log.success('Client unsuspended', { clientId, adminUserId });
    
    return {
      success: true,
      message: 'Client account unsuspended',
    };
  }

  /**
   * Cascade-deprecate all applications belonging to a client.
   *
   * Applications are keyed as `application:{applicationId}` with a `user_id`
   * field linking to the client. This method scans all applications, finds
   * those matching the clientId, and marks them as deprecated so they no
   * longer appear in active listings.
   *
   * Per Guidelines §12.3: downstream data must reflect the entity's
   * lifecycle state.
   */
  private async cascadeDeprecateApplications(clientId: string, reason: string): Promise<void> {
    try {
      const allApplications = await kv.getByPrefix('application:');
      if (!allApplications || allApplications.length === 0) return;

      const clientApps = allApplications.filter(
        (app: Record<string, unknown>) => app.user_id === clientId && app.deprecated !== true
      );

      if (clientApps.length === 0) return;

      const now = new Date().toISOString();
      await Promise.all(
        clientApps.map((app: Record<string, unknown>) =>
          kv.set(`application:${app.id}`, {
            ...app,
            deprecated: true,
            deprecated_at: now,
            deprecated_reason: reason,
          })
        )
      );

      log.info('Cascade-deprecated applications for deleted client', {
        clientId,
        count: clientApps.length,
        reason,
      });
    } catch (err) {
      // Non-blocking: application cleanup failure should not prevent client deletion
      log.error('Failed to cascade-deprecate applications for client', { clientId, err });
    }
  }
}
