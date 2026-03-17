/**
 * Personnel Mutation Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query mutation hooks for personnel create, update, and delete operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { personnelApi } from '../api';
import { personnelKeys } from './usePersonnel';
import type {
  InvitePersonnelInput,
  UpdatePersonnelInput,
  AddPersonnelDocumentInput,
  SuperAdminProfile,
  ModuleAccess,
  Personnel,
} from '../types';
import type { AdminModule } from '../../../layout/types';

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to invite a new personnel member
 * 
 * Invalidates all personnel list queries on success.
 * When `initialModuleAccess` is provided, sets initial permissions
 * for the new user after creation.
 * 
 * @returns React Query mutation result
 */
export function useInvitePersonnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InvitePersonnelInput & { initialModuleAccess?: AdminModule[] }) => {
      const { initialModuleAccess, ...inviteInput } = input;
      const result = await personnelApi.invite(inviteInput);

      // If initial module access was provided, set permissions after creation
      if (initialModuleAccess && initialModuleAccess.length > 0 && result?.id) {
        try {
          const modules: Partial<Record<AdminModule, ModuleAccess>> = {};
          initialModuleAccess.forEach((m) => {
            modules[m] = { access: true, capabilities: [] };
          });
          await personnelApi.updatePermissions({
            personnelId: result.id,
            modules,
          });
        } catch (permError) {
          // Log but don't fail the invite — permissions can be set later
          console.error('Failed to set initial permissions (non-fatal):', permError);
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      toast.success('Personnel invited successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to invite personnel:', error);
      toast.error(`Failed to invite personnel: ${error.message}`);
    },
  });
}

/**
 * Hook to create a personnel account directly (without sending an invite email).
 *
 * Creates the auth user immediately, generates a password-recovery link,
 * and optionally sets initial module permissions — all in a single flow.
 *
 * The returned mutation result includes the new `Personnel` profile and a
 * `recoveryLink` string that the admin can share with the new user.
 *
 * @returns React Query mutation result with `{ profile, recoveryLink }`
 */
export function useCreatePersonnelAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: InvitePersonnelInput & { initialModuleAccess?: AdminModule[] }
    ): Promise<{ profile: Personnel; recoveryLink: string | null }> => {
      const { initialModuleAccess, ...createInput } = input;
      const result = await personnelApi.createAccount(createInput);

      // Set initial module permissions if provided
      if (initialModuleAccess && initialModuleAccess.length > 0 && result.profile?.id) {
        try {
          const modules: Partial<Record<AdminModule, ModuleAccess>> = {};
          initialModuleAccess.forEach((m) => {
            modules[m] = { access: true, capabilities: [] };
          });
          await personnelApi.updatePermissions({
            personnelId: result.profile.id,
            modules,
          });
        } catch (permError) {
          // Log but don't fail — permissions can be set later
          console.error('Failed to set initial permissions for created account (non-fatal):', permError);
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      toast.success('Personnel account created successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to create personnel account:', error);
      toast.error(`Failed to create account: ${error.message}`);
    },
  });
}

/**
 * Hook to update personnel information
 * 
 * Invalidates all personnel queries on success.
 * 
 * @returns React Query mutation result
 * 
 * @example
 * ```tsx
 * const { mutate: updatePersonnel, isPending } = useUpdatePersonnel();
 * 
 * updatePersonnel({
 *   id: '123',
 *   phone: '+27123456789',
 *   jobTitle: 'Senior Adviser',
 * });
 * ```
 */
export function useUpdatePersonnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePersonnelInput) => {
      const { id, ...updates } = input;
      return personnelApi.update(id, updates);
    },
    onSuccess: (data, variables) => {
      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      
      // Invalidate specific detail
      queryClient.invalidateQueries({ queryKey: personnelKeys.detail(variables.id) });
      
      toast.success('Personnel updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update personnel:', error);
      toast.error(`Failed to update personnel: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a personnel member
 * 
 * Invalidates all personnel queries on success.
 * 
 * @returns React Query mutation result
 * 
 * @example
 * ```tsx
 * const { mutate: deletePersonnel, isPending } = useDeletePersonnel();
 * 
 * deletePersonnel('123');
 * ```
 */
export function useDeletePersonnel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return personnelApi.delete(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      queryClient.removeQueries({ queryKey: personnelKeys.detail(id) });
      toast.success('Personnel deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to delete personnel:', error);
      toast.error(`Failed to delete personnel: ${error.message}`);
    },
  });
}

/**
 * Hook to add a document to a personnel member
 * 
 * Invalidates personnel detail query on success.
 * 
 * @returns React Query mutation result
 * 
 * @example
 * ```tsx
 * const { mutate: addDocument, isPending } = useAddPersonnelDocument();
 * 
 * addDocument({
 *   personnelId: '123',
 *   name: 'RE5 Certificate.pdf',
 *   type: 're5',
 *   url: 'https://...',
 * });
 * ```
 */
export function useAddPersonnelDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddPersonnelDocumentInput) => {
      return personnelApi.addDocument(input);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: personnelKeys.detail(variables.personnelId) 
      });
      toast.success('Document uploaded successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to upload document:', error);
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}

/**
 * Hook to resend an invitation to a pending personnel member
 * 
 * Invalidates all personnel list queries on success.
 * 
 * @returns React Query mutation result
 */
export function useResendPersonnelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personnelId: string) => {
      return personnelApi.resendInvite(personnelId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      toast.success(`Invitation resent to ${data.email}`);
    },
    onError: (error: Error) => {
      console.error('Failed to resend invitation:', error);
      toast.error(`Failed to resend invitation: ${error.message}`);
    },
  });
}

/**
 * Hook to cancel a pending personnel invitation
 * 
 * Removes the auth user and KV profile.
 * Invalidates all personnel list queries on success.
 * 
 * @returns React Query mutation result
 */
export function useCancelPersonnelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personnelId: string) => {
      return personnelApi.cancelInvite(personnelId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.lists() });
      toast.success(`Invitation for ${data.email} has been cancelled`);
    },
    onError: (error: Error) => {
      console.error('Failed to cancel invitation:', error);
      toast.error(`Failed to cancel invitation: ${error.message}`);
    },
  });
}

/**
 * Hook to update super admin profile
 * 
 * Invalidates super admin query on success.
 * 
 * @returns React Query mutation result
 * 
 * @example
 * ```tsx
 * const { mutate: updateSuperAdmin, isPending } = useUpdateSuperAdmin();
 * 
 * updateSuperAdmin({
 *   phone: '+27123456789',
 *   company: 'Navigate Wealth',
 * });
 * ```
 */
export function useUpdateSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<SuperAdminProfile>) => {
      return personnelApi.updateSuperAdmin(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personnelKeys.superAdmin() });
      toast.success('Super admin profile updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update super admin:', error);
      toast.error(`Failed to update super admin: ${error.message}`);
    },
  });
}

/**
 * Hook to run the backfill-roles maintenance operation.
 *
 * Ensures every personnel KV profile has a matching user_metadata.role
 * on the Supabase Auth record.  Defaults to dry-run mode.
 *
 * Requires super_admin role.
 *
 * @returns React Query mutation result with `BackfillRolesResult`
 */
export function useBackfillAuthRoles() {
  return useMutation({
    mutationFn: async (dryRun = true) => {
      return personnelApi.backfillAuthRoles(dryRun);
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        toast.info(
          `Dry run complete: ${data.updated} would be updated, ${data.skipped} already correct, ${data.errors} errors`
        );
      } else {
        toast.success(
          `Backfill complete: ${data.updated} updated, ${data.skipped} skipped, ${data.errors} errors`
        );
      }
    },
    onError: (error: Error) => {
      console.error('Failed to run backfill-roles:', error);
      toast.error(`Backfill failed: ${error.message}`);
    },
  });
}