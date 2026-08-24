import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin, requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  createQualityIssueFingerprint,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  type QualityIssueAutomationRun,
  type QualityIssue,
} from '../../../shared/quality/qualityIssues.ts';

import {
  ISSUE_WORKFLOW_KEY,
  LATEST_SNAPSHOT_KEY,
  MAX_RUNTIME_ISSUES,
  MAX_SECURITY_FEED_ISSUES,
  RUNTIME_CLIENT_ISSUES_KEY,
  SECURITY_FEED_ISSUES_KEY,
  asOptionalNumber,
  asTrimmedString,
  issueId,
  normalizeSecurityFeed,
  normalizeSnapshot,
  normalizeWorkflowMap,
  normalizeWorkflowUpdate,
} from './quality-issues-normalize.ts';
import { mergeWorkflowState } from './quality-issues-automation.ts';
import { buildCurrentSnapshot, runAutomationOnCurrentState } from './quality-issues-state.ts';

const app = new Hono();
const log = createModuleLogger('quality-issues');

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
  return bearerToken === expectedToken || headerToken === expectedToken;
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
    const now = new Date().toISOString();
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const kind = asTrimmedString(body.kind, 'window-error', 80);
    const message = asTrimmedString(body.message, 'Client runtime error');
    const filePath = asTrimmedString(body.filePath, 'browser', 240);
    const line = asOptionalNumber(body.line);
    const column = asOptionalNumber(body.column);
    const title = asTrimmedString(body.title, 'Client runtime error', 240);
    const stack = asTrimmedString(body.stack, '', 3000);
    const componentStack = asTrimmedString(body.componentStack, '', 3000);
    const href = asTrimmedString(body.href, '', 500);
    const userAgent = asTrimmedString(body.userAgent, '', 500);
    const user = c.get('user') as { id?: string; email?: string } | undefined;
    const userEmail = user?.email ? `\nUser: ${user.email}` : '';
    const context = [
      href ? `URL: ${href}` : '',
      userAgent ? `User-Agent: ${userAgent}` : '',
      componentStack ? `Component stack:\n${componentStack}` : '',
      stack ? `Stack:\n${stack}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    const id = issueId(['runtime-client', kind, message, filePath, line, column]);
    const category = inferQualityIssueCategory('runtime-client', kind);
    const priority = inferQualityIssuePriority({
      source: 'runtime-client',
      severity: 'error',
      category,
    });
    const fingerprint = createQualityIssueFingerprint({
      source: 'runtime-client',
      category,
      ruleId: kind,
      title,
      filePath,
      line,
      column,
    });
    const currentIssues = (await kv.get(RUNTIME_CLIENT_ISSUES_KEY)) as QualityIssue[] | null;
    const issues = Array.isArray(currentIssues) ? currentIssues : [];
    const existingIndex = issues.findIndex(
      (issue) => issue.fingerprint === fingerprint || issue.id === id,
    );

    const nextIssue: QualityIssue = {
      id,
      source: 'runtime-client',
      category,
      priority,
      fingerprint,
      severity: 'error',
      status: 'open',
      title,
      message: `${message}${userEmail}${context ? `\n\n${context}` : ''}`.slice(0, 5000),
      filePath,
      line,
      column,
      ruleId: kind,
      firstSeenAt: existingIndex >= 0 ? issues[existingIndex].firstSeenAt : now,
      lastSeenAt: now,
      occurrences: existingIndex >= 0 ? issues[existingIndex].occurrences + 1 : 1,
    };

    const nextIssues =
      existingIndex >= 0
        ? issues.map((issue, index) => (index === existingIndex ? nextIssue : issue))
        : [nextIssue, ...issues];

    const trimmedIssues = nextIssues
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, MAX_RUNTIME_ISSUES);

    await kv.set(RUNTIME_CLIENT_ISSUES_KEY, trimmedIssues);

    log.warn('Runtime client issue ingested', {
      id,
      title,
      userId: user?.id,
      occurrences: nextIssue.occurrences,
    });

    return c.json({ success: true, issue: nextIssue });
  }),
);

export default app;
