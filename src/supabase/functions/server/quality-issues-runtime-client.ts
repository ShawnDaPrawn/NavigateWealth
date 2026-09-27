/**
 * ****************************************************************************
 * RUNTIME CLIENT ISSUE BUILDER
 * ****************************************************************************
 *
 * Turns one browser report into a labelled, deduplicated `QualityIssue`. Shared
 * by the two ingest routes in quality-issues-routes.ts:
 *
 *   - `POST /runtime-client`         signed-in users (requireAuth), stored in
 *                                    the long-standing single row;
 *   - `POST /runtime-client/public`  signed-out visitors (public site, login
 *                                    page, e-sign landing), IP rate-limited and
 *                                    stored one row per fingerprint under its
 *                                    own prefix so a burst can never evict the
 *                                    signed-in reports.
 *
 * Before the public route existed, the browser reporter silently dropped every
 * error raised while nobody was signed in — which is exactly when the login
 * page, the marketing site and the signer flow run.
 *
 * PRIVACY: URLs are reduced to origin + path (plus the admin `module` param),
 * and breadcrumbs are clipped the same way. The e-sign signer URL carries its
 * credential in `?token=`; see csp-report-routes.ts for why that matters.
 */

import {
  createQualityIssueFingerprint,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  type QualityIssue,
  type QualityIssueSeverity,
} from '../../../shared/quality/qualityIssues.ts';
import {
  cleanErrorMessage,
  describeRuntimeIssue,
  normalizeMessageForGrouping,
  normalizeRoutePath,
} from '../../../shared/quality/issueLabels.ts';
import {
  MAX_AFFECTED_USER_IDS,
  MAX_BREADCRUMBS,
  asOptionalNumber,
  asTrimmedString,
  issueId,
} from './quality-issues-normalize.ts';

/** Kinds the browser reporter may send. Anything else is filed as window-error. */
const CLIENT_KINDS = new Set([
  'window-error',
  'unhandled-rejection',
  'react-error-boundary',
  'handled-error',
  'api-failure',
]);

/** Query parameters worth keeping: they name the screen, never a credential. */
const SAFE_QUERY_PARAMS = ['module', 'tab', 'view'];

/**
 * Reduce a URL to origin + path (+ the few params that name a screen). Anything
 * that does not parse is stripped at the first `?` or `#`.
 */
export function stripSensitiveUrl(raw: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const kept = SAFE_QUERY_PARAMS.filter((key) => url.searchParams.has(key))
      .map((key) => `${key}=${encodeURIComponent(url.searchParams.get(key) || '')}`)
      .join('&');
    return `${url.origin}${url.pathname}${kept ? `?${kept}` : ''}`.slice(0, 500);
  } catch {
    return raw.split(/[?#]/)[0].slice(0, 500);
  }
}

/** Strip query strings from any URL-looking token inside free text. */
function stripUrlsInText(text: string): string {
  return text.replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1');
}

export interface ClientIssueReporter {
  userId?: string;
  userEmail?: string;
  anonymous: boolean;
}

export interface BuiltClientIssue {
  issue: QualityIssue;
  fingerprint: string;
}

/**
 * Build the issue for one report, merged with the existing row for the same
 * fingerprint (if any). Pure apart from `now`.
 */
export function buildRuntimeClientIssue(
  body: Record<string, unknown>,
  reporter: ClientIssueReporter,
  findExisting: (fingerprint: string, id: string) => QualityIssue | undefined,
  now = new Date().toISOString(),
): BuiltClientIssue {
  const rawKind = asTrimmedString(body.kind, 'window-error', 80);
  const kind = CLIENT_KINDS.has(rawKind) ? rawKind : 'window-error';
  const message = asTrimmedString(body.message, 'Client runtime error');
  const errorName = asTrimmedString(body.errorName ?? body.title, '', 120);
  const context = asTrimmedString(body.context, '', 240);
  const href = stripSensitiveUrl(asTrimmedString(body.href, '', 1000));
  const rawFilePath = asTrimmedString(body.filePath, '', 400);
  const filePath = rawFilePath ? stripSensitiveUrl(rawFilePath) : 'browser';
  const line = asOptionalNumber(body.line);
  const column = asOptionalNumber(body.column);
  const stack = stripUrlsInText(asTrimmedString(body.stack, '', 3000));
  const componentStack = asTrimmedString(body.componentStack, '', 3000);
  const userAgent = asTrimmedString(body.userAgent, '', 500);
  const release = asTrimmedString(body.release, '', 80);
  const apiMethod = asTrimmedString(body.method, '', 10);
  const apiPath = asTrimmedString(body.path, '', 400);
  const statusCode = asOptionalNumber(body.statusCode);
  const severity: QualityIssueSeverity =
    body.severity === 'warning' || kind === 'handled-error' ? 'warning' : 'error';
  const breadcrumbs = Array.isArray(body.breadcrumbs)
    ? body.breadcrumbs
        .filter((entry): entry is string => typeof entry === 'string')
        .slice(-MAX_BREADCRUMBS)
        .map((entry) => stripUrlsInText(entry).slice(0, 300))
    : [];

  const labels = describeRuntimeIssue({
    kind,
    errorName,
    message,
    context,
    stack,
    componentStack,
    href,
    method: apiMethod || undefined,
    path: kind === 'api-failure' ? apiPath : undefined,
    statusCode,
  });

  // Group by WHAT failed and WHERE, not by which record it failed on: the
  // message shape (ids and numbers collapsed) plus the screen or API route.
  // Line/column are left out on purpose — they change on every deploy of a
  // minified bundle, which used to split one bug into a new issue per release.
  const where =
    kind === 'api-failure'
      ? `${apiMethod.toUpperCase()} ${normalizeRoutePath(apiPath)}`
      : labels.area || normalizeRoutePath(href) || filePath;
  const ruleId = kind;
  const category = inferQualityIssueCategory('runtime-client', ruleId);
  const priority = inferQualityIssuePriority({ source: 'runtime-client', severity, category });
  const fingerprint = createQualityIssueFingerprint({
    source: 'runtime-client',
    category,
    ruleId,
    title: normalizeMessageForGrouping(
      `${context ? `${context} ` : ''}${cleanErrorMessage(message)}`,
    ),
    filePath: where,
  });
  const id = issueId(['runtime-client', fingerprint]);
  const existing = findExisting(fingerprint, id);

  const affected = new Set(existing?.affectedUserIds ?? []);
  if (reporter.userId && affected.size < MAX_AFFECTED_USER_IDS) affected.add(reporter.userId);
  const affectedUserIds = [...affected];
  const affectedUsers = Math.max(existing?.affectedUsers ?? 0, affectedUserIds.length);

  const details = [
    href ? `URL: ${href}` : '',
    kind === 'api-failure' && apiPath
      ? `Request: ${apiMethod.toUpperCase()} ${stripSensitiveUrl(apiPath)}${statusCode ? ` → ${statusCode}` : ''}`
      : '',
    reporter.userEmail
      ? `Last reported by: ${reporter.userEmail}`
      : reporter.anonymous
        ? 'Last reported by: signed-out visitor'
        : '',
    release ? `Release: ${release}` : '',
    userAgent ? `Browser: ${userAgent}` : '',
    rawFilePath && line ? `Source: ${filePath}:${line}${column ? `:${column}` : ''}` : '',
    componentStack ? `Component stack:\n${componentStack}` : '',
    stack ? `Stack:\n${stack}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const issue: QualityIssue = {
    id,
    source: 'runtime-client',
    category,
    priority,
    fingerprint,
    severity,
    status: 'open',
    title: labels.title,
    message: cleanErrorMessage(message).slice(0, 2000) || message.slice(0, 2000),
    summary: labels.summary,
    likelyCause: labels.likelyCause,
    area: labels.area,
    route: labels.route,
    details: details.slice(0, 8000),
    breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : existing?.breadcrumbs,
    affectedUsers: affectedUsers > 0 ? affectedUsers : undefined,
    affectedUserIds: affectedUserIds.length > 0 ? affectedUserIds : undefined,
    anonymous: reporter.anonymous || undefined,
    filePath,
    line,
    column,
    ruleId,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    occurrences: (existing?.occurrences ?? 0) + 1,
  };

  return { issue, fingerprint };
}

/**
 * Keep crashes over handled warnings when a capped list must shrink: sort by
 * severity first, then recency, and cut.
 */
export function trimRuntimeIssues(issues: QualityIssue[], cap: number): QualityIssue[] {
  const rank = (issue: QualityIssue) => (issue.severity === 'error' ? 0 : 1);
  const kept = [...issues]
    .sort((a, b) => rank(a) - rank(b) || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, cap);
  return kept.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
