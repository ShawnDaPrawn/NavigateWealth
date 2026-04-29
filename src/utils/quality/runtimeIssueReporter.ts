import { supabaseUrl } from '../supabase/info';
import { createClient } from '../supabase/client';

const API_BASE = `${supabaseUrl}/functions/v1/make-server-91ed8379`;
const REPORT_ENDPOINT = `${API_BASE}/quality-issues/runtime-client`;
const MAX_FIELD_LENGTH = 1600;
const SEND_DEBOUNCE_MS = 10000;

type RuntimeIssueKind = 'window-error' | 'unhandled-rejection' | 'react-error-boundary';

export interface RuntimeClientIssueInput {
  kind: RuntimeIssueKind;
  title?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

const recentlySent = new Map<string, number>();

function truncate(value: string | undefined, maxLength = MAX_FIELD_LENGTH): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function shouldSend(issue: RuntimeClientIssueInput): boolean {
  const key = [
    issue.kind,
    issue.message,
    issue.filePath || window.location.pathname,
    issue.line,
    issue.column,
  ].join(':');
  const now = Date.now();
  const lastSentAt = recentlySent.get(key) || 0;

  if (now - lastSentAt < SEND_DEBOUNCE_MS) {
    return false;
  }

  recentlySent.set(key, now);
  return true;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value || {}));
  } catch {
    return String(value);
  }
}

export async function reportRuntimeClientIssue(issue: RuntimeClientIssueInput): Promise<void> {
  if (typeof window === 'undefined' || !shouldSend(issue)) {
    return;
  }

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return;
    }

    await fetch(REPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        kind: issue.kind,
        title: truncate(issue.title, 240),
        message: truncate(issue.message),
        stack: truncate(issue.stack, 3000),
        componentStack: truncate(issue.componentStack, 3000),
        filePath: truncate(issue.filePath || window.location.pathname, 240),
        line: issue.line,
        column: issue.column,
        href: truncate(window.location.href, 500),
        userAgent: truncate(window.navigator.userAgent, 500),
      }),
      keepalive: true,
    });
  } catch {
    // Runtime reporting must never create a second user-facing failure.
  }
}

export function runtimeIssueFromUnknown(kind: RuntimeIssueKind, reason: unknown): RuntimeClientIssueInput {
  if (reason instanceof Error) {
    return {
      kind,
      title: reason.name || 'Runtime error',
      message: reason.message || 'Unhandled runtime error',
      stack: reason.stack,
    };
  }

  const message = stringifyUnknown(reason);

  return {
    kind,
    title: 'Runtime error',
    message: message || 'Unhandled runtime error',
  };
}
