/**
 * Social automation hooks — the Assets tab's data access.
 *
 * Batches and assets are written by the weekly routines and by the Edge
 * Function's image/sync jobs; settings and playbooks are the operator's
 * levers. Every mutation invalidates the automation root so a change shows
 * up everywhere at once. (React Query per Guidelines §6, §11.2.)
 *
 * @module social-media/hooks/useSocialAssets
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { socialAssetsApi } from '../api';
import type {
  RenderImagesReport,
  SocialAssetPatch,
  SocialAutomationPlaybook,
  SocialAutomationSettingsPatch,
  SocialJobName,
  SyncBufferReport,
} from '../types';
import { socialAssetsKeys } from './queryKeys';

const BATCHES_STALE_TIME = 60 * 1000; // 1 minute — the jobs move things hourly
const SETTINGS_STALE_TIME = 5 * 60 * 1000;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useSocialBatches(limit = 12) {
  return useQuery({
    queryKey: socialAssetsKeys.batchList(limit),
    queryFn: () => socialAssetsApi.listBatches(limit),
    staleTime: BATCHES_STALE_TIME,
  });
}

export function useSocialBatch(weekKey: string | null) {
  return useQuery({
    queryKey: socialAssetsKeys.batch(weekKey ?? ''),
    queryFn: () => socialAssetsApi.getBatch(weekKey as string),
    enabled: Boolean(weekKey),
    staleTime: BATCHES_STALE_TIME,
  });
}

export function useSocialAutomationSettings() {
  return useQuery({
    queryKey: socialAssetsKeys.settings(),
    queryFn: () => socialAssetsApi.getSettings(),
    staleTime: SETTINGS_STALE_TIME,
  });
}

export function useSocialPlaybooks(enabled = true) {
  return useQuery({
    queryKey: socialAssetsKeys.playbooks(),
    queryFn: () => socialAssetsApi.listPlaybooks(),
    enabled,
    staleTime: SETTINGS_STALE_TIME,
  });
}

export function useUpdateSocialSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SocialAutomationSettingsPatch) => socialAssetsApi.updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(socialAssetsKeys.settings(), settings);
      toast.success('Automation settings saved');
    },
    onError: (err: unknown) => toast.error(messageOf(err, 'Failed to save settings')),
  });
}

export function useUpdateSocialPlaybook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: SocialAutomationPlaybook['id'];
      patch: { title?: string; instructions?: string };
    }) => socialAssetsApi.updatePlaybook(id, patch),
    onSuccess: (playbook) => {
      queryClient.invalidateQueries({ queryKey: socialAssetsKeys.playbooks() });
      toast.success(`Playbook "${playbook.title}" saved (v${playbook.version})`);
    },
    onError: (err: unknown) => toast.error(messageOf(err, 'Failed to save playbook')),
  });
}

export function useUpdateSocialAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, patch }: { assetId: string; patch: SocialAssetPatch }) =>
      socialAssetsApi.updateAsset(assetId, patch),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: socialAssetsKeys.batches() });
      if (asset.state === 'rejected') toast.success('Asset removed from this week’s candidates');
      else if (asset.image_status === 'pending') toast.success('Image queued for rendering');
      else toast.success('Asset restored');
    },
    onError: (err: unknown) => toast.error(messageOf(err, 'Failed to update asset')),
  });
}

/** Human-readable one-liner for a job report, for the toast. */
export function describeJobReport(
  job: SocialJobName,
  report: RenderImagesReport | SyncBufferReport,
): string {
  if (job === 'render-images') {
    const r = report as RenderImagesReport;
    return `Images: ${r.rendered} rendered, ${r.failed} failed, ${r.skipped} skipped (of ${r.scanned} pending)`;
  }
  const r = report as SyncBufferReport;
  return `Buffer sync: ${r.published} published, ${r.failed} failed, ${r.unchanged} unchanged (of ${r.checked} checked)`;
}

export function useRunSocialJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (job: SocialJobName) =>
      socialAssetsApi.runJob(job).then((report) => ({ job, report })),
    onSuccess: ({ job, report }) => {
      queryClient.invalidateQueries({ queryKey: socialAssetsKeys.batches() });
      toast.success(describeJobReport(job, report));
    },
    onError: (err: unknown) => toast.error(messageOf(err, 'Job failed')),
  });
}
