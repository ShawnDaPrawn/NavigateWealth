/**
 * Newsletter Studio — React Query hooks.
 *
 * Queries poll only where delivery is live: the campaign detail refetches on
 * a short interval while its status is active, everything else relies on
 * invalidation. Every mutation invalidates the affected keys and toasts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { newsletterStudioApi } from '../api';
import { newsletterKeys } from './queryKeys';
import type {
  CreateCampaignInput,
  NewsletterCampaign,
  TemplateInput,
  UpdateCampaignInput,
} from '../types';

const ACTIVE_STATUSES: NewsletterCampaign['status'][] = ['queued', 'sending'];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useStudioDashboard() {
  return useQuery({
    queryKey: newsletterKeys.studioDashboard(),
    queryFn: () => newsletterStudioApi.getDashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useStudioCampaigns(filters: { status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: newsletterKeys.campaigns(filters),
    queryFn: () => newsletterStudioApi.getCampaigns(filters),
    staleTime: 15_000,
  });
}

export function useStudioCampaign(id: string | null) {
  return useQuery({
    queryKey: newsletterKeys.campaign(id ?? 'none'),
    queryFn: () => newsletterStudioApi.getCampaign(id!),
    enabled: Boolean(id),
    // Live progress while the processor works this campaign.
    refetchInterval: (query) =>
      query.state.data && ACTIVE_STATUSES.includes(query.state.data.status) ? 2_500 : false,
  });
}

export function useStudioCampaignStats(id: string | null, enabled = true) {
  return useQuery({
    queryKey: newsletterKeys.campaignStats(id ?? 'none'),
    queryFn: () => newsletterStudioApi.getStats(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}

export function useStudioRecipients(
  id: string | null,
  filters: { page?: number; status?: string } = {},
) {
  return useQuery({
    queryKey: newsletterKeys.campaignRecipients(id ?? 'none', filters),
    queryFn: () => newsletterStudioApi.getRecipients(id!, filters),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useStudioLists() {
  return useQuery({
    queryKey: newsletterKeys.lists(),
    queryFn: () => newsletterStudioApi.getLists(),
    staleTime: 60_000,
  });
}

export function useStudioTemplates() {
  return useQuery({
    queryKey: newsletterKeys.templates(),
    queryFn: () => newsletterStudioApi.getTemplates(),
    staleTime: 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

function useInvalidateCampaigns() {
  const queryClient = useQueryClient();
  return (campaignId?: string) => {
    queryClient.invalidateQueries({ queryKey: [...newsletterKeys.all, 'studio', 'campaigns'] });
    queryClient.invalidateQueries({ queryKey: newsletterKeys.studioDashboard() });
    if (campaignId) {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.campaign(campaignId) });
      queryClient.invalidateQueries({ queryKey: newsletterKeys.campaignStats(campaignId) });
    } else {
      // No specific campaign (delete, manual delivery pass): every open
      // drill-down may have moved, so refresh them all.
      queryClient.invalidateQueries({ queryKey: [...newsletterKeys.all, 'studio', 'campaign'] });
    }
  };
}

export function useCreateCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => newsletterStudioApi.createCampaign(input),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign draft created');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to create campaign')),
  });
}

export function useUpdateCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCampaignInput }) =>
      newsletterStudioApi.updateCampaign(id, patch),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save campaign')),
  });
}

export function useDeleteCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.deleteCampaign(id),
    onSuccess: () => {
      invalidate();
      toast.success('Campaign deleted');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to delete campaign')),
  });
}

export function useDuplicateCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.duplicateCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign duplicated as a new draft');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to duplicate campaign')),
  });
}

export function useSendTest() {
  return useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      newsletterStudioApi.sendTest(id, emails),
    onSuccess: (results) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        toast.success(`Test sent to ${results.length} address(es)`);
      } else {
        toast.error(`Test failed for ${failed.map((f) => f.email).join(', ')}`);
      }
    },
    onError: (error) => toast.error(errorMessage(error, 'Test send failed')),
  });
}

export function useScheduleCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      newsletterStudioApi.scheduleCampaign(id, scheduledAt),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign scheduled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to schedule campaign')),
  });
}

export function useSendCampaignNow() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.sendCampaignNow(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success(
        campaign.recipientCount > 0
          ? `Delivery started to ${campaign.recipientCount} recipient(s)`
          : 'Campaign finished — no eligible recipients',
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to start delivery')),
  });
}

export function usePauseCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.pauseCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign paused');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to pause campaign')),
  });
}

export function useResumeCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.resumeCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign resumed');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to resume campaign')),
  });
}

export function useCancelCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.cancelCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Campaign cancelled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to cancel campaign')),
  });
}

export function useSaveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TemplateInput }) =>
      id
        ? newsletterStudioApi.updateTemplate(id, input)
        : newsletterStudioApi.createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.templates() });
      queryClient.invalidateQueries({ queryKey: newsletterKeys.studioDashboard() });
      toast.success('Template saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save template')),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsletterKeys.templates() });
      toast.success('Template deleted');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to delete template')),
  });
}

/**
 * Manual delivery pass from the UI — the same tick the scheduler runs, so an
 * admin can nudge a stalled or freshly resumed campaign without waiting.
 */
export function useRunProcessorNow() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: () => newsletterStudioApi.process(),
    onSuccess: (result) => {
      invalidate();
      if (result.errors.length > 0) {
        toast.warning(`Delivery pass finished with a problem: ${result.errors[0]}`);
      } else if (result.sent > 0 || result.failed > 0) {
        toast.success(
          `Delivery pass complete — ${result.sent} sent${
            result.failed > 0 ? `, ${result.failed} failed` : ''
          }`,
        );
      } else if (result.campaignsProcessed > 0 || result.promotedScheduled > 0) {
        toast.success('Delivery pass complete');
      } else {
        toast.info('Nothing is waiting to be sent');
      }
    },
    onError: (error) => toast.error(errorMessage(error, 'Delivery pass failed')),
  });
}
