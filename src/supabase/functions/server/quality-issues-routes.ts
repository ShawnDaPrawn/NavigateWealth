import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin, requireAuth } from './auth-mw.ts';
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
const RUNTIME_CLIENT_ISSUES_KEY = 'quality_issues:runtime_client';
const MAX_RUNTIME_ISSUES = 100;

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

function issueId(parts: unknown[]): string {
  return parts
    .filter(Boolean)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .slice(0, 180);
}

function asTrimmedString(value: unknown, fallback = '', maxLength = 1600): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function combineSnapshots(
  ciSnapshot: QualityIssueSnapshot,
  runtimeIssues: QualityIssue[],
): QualityIssueSnapshot {
  const issues = [...ciSnapshot.issues, ...runtimeIssues];

  return {
    ...ciSnapshot,
    generatedAt: new Date().toISOString(),
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
  const runtimeIssues = await kv.get(RUNTIME_CLIENT_ISSUES_KEY) as QualityIssue[] | null;

  return c.json({
    success: true,
    snapshot: combineSnapshots(
      snapshot || createEmptyQualityIssueSnapshot(),
      Array.isArray(runtimeIssues) ? runtimeIssues : [],
    ),
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

app.post('/runtime-client', requireAuth, asyncHandler(async (c) => {
  const now = new Date().toISOString();
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
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
  ].filter(Boolean).join('\n\n');
  const id = issueId(['runtime-client', kind, message, filePath, line, column]);
  const currentIssues = await kv.get(RUNTIME_CLIENT_ISSUES_KEY) as QualityIssue[] | null;
  const issues = Array.isArray(currentIssues) ? currentIssues : [];
  const existingIndex = issues.findIndex((issue) => issue.id === id);

  const nextIssue: QualityIssue = {
    id,
    source: 'runtime-client',
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

  const nextIssues = existingIndex >= 0
    ? issues.map((issue, index) => index === existingIndex ? nextIssue : issue)
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
}));

export default app;
