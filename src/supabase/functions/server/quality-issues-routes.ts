import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin, requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  type QualityIssueAutomationRun,
  type QualityIssue,
} from '../../../shared/quality/qualityIssues.ts';
import { createKvRepository } from './repositories/kv-repository.ts';
import {
  RUNTIME_CLIENT_PUBLIC_IP_LIMIT_PER_HOUR,
  checkIpOnlyRateLimit,
} from './public-form-rate-limit.ts';
import { buildRuntimeClientIssue, trimRuntimeIssues } from './quality-issues-runtime-client.ts';

import {
  ISSUE_WORKFLOW_KEY,
  LATEST_SNAPSHOT_KEY,
  MAX_PUBLIC_RUNTIME_ISSUES,
  MAX_RUNTIME_ISSUES,
  MAX_SECURITY_FEED_ISSUES,
  RUNTIME_CLIENT_ISSUES_KEY,
  RUNTIME_CLIENT_PUBLIC_KEY_PREFIX,
  SECURITY_FEED_ISSUES_KEY,
  normalizeSecurityFeed,
  normalizeSnapshot,
  normalizeWorkflowMap,
  normalizeWorkflowUpdate,
} from './quality-issues-normalize.ts';
import { mergeWorkflowState } from './quality-issues-automation.ts';
import { buildCurrentSnapshot, runAutomationOnCurrentState } from './quality-issues-state.ts';
import { constantTimeEqual } from './crypto-utils.ts';

const app = new Hono();
const log = createModuleLogger('quality-issues');

/** Signed-out browser reports: one row per fingerprint, see the route below. */
const publicRuntimeRepo = createKvRepository<QualityIssue>(RUNTIME_CLIENT_PUBLIC_KEY_PREFIX);

function hasValidIngestToken(c: Context): boolean {
  const expectedToken = Deno.env.get('QUALITY_ISSUES_INGEST_TOKEN');
  if (!expectedToken) {
    return false;
  }

  const bearerToken = c.req
    .header('Authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  const headerToken = c.req.header('X-Quality-Ingest-Token')?.trim();
  // Constant-time, like every other shared-secret check here (M-1).
  return (
    (!!bearerToken && constantTimeEqual(bearerToken, expectedToken)) ||
    (!!headerToken && constantTimeEqual(headerToken, expectedToken))
  );
}

app.get(
  '/',
  requireAdmin,
  asyncHandler(async (c) => {
    const current = await buildCurrentSnapshot();

    return c.json({
      success: true,
      snapshot: current.snapshot,
    });
  }),
);

app.post(
  '/automation/run',
  requireAdmin,
  asyncHandler(async (c) => {
    const user = c.get('user') as { id?: string; email?: string } | undefined;
    const actorLabel = user?.email || user?.id || 'admin';
    const result = await runAutomationOnCurrentState(actorLabel);

    log.info('Quality issue automation completed', {
      activeAlerts: result.automation.activeAlerts,
      criticalAlerts: result.automation.criticalAlerts,
      tasksCreated: result.automation.tasksCreated,
      actor: actorLabel,
    });

    return c.json({
      success: true,
      automation: result.automation,
      snapshot: result.snapshot,
    });
  }),
);

app.post(
  '/ingest-ci-report',
  asyncHandler(async (c) => {
    if (!hasValidIngestToken(c)) {
      return c.json({ success: false, error: 'Unauthorized quality issue ingest request' }, 401);
    }

    const body = await c.req.json();
    const snapshot = normalizeSnapshot(body);
    await kv.set(LATEST_SNAPSHOT_KEY, snapshot);
    let automation: QualityIssueAutomationRun | undefined;

    try {
      automation = (await runAutomationOnCurrentState('quality-feed')).automation;
    } catch (error) {
      log.error('Quality issue automation failed after CI ingest', error as Error);
    }

    log.info('Quality issue snapshot ingested', {
      total: snapshot.summary.total,
      errors: snapshot.summary.errors,
      warnings: snapshot.summary.warnings,
      runId: snapshot.runId,
      automationAlerts: automation?.activeAlerts,
    });

    return c.json({ success: true, snapshot, automation });
  }),
);

app.post(
  '/ingest-security-report',
  asyncHandler(async (c) => {
    if (!hasValidIngestToken(c)) {
      return c.json({ success: false, error: 'Unauthorized security issue ingest request' }, 401);
    }

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const issues = normalizeSecurityFeed(body)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, MAX_SECURITY_FEED_ISSUES);

    await kv.set(SECURITY_FEED_ISSUES_KEY, issues);
    let automation: QualityIssueAutomationRun | undefined;

    try {
      automation = (await runAutomationOnCurrentState('quality-feed')).automation;
    } catch (error) {
      log.error('Quality issue automation failed after security ingest', error as Error);
    }

    log.info('Security issue feed ingested', {
      total: issues.length,
      detectedBy: typeof body.detectedBy === 'string' ? body.detectedBy : body.tool,
      automationAlerts: automation?.activeAlerts,
    });

    return c.json({ success: true, issues, automation });
  }),
);

app.patch(
  '/workflow',
  requireAdmin,
  asyncHandler(async (c) => {
    const update = normalizeWorkflowUpdate(await c.req.json().catch(() => null));
    if (!update) {
      return c.json({ success: false, error: 'A valid issue fingerprint is required' }, 400);
    }

    const currentWorkflowState = normalizeWorkflowMap(await kv.get(ISSUE_WORKFLOW_KEY));
    const user = c.get('user') as { id?: string; email?: string } | undefined;
    const actorLabel = user?.email || user?.id || 'admin';
    const workflow = mergeWorkflowState(
      currentWorkflowState[update.fingerprint],
      update,
      actorLabel,
    );

    currentWorkflowState[update.fingerprint] = workflow;
    await kv.set(ISSUE_WORKFLOW_KEY, currentWorkflowState);

    log.info('Quality issue workflow updated', {
      fingerprint: update.fingerprint,
      status: workflow.status,
      ownerName: workflow.ownerName,
      linkedTaskId: workflow.linkedTaskId,
      actor: actorLabel,
    });

    return c.json({ success: true, workflow });
  }),
);

app.post(
  '/runtime-client',
  requireAuth,
  asyncHandler(async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const user = c.get('user') as { id?: string; email?: string } | undefined;
    const currentIssues = (await kv.get(RUNTIME_CLIENT_ISSUES_KEY)) as QualityIssue[] | null;
    const issues = Array.isArray(currentIssues) ? currentIssues : [];

    const { issue: nextIssue } = buildRuntimeClientIssue(
      body,
      { userId: user?.id, userEmail: user?.email, anonymous: false },
      (fingerprint, id) =>
        issues.find((issue) => issue.fingerprint === fingerprint || issue.id === id),
    );

    const nextIssues = [
      nextIssue,
      ...issues.filter(
        (issue) => issue.fingerprint !== nextIssue.fingerprint && issue.id !== nextIssue.id,
      ),
    ];

    await kv.set(RUNTIME_CLIENT_ISSUES_KEY, trimRuntimeIssues(nextIssues, MAX_RUNTIME_ISSUES));

    log.warn('Runtime client issue ingested', {
      id: nextIssue.id,
      title: nextIssue.title,
      userId: user?.id,
      occurrences: nextIssue.occurrences,
    });

    return c.json({ success: true, issue: nextIssue });
  }),
);

/**
 * POST /runtime-client/public — the same report from a SIGNED-OUT browser.
 *
 * Unauthenticated by necessity: the login page, the public site and the
 * e-sign signer flow all run without a session, and errors there were being
 * dropped on the floor. Bounded like the CSP endpoint: IP rate-limited, one
 * row per fingerprint under its own prefix (a burst cannot evict signed-in
 * reports), a hard cap on stored rows, and URLs stripped to origin + path.
 *
 * Always answers 204 so a prober learns nothing about the limit.
 */
app.post(
  '/runtime-client/public',
  asyncHandler(async (c) => {
    const limit = await checkIpOnlyRateLimit(
      'runtime-client',
      (name) => c.req.header(name),
      RUNTIME_CLIENT_PUBLIC_IP_LIMIT_PER_HOUR,
    );
    if (!limit.allowed) return c.body(null, 204);

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || typeof body.message !== 'string') {
      return c.body(null, 204);
    }

    // Look the fingerprint up first, then build against that one row.
    const probe = buildRuntimeClientIssue(body, { anonymous: true }, () => undefined);
    const existing = (await publicRuntimeRepo.get(probe.fingerprint)) ?? undefined;
    const { issue } = buildRuntimeClientIssue(body, { anonymous: true }, () => existing);
    await publicRuntimeRepo.put(probe.fingerprint, issue);
    await trimPublicRuntimeIssues();

    log.warn('Public runtime client issue ingested', {
      title: issue.title,
      occurrences: issue.occurrences,
    });

    return c.body(null, 204);
  }),
);

async function trimPublicRuntimeIssues(): Promise<void> {
  const rows = (await publicRuntimeRepo.listAll('trim public runtime issues to cap')).filter(
    Boolean,
  );
  if (rows.length <= MAX_PUBLIC_RUNTIME_ISSUES) return;
  const kept = new Set(
    trimRuntimeIssues(rows, MAX_PUBLIC_RUNTIME_ISSUES).map((issue) => issue.fingerprint),
  );
  for (const issue of rows) {
    if (!kept.has(issue.fingerprint)) await publicRuntimeRepo.remove(issue.fingerprint);
  }
}

export default app;
