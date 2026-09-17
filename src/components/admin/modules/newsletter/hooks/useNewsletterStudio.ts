/**
 * Newsletter — React Query hooks.
 *
 * Queries poll only where delivery is live: the campaign detail refetches on
 * a short interval while its status is active, everything else relies on
 * invalidation. Every mutation invalidates the affected keys and toasts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { newsletterStudioApi } from '../api';
import { newsletterKeys } from './queryKeys';
import type { CreateCampaignInput, NewsletterCampaign, UpdateCampaignInput } from '../types';

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
    onSuccess: (campaign) => invalidate(campaign.id),
    onError: (error) => toast.error(errorMessage(error, 'Failed to create the newsletter')),
  });
}

export function useUpdateCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCampaignInput }) =>
      newsletterStudioApi.updateCampaign(id, patch),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Newsletter saved');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to save the newsletter')),
  });
}

export function useUploadCampaignPdf() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      newsletterStudioApi.uploadPdf(id, file),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('PDF uploaded');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to upload the PDF')),
  });
}

/** Publish on the website — available whether or not the newsletter was ever emailed. */
export function usePublishToWebsite() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: ({ id, issueMonth }: { id: string; issueMonth?: string }) =>
      newsletterStudioApi.publishToWebsite(id, issueMonth),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Published on the website');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to publish on the website')),
  });
}

export function useUnpublishFromWebsite() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.unpublishFromWebsite(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Removed from the website');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to remove it from the website')),
  });
}

export function useDeleteCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.deleteCampaign(id),
    onSuccess: () => {
      invalidate();
      toast.success('Newsletter deleted');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to delete the newsletter')),
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
      toast.success('Newsletter scheduled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to schedule the newsletter')),
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
          : 'Nothing to send — no eligible recipients',
      );
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to start delivery')),
  });
}

export function useResumeCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.resumeCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Delivery retried');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to retry delivery')),
  });
}

export function useCancelCampaign() {
  const invalidate = useInvalidateCampaigns();
  return useMutation({
    mutationFn: (id: string) => newsletterStudioApi.cancelCampaign(id),
    onSuccess: (campaign) => {
      invalidate(campaign.id);
      toast.success('Newsletter cancelled');
    },
    onError: (error) => toast.error(errorMessage(error, 'Failed to cancel the newsletter')),
  });
}

/**
 * Manual delivery pass from the UI — the same tick the scheduler runs, so an
 * admin can nudge a stalled or freshly retried newsletter without waiting.
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
