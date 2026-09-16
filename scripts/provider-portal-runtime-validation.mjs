export class PortalConfigurationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'PortalConfigurationError';
    this.issues = issues;
  }
}

export function isPortalConfigurationError(error) {
  return error instanceof PortalConfigurationError || error?.name === 'PortalConfigurationError';
}

export function isHttpUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return false;

  try {
    const parsed = new URL(rawValue);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function hasCredentialProfile(flow) {
  return (
    Array.isArray(flow?.credentialProfiles) &&
    flow.credentialProfiles.some((profile) => hasValue(profile?.id))
  );
}

/**
 * `requireLoginSelectors` exists for the connection test, and for nothing else.
 *
 * A connection test runs at the one moment a provider is least configured: an
 * adviser has just typed in a portal address and a password and wants to know
 * whether they work. Demanding three CSS selectors first makes the diagnostic
 * useless exactly when it is needed, so a connection test is allowed to start
 * without them and the worker falls back to generic sign-in field guesses.
 *
 * A real run keeps the strict requirement. There a guessed field could be
 * filled with something that does not belong in it, and unlike a connection
 * test a real run goes on to write to the book.
 */
export function getPortalRuntimeConfigurationIssues(flow, options = {}) {
  const requireLoginSelectors = options.requireLoginSelectors !== false;
  const issues = [];

  if (!isHttpUrl(flow?.loginUrl)) {
    issues.push('Portal login URL is not configured as a valid http(s) URL.');
  }

  if (!hasCredentialProfile(flow)) {
    issues.push('Portal credential profile is not configured.');
  }

  if (!requireLoginSelectors) return issues;

  if (!hasValue(flow?.login?.usernameSelector)) {
    issues.push('Portal username selector is not configured.');
  }

  if (!hasValue(flow?.login?.passwordSelector)) {
    issues.push('Portal password selector is not configured.');
  }

  if (!hasValue(flow?.login?.submitSelector)) {
    issues.push('Portal login submit selector is not configured.');
  }

  return issues;
}

export function assertPortalRuntimeConfigured(flow, options = {}) {
  const issues = getPortalRuntimeConfigurationIssues(flow, options);
  if (issues.length === 0) return;

  throw new PortalConfigurationError(
    `Portal flow is not ready for automation: ${issues.join(' ')}`,
    issues,
  );
}
