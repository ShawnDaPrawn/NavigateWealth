/**
 * Portal automation — worker runtime (Phase 5 decomposition).
 * ===========================================================
 *
 * Extracted verbatim from integrations.tsx. Live-view screenshot capture
 * (Supabase Storage bucket ensure + upload + signed URL) and the GitHub Actions
 * worker dispatch (run-mode normalisation, config, repository_dispatch). Deps:
 * Supabase client + getErrMsg + Deno.env/fetch + portal types. Behaviour-preserving.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { getErrMsg } from './shared-logger-utils.ts';
import type { PortalSyncJob, PortalJobRunMode } from './integrations-portal-types.ts';

const PORTAL_LIVE_VIEW_BUCKET = 'make-91ed8379-portal-live-view';
let portalLiveViewBucketInitialized = false;

export async function ensurePortalLiveViewBucket(): Promise<void> {
  if (portalLiveViewBucketInitialized) return;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === PORTAL_LIVE_VIEW_BUCKET);
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(PORTAL_LIVE_VIEW_BUCKET, {
        public: false,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      });
      if (error && !error.message?.includes('already exists')) {
        throw error;
      }
    }
    portalLiveViewBucketInitialized = true;
  } catch (error) {
    const message = getErrMsg(error);
    if (message.includes('already exists')) {
      portalLiveViewBucketInitialized = true;
      return;
    }
    throw error;
  }
}

export function sanitisePortalLiveViewValue(value: unknown, maxLength: number): string | undefined {
  const text = String(value || '')
    .trim()
    .slice(0, maxLength);
  return text || undefined;
}

export async function uploadPortalLiveView(
  job: PortalSyncJob,
  file: File,
  metadata: {
    pageUrl?: unknown;
    pageTitle?: unknown;
    note?: unknown;
  } = {},
): Promise<PortalJobLiveView> {
  await ensurePortalLiveViewBucket();

  const contentType = String(file.type || 'image/jpeg')
    .trim()
    .toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(contentType)) {
    throw new Error('Portal live view must be a JPEG or PNG screenshot.');
  }
  if (file.size > 5242880) {
    throw new Error('Portal live view exceeds the 5MB limit.');
  }

  const bytes = await file.arrayBuffer();
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  const storageKey = `portal-jobs/${job.id}/live-view.${extension}`;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: uploadError } = await supabase.storage
    .from(PORTAL_LIVE_VIEW_BUCKET)
    .upload(storageKey, bytes, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Portal live view upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(PORTAL_LIVE_VIEW_BUCKET)
    .createSignedUrl(storageKey, 3600);

  if (signedError || !signed?.signedUrl) {
    throw new Error(
      `Portal live view signed URL failed: ${signedError?.message || 'missing signed URL'}`,
    );
  }

  return {
    storageKey,
    signedUrl: signed.signedUrl,
    contentType,
    capturedAt: new Date().toISOString(),
    pageUrl: sanitisePortalLiveViewValue(metadata.pageUrl, 1000),
    pageTitle: sanitisePortalLiveViewValue(metadata.pageTitle, 240),
    note: sanitisePortalLiveViewValue(metadata.note, 500),
  };
}

export function normaliseRunMode(value: unknown): PortalJobRunMode {
  return value === 'dry-run' || value === 'run' ? value : 'discover';
}

export function getPortalGitHubActionsConfig() {
  const token = String(
    Deno.env.get('NW_GITHUB_ACTIONS_TOKEN') || Deno.env.get('GITHUB_ACTIONS_DISPATCH_TOKEN') || '',
  ).trim();
  const repo = String(
    Deno.env.get('NW_GITHUB_ACTIONS_REPO') || 'ShawnDaPrawn/NavigateWealth',
  ).trim();
  const workflowId = String(
    Deno.env.get('NW_GITHUB_ACTIONS_WORKFLOW_ID') || 'provider-portal-worker.yml',
  ).trim();
  const ref = String(Deno.env.get('NW_GITHUB_ACTIONS_REF') || 'main').trim();
  const apiBase = String(
    Deno.env.get('NW_GITHUB_ACTIONS_API_BASE') || 'https://api.github.com',
  ).replace(/\/$/, '');
  return { token, repo, workflowId, ref, apiBase };
}

export async function dispatchPortalGitHubAction(
  job: PortalSyncJob,
): Promise<Partial<PortalSyncJob>> {
  const { token, repo, workflowId, ref, apiBase } = getPortalGitHubActionsConfig();
  if (!token || !repo || !workflowId || !ref) {
    return {
      automationHost: 'manual',
      actionsDispatchError:
        'GitHub Actions dispatch is not configured. Set NW_GITHUB_ACTIONS_TOKEN on the Supabase Edge Function.',
      message: 'Portal job queued, but GitHub Actions dispatch is not configured yet.',
    };
  }

  const response = await fetch(
    `${apiBase}/repos/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      body: JSON.stringify({
        ref,
        return_run_details: true,
        inputs: {
          job_id: job.id,
          run_mode: normaliseRunMode(job.runMode),
          api_base:
            'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/integrations',
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const rawMessage =
      typeof data.message === 'string'
        ? data.message
        : `GitHub dispatch failed with HTTP ${response.status}`;
    const message =
      rawMessage === 'Bad credentials'
        ? 'GitHub rejected NW_GITHUB_ACTIONS_TOKEN. Replace the Supabase Edge Function secret with a valid fine-grained GitHub token for ShawnDaPrawn/NavigateWealth with Actions: Read and write.'
        : rawMessage;
    return {
      automationHost: 'manual',
      actionsDispatchError: message.slice(0, 500),
      message: `Portal job queued, but GitHub Actions did not start: ${message}`.slice(0, 500),
    };
  }

  return {
    automationHost: 'github_actions',
    workerId: 'github-actions',
    actionsRunId: typeof data.workflow_run_id === 'number' ? data.workflow_run_id : undefined,
    actionsRunUrl:
      typeof data.html_url === 'string'
        ? data.html_url
        : `https://github.com/${repo}/actions/workflows/${workflowId}`,
    actionsDispatchError: undefined,
    message: 'Portal job queued. GitHub Actions is starting the Playwright worker.',
  };
}
