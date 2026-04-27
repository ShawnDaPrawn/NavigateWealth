import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  createEmptyQualityIssueSnapshot,
  summarizeQualityIssues,
  type QualityIssue,
  type QualityIssueSeverity,
  type QualityIssueSnapshot,
  type QualityIssueSource,
  type QualityIssueStatus,
} from '../../../shared/quality/qualityIssues.ts';

const app = new Hono();
const log = createModuleLogger('quality-issues');
const LATEST_SNAPSHOT_KEY = 'quality_issues:latest_snapshot';

function isValidSource(source: unknown): source is QualityIssueSource {
  return [
    'build',
    'test',
    'audit',
    'accessibility',
    'runtime-client',
    'runtime-server',
  ].includes(String(source));
}

function isValidSeverity(severity: unknown): severity is QualityIssueSeverity {
  return ['error', 'warning', 'info'].includes(String(severity));
}

function isValidStatus(status: unknown): status is QualityIssueStatus {
  return ['open', 'acknowledged', 'resolved'].includes(String(status));
}

function normalizeIssue(rawIssue: Record<string, unknown>, index: number, now: string): QualityIssue {
  const source = isValidSource(rawIssue.source) ? rawIssue.source : 'build';
  const severity = isValidSeverity(rawIssue.severity) ? rawIssue.severity : 'error';
  const status = isValidStatus(rawIssue.status) ? rawIssue.status : 'open';
  const title = typeof rawIssue.title === 'string' && rawIssue.title.trim()
    ? rawIssue.title.trim()
    : `${source} issue`;
  const message = typeof rawIssue.message === 'string' && rawIssue.message.trim()
    ? rawIssue.message.trim()
    : title;
  const filePath = typeof rawIssue.filePath === 'string' && rawIssue.filePath.trim()
    ? rawIssue.filePath.trim()
    : undefined;
  const ruleId = typeof rawIssue.ruleId === 'string' && rawIssue.ruleId.trim()
    ? rawIssue.ruleId.trim()
    : undefined;

  return {
    id: typeof rawIssue.id === 'string' && rawIssue.id.trim()
      ? rawIssue.id.trim()
      : `${source}:${ruleId || title}:${filePath || 'repo'}:${index}`,
    source,
    severity,
    status,
    title,
    message,
    filePath,
    line: typeof rawIssue.line === 'number' ? rawIssue.line : undefined,
    column: typeof rawIssue.column === 'number' ? rawIssue.column : undefined,
    ruleId,
    firstSeenAt: typeof rawIssue.firstSeenAt === 'string' ? rawIssue.firstSeenAt : now,
    lastSeenAt: typeof rawIssue.lastSeenAt === 'string' ? rawIssue.lastSeenAt : now,
    occurrences: typeof rawIssue.occurrences === 'number' && rawIssue.occurrences > 0
      ? Math.floor(rawIssue.occurrences)
      : 1,
    runUrl: typeof rawIssue.runUrl === 'string' ? rawIssue.runUrl : undefined,
  };
}

function normalizeSnapshot(rawSnapshot: Record<string, unknown>): QualityIssueSnapshot {
  const now = new Date().toISOString();
  const rawIssues = Array.isArray(rawSnapshot.issues) ? rawSnapshot.issues : [];
  const issues = rawIssues
    .filter((issue): issue is Record<string, unknown> => issue !== null && typeof issue === 'object')
    .map((issue, index) => normalizeIssue(issue, index, now));

  return {
    generatedAt: typeof rawSnapshot.generatedAt === 'string' ? rawSnapshot.generatedAt : now,
    runId: typeof rawSnapshot.runId === 'string' ? rawSnapshot.runId : undefined,
    runUrl: typeof rawSnapshot.runUrl === 'string' ? rawSnapshot.runUrl : undefined,
    branch: typeof rawSnapshot.branch === 'string' ? rawSnapshot.branch : undefined,
    commitSha: typeof rawSnapshot.commitSha === 'string' ? rawSnapshot.commitSha : undefined,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

function hasValidIngestToken(c: Context): boolean {
  const expectedToken = Deno.env.get('QUALITY_ISSUES_INGEST_TOKEN');
  if (!expectedToken) {
    return false;
  }

  const bearerToken = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerToken = c.req.header('X-Quality-Ingest-Token')?.trim();
  return bearerToken === expectedToken || headerToken === expectedToken;
}

app.get('/', requireAdmin, asyncHandler(async (c) => {
  const snapshot = await kv.get(LATEST_SNAPSHOT_KEY) as QualityIssueSnapshot | null;
  return c.json({
    success: true,
    snapshot: snapshot || createEmptyQualityIssueSnapshot(),
  });
}));

app.post('/ingest-ci-report', asyncHandler(async (c) => {
  if (!hasValidIngestToken(c)) {
    return c.json({ success: false, error: 'Unauthorized quality issue ingest request' }, 401);
  }

  const body = await c.req.json();
  const snapshot = normalizeSnapshot(body);
  await kv.set(LATEST_SNAPSHOT_KEY, snapshot);

  log.info('Quality issue snapshot ingested', {
    total: snapshot.summary.total,
    errors: snapshot.summary.errors,
    warnings: snapshot.summary.warnings,
    runId: snapshot.runId,
  });

  return c.json({ success: true, snapshot });
}));

export default app;
