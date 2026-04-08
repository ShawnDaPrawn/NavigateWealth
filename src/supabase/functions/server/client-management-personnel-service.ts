import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { CreatePersonnelPayload, PersonnelProfile, UserRole, PersonnelDocument } from "./client-management-personnel-types.ts";
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { SUPER_ADMIN_EMAIL } from './constants.ts';
import { sendEmail } from './email-service.tsx';

const log = createModuleLogger('personnel-service');

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Personnel Profile KV Store Helpers
const PERSONNEL_PREFIX = 'personnel:profile:';

const PersonnelRepository = {
  async getProfile(id: string): Promise<PersonnelProfile | null> {
    const data = await kv.get(`${PERSONNEL_PREFIX}${id}`);
    return data as PersonnelProfile | null;
  },

  async saveProfile(profile: PersonnelProfile): Promise<void> {
    await kv.set(`${PERSONNEL_PREFIX}${profile.id}`, profile);
  },

  async listAll(): Promise<PersonnelProfile[]> {
    const profiles = await kv.getByPrefix(PERSONNEL_PREFIX);
    return profiles as PersonnelProfile[];
  },

  async updateStatus(id: string, status: 'active' | 'suspended'): Promise<void> {
    const profile = await this.getProfile(id);
    if (profile) {
      profile.status = status;
      profile.updatedAt = new Date().toISOString();
      await this.saveProfile(profile);
    }
  },
  
  async deleteProfile(id: string): Promise<void> {
    await kv.del(`${PERSONNEL_PREFIX}${id}`);
  }
};

export const PersonnelService = {
  /**
   * Invites a new user via Supabase Auth and creates their personnel profile.
   * @param currentUserRole - The role of the admin performing the invite
   * @param payload - Invite data (email, name, role, etc.)
   * @param siteUrl - The frontend origin URL used to build the invite redirect link
   */
  async inviteUser(currentUserRole: UserRole, payload: CreatePersonnelPayload, siteUrl?: string) {
    // 1. Security Check
    if (!['super_admin', 'admin'].includes(currentUserRole)) {
      throw new Error("Unauthorized: Only admins can invite users.");
    }

    // 2. Build redirect URL — sends the invited user to the admin account setup page
    const redirectTo = siteUrl
      ? `${siteUrl}/auth/callback?type=invite`
      : undefined;

    // 3. Invite via Supabase Auth
    const { data: authData, error: authError } = await getSupabase().auth.admin.inviteUserByEmail(
      payload.email,
      {
        redirectTo,
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: payload.role,
          invited: true,
        },
      }
    );
    
    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user in Auth system");

    // 4. Create Personnel Profile
    const newProfile: PersonnelProfile = {
      id: authData.user.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      status: 'pending',
      commissionSplit: payload.commissionSplit || 0.7, // Default 70%
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      invitedAt: new Date().toISOString(),
      // Defaults
      fscaStatus: 'active',
    };

    await PersonnelRepository.saveProfile(newProfile);
    return newProfile;
  },

  /**
   * Resend an invitation email to a pending personnel member.
   * Re-invites via Supabase Auth (which sends a fresh magic link).
   *
   * WORKAROUND: inviteUserByEmail fails with "A user with this email
   * address has already been registered" when the auth user already exists
   * (e.g. created via createUser or a previous accepted invite). In that
   * case we fall back to generateLink + SendGrid to deliver the invite.
   * Proper fix: Supabase should support re-inviting existing users.
   * Search tag: // WORKAROUND: resend-invite-already-registered
   */
  async resendInvite(currentUserRole: UserRole, personnelId: string, siteUrl?: string) {
    if (!['super_admin', 'admin'].includes(currentUserRole)) {
      throw new Error("Unauthorized: Only admins can resend invitations.");
    }

    const profile = await PersonnelRepository.getProfile(personnelId);
    if (!profile) throw new Error("Personnel profile not found");
    if (profile.status !== 'pending') {
      throw new Error("Can only resend invitations for pending personnel");
    }

    const redirectTo = siteUrl
      ? `${siteUrl}/auth/callback?type=invite`
      : undefined;

    // Attempt 1: Try the standard inviteUserByEmail flow
    const { error: authError } = await getSupabase().auth.admin.inviteUserByEmail(
      profile.email,
      {
        redirectTo,
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: profile.role,
          invited: true,
        },
      }
    );

    if (authError) {
      // WORKAROUND: resend-invite-already-registered
      // If the user already exists in auth, generate a magic link and
      // send the invitation email manually via SendGrid.
      const isAlreadyRegistered =
        authError.message?.includes('already been registered') ||
        authError.status === 422;

      if (!isAlreadyRegistered) {
        throw authError;
      }

      log.info('inviteUserByEmail returned already-registered; falling back to generateLink', {
        personnelId,
        email: profile.email,
      });

      const { data: linkData, error: linkError } = await getSupabase().auth.admin.generateLink({
        type: 'magiclink',
        email: profile.email,
        options: { redirectTo },
      });

      if (linkError) {
        log.error('generateLink fallback also failed', linkError, { personnelId });
        throw new Error(`Failed to generate invite link: ${linkError.message}`);
      }

      const inviteLink = linkData?.properties?.action_link;
      if (!inviteLink) {
        throw new Error('generateLink succeeded but returned no action_link');
      }

      // Send the invite email via SendGrid
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
      const emailSent = await sendEmail({
        to: profile.email,
        subject: 'You\'re invited to Navigate Wealth',
        html: buildInviteEmailHtml(fullName, inviteLink),
      });

      if (!emailSent) {
        log.error('SendGrid email delivery failed for resend invite', { personnelId, email: profile.email });
        throw new Error('Failed to send invitation email. Please check SendGrid configuration.');
      }
    }

    // Update the invitedAt timestamp
    profile.invitedAt = new Date().toISOString();
    profile.updatedAt = new Date().toISOString();
    await PersonnelRepository.saveProfile(profile);

    log.info('Resent invite', { personnelId, email: profile.email });
    return { success: true, email: profile.email };
  },

  /**
   * Cancel (revoke) a pending invitation.
   * Removes the auth user and deletes the KV profile.
   */
  async cancelInvite(currentUserRole: UserRole, personnelId: string) {
    if (!['super_admin', 'admin'].includes(currentUserRole)) {
      throw new Error("Unauthorized: Only admins can cancel invitations.");
    }

    const profile = await PersonnelRepository.getProfile(personnelId);
    if (!profile) throw new Error("Personnel profile not found");
    if (profile.status !== 'pending') {
      throw new Error("Can only cancel invitations for pending personnel");
    }

    // 1. Delete the auth user (this invalidates any outstanding invite links)
    const { error: authError } = await getSupabase().auth.admin.deleteUser(personnelId);
    if (authError) {
      log.error('Failed to delete auth user during invite cancellation', authError, { personnelId });
      // Continue with KV cleanup even if auth deletion fails
    }

    // 2. Remove the KV profile
    await PersonnelRepository.deleteProfile(personnelId);

    // 3. Remove any permissions that were pre-set
    try {
      await kv.del(`permissions:${personnelId}`);
    } catch (_e) {
      // Non-fatal — permissions may not exist yet
    }

    log.info('Cancelled invite', { personnelId, email: profile.email });
    return { success: true, email: profile.email };
  },

  /**
   * Lists all personnel, filtering based on the viewer's role (Simulated RLS).
   * Auto-bootstraps the super admin profile if missing from KV.
   */
  async listPersonnel(
    currentUserId: string,
    currentUserRole: UserRole,
    currentUserEmail?: string
  ) {
    const allProfiles = await PersonnelRepository.listAll();

    // Auto-bootstrap: if the current user is the super admin and their profile
    // doesn't exist in KV yet, create it so they appear in the personnel table.
    if (
      currentUserEmail &&
      currentUserEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      const alreadyExists = allProfiles.some(
        (p) => p.id === currentUserId || p.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      );

      if (!alreadyExists) {
        log.info('Auto-bootstrapping super admin profile in KV', {
          userId: currentUserId,
          email: currentUserEmail,
        });

        const superAdminProfile: PersonnelProfile = {
          id: currentUserId,
          email: currentUserEmail,
          firstName: 'Shawn',
          lastName: 'Admin',
          role: 'super_admin',
          status: 'active',
          commissionSplit: 1.0,
          jobTitle: 'Super Administrator',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fscaStatus: 'active',
        };

        await PersonnelRepository.saveProfile(superAdminProfile);
        allProfiles.push(superAdminProfile);
      }
    }

    // RLS Logic
    if (['super_admin', 'admin', 'compliance'].includes(currentUserRole)) {
      return allProfiles;
    } else if (currentUserRole === 'adviser') {
      // Adviser can only see themselves
      return allProfiles.filter(p => p.id === currentUserId);
    } else if (currentUserRole === 'paraplanner') {
        // Paraplanner might need to see their assigned advisers (Logic TBD)
        // For now, let them see themselves
        return allProfiles.filter(p => p.id === currentUserId);
    }
    
    return [];
  },

  /**
   * Get a single profile
   */
  async getProfile(viewerId: string, viewerRole: UserRole, targetId: string) {
    // RLS Logic
    if (viewerId !== targetId && !['super_admin', 'admin', 'compliance'].includes(viewerRole)) {
      throw new Error("Unauthorized to view this profile");
    }
    return await PersonnelRepository.getProfile(targetId);
  },

  /**
   * Update profile details
   */
  async updateProfile(viewerRole: UserRole, targetId: string, updates: Partial<PersonnelProfile>) {
    if (!['super_admin', 'admin', 'compliance'].includes(viewerRole)) {
       // Allow self-update? Maybe for phone number, but not Role/Commission
       // But for now, strict control
       throw new Error("Unauthorized to update profile");
    }

    const existing = await PersonnelRepository.getProfile(targetId);
    if (!existing) throw new Error("Profile not found");

    // Prevent Role Escalation by non-super-admin
    if (updates.role && updates.role === 'super_admin' && viewerRole !== 'super_admin') {
        throw new Error("Cannot assign super_admin role");
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await PersonnelRepository.saveProfile(updated);
    return updated;
  },

  /**
   * Get Clients Assigned to a specific Personnel (Adviser)
   */
  async getAssignedClients(viewerRole: UserRole, personnelId: string) {
      // RLS: Only Admin, Compliance, or the Adviser themselves can see their book
      // (Caller should verify viewerId == personnelId if role is adviser, handled in controller/middleware usually)
      
      // Fetch all client profiles from KV
      // Prefix is 'user_profile:' based on profileRoutes.tsx
      const allClientProfiles = await kv.getByPrefix('user_profile:');
      
      // Filter by adviserId
      const assignedClients = allClientProfiles.filter((profile: Record<string, unknown>) => {
          const pi = profile.personalInformation as Record<string, unknown> | undefined;
          // Check both possible locations for adviserId
          return profile.adviserId === personnelId || 
                 pi?.adviserId === personnelId;
      });
      
      return assignedClients.map((p: Record<string, unknown>) => {
          const pi = p.personalInformation as Record<string, unknown> | undefined;
          const fin = p.financials as Record<string, unknown> | undefined;
          return {
              id: p.userId,
              name: `${pi?.firstName || ''} ${pi?.lastName || ''}`.trim(),
              email: (pi?.email as string) || '',
              status: (p.applicationStatus as string) || 'active',
              aum: (fin?.totalAssets as number) || 0 // Hypothetical field
          };
      });
  },
  
  /**
   * Add a document to personnel profile
   */
  async addDocument(viewerRole: UserRole, targetId: string, doc: PersonnelDocument) {
      if (!['super_admin', 'admin', 'compliance'].includes(viewerRole)) {
          throw new Error("Unauthorized to add documents");
      }
      
      const profile = await PersonnelRepository.getProfile(targetId);
      if (!profile) throw new Error("Profile not found");
      
      const documents = profile.documents || [];
      documents.push(doc);
      
      await this.updateProfile(viewerRole, targetId, { documents });
      return documents;
  },

  /**
   * Create a personnel account directly (without invite email).
   *
   * 1. Creates the user in Supabase Auth with email_confirm: true
   *    (admin vouches for the email — no verification needed).
   * 2. Sets a random temporary password.
   * 3. Creates the personnel:profile: KV entry with status 'active'.
   * 4. Generates a password recovery link so the user can set their own password.
   * 5. Returns the profile and the recovery link so the admin can share it.
   *
   * @param currentUserRole - The role of the admin performing the creation
   * @param payload - Account data (email, name, role, etc.)
   * @param siteUrl - Frontend origin URL for the recovery redirect
   */
  async createAccount(currentUserRole: UserRole, payload: CreatePersonnelPayload, siteUrl?: string) {
    // 1. Security Check
    if (!['super_admin', 'admin'].includes(currentUserRole)) {
      throw new Error("Unauthorized: Only admins can create personnel accounts.");
    }

    // 2. Generate temp password (user will set their own via recovery link)
    const tempPassword = (() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
      let pw = '';
      const arr = new Uint8Array(24);
      crypto.getRandomValues(arr);
      for (const byte of arr) pw += chars[byte % chars.length];
      return pw;
    })();

    // 3. Create via Supabase Auth — email pre-confirmed (admin vouches)
    const { data: authData, error: authError } = await getSupabase().auth.admin.createUser({
      email: payload.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        invited: true,        // Signals "personnel account" to downstream guards
        mustSetPassword: true, // Frontend can prompt password change on first login
        createdByAdmin: true,
      },
    });

    if (authError) {
      // Handle duplicate email
      if (
        authError.status === 422 ||
        authError.message?.includes('already been registered') ||
        (authError as Error & { code?: string })?.code === 'email_exists'
      ) {
        throw new Error(`A user with email ${payload.email} already exists`);
      }
      throw authError;
    }
    if (!authData.user) throw new Error("Failed to create user in Auth system");

    // 4. Create Personnel Profile (status: 'active', not 'pending')
    const newProfile: PersonnelProfile = {
      id: authData.user.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      status: 'active',
      commissionSplit: payload.commissionSplit || 0.7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fscaStatus: payload.fscaStatus || 'active',
    };

    await PersonnelRepository.saveProfile(newProfile);
    log.info('Personnel account created (direct)', { userId: authData.user.id, role: payload.role });

    // 5. Generate password recovery link
    let recoveryLink: string | null = null;
    try {
      const redirectBase = siteUrl?.replace(/\/+$/, '') || 'https://www.navigatewealth.co';
      const redirectTo = `${redirectBase}/reset-password`;

      const { data: linkData, error: linkError } = await getSupabase().auth.admin.generateLink({
        type: 'recovery',
        email: payload.email,
        options: { redirectTo },
      });

      if (!linkError && linkData?.properties?.action_link) {
        recoveryLink = linkData.properties.action_link;
      } else {
        log.warn('Failed to generate recovery link for new personnel', linkError);
      }
    } catch (linkErr) {
      log.error('Exception generating recovery link', linkErr as Error);
    }

    return {
      profile: newProfile,
      recoveryLink,
    };
  },

  /**
   * Backfill user_metadata.role on Auth records for all personnel.
   *
   * Reads every personnel:profile: KV entry, fetches the corresponding
   * Supabase Auth user, and updates user_metadata.role if it is missing
   * or does not match the KV profile's role.
   *
   * Follows the dry-run-first pattern (§14.1): when dryRun is true
   * (default), no writes are performed — only an audit summary is returned.
   *
   * @param dryRun - If true, report what would change without writing (default: true)
   */
  async backfillAuthRoles(dryRun = true): Promise<{
    dryRun: boolean;
    totalPersonnel: number;
    checked: number;
    updated: number;
    skipped: number;
    errors: number;
    details: Array<{
      id: string;
      email: string;
      kvRole: string;
      authRole: string | undefined;
      action: 'updated' | 'skipped' | 'error';
      reason?: string;
    }>;
  }> {
    const allProfiles = await PersonnelRepository.listAll();
    const supabase = getSupabase();

    const details: Array<{
      id: string;
      email: string;
      kvRole: string;
      authRole: string | undefined;
      action: 'updated' | 'skipped' | 'error';
      reason?: string;
    }> = [];

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of allProfiles) {
      try {
        // Fetch the Auth user
        const { data: { user }, error: fetchErr } = await supabase.auth.admin.getUserById(profile.id);

        if (fetchErr || !user) {
          details.push({
            id: profile.id,
            email: profile.email,
            kvRole: profile.role,
            authRole: undefined,
            action: 'error',
            reason: fetchErr?.message || 'Auth user not found',
          });
          errors++;
          continue;
        }

        const currentAuthRole = user.user_metadata?.role as string | undefined;

        // Already correct — skip
        if (currentAuthRole === profile.role) {
          details.push({
            id: profile.id,
            email: profile.email,
            kvRole: profile.role,
            authRole: currentAuthRole,
            action: 'skipped',
            reason: 'Role already matches',
          });
          skipped++;
          continue;
        }

        // Needs update
        if (!dryRun) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(profile.id, {
            user_metadata: {
              ...user.user_metadata,
              role: profile.role,
              invited: true, // Ensure the personnel guard flag is also set
            },
          });

          if (updateErr) {
            details.push({
              id: profile.id,
              email: profile.email,
              kvRole: profile.role,
              authRole: currentAuthRole,
              action: 'error',
              reason: `Update failed: ${updateErr.message}`,
            });
            errors++;
            continue;
          }
        }

        details.push({
          id: profile.id,
          email: profile.email,
          kvRole: profile.role,
          authRole: currentAuthRole,
          action: 'updated',
          reason: dryRun
            ? `Would update role from '${currentAuthRole || '(none)'}' to '${profile.role}'`
            : `Updated role from '${currentAuthRole || '(none)'}' to '${profile.role}'`,
        });
        updated++;
      } catch (err) {
        details.push({
          id: profile.id,
          email: profile.email,
          kvRole: profile.role,
          authRole: undefined,
          action: 'error',
          reason: (err as Error).message,
        });
        errors++;
      }
    }

    log.info('Backfill auth roles complete', {
      dryRun,
      total: allProfiles.length,
      updated,
      skipped,
      errors,
    });

    return {
      dryRun,
      totalPersonnel: allProfiles.length,
      checked: allProfiles.length,
      updated,
      skipped,
      errors,
      details,
    };
  },
};

// Helper function to build the HTML content of the invite email
function buildInviteEmailHtml(fullName: string, inviteLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>You're invited to Navigate Wealth</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f5f7; }
          .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #6d28d9, #7c3aed); padding: 32px 40px; }
          .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }
          .body { padding: 32px 40px; color: #374151; line-height: 1.6; }
          .body p { margin: 0 0 16px; font-size: 15px; }
          .cta { display: inline-block; background: #6d28d9; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
          .footer { padding: 24px 40px; background: #f9fafb; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Navigate Wealth</h1>
          </div>
          <div class="body">
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>You have been invited to join the Navigate Wealth platform as a team member. Click the button below to set up your account and get started.</p>
            <a href="${inviteLink}" class="cta">Set Up Your Account</a>
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 13px; color: #6b7280; word-break: break-all;">${inviteLink}</p>
            <p>This link will expire in 24 hours. If you need a new invitation, please contact your administrator.</p>
          </div>
          <div class="footer">
            <p>Navigate Wealth &middot; Sent by the admin team</p>
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}