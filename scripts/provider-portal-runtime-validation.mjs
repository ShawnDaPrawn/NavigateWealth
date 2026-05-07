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
  return Array.isArray(flow?.credentialProfiles) && flow.credentialProfiles.some((profile) => hasValue(profile?.id));
}

export function getPortalRuntimeConfigurationIssues(flow) {
  const issues = [];

  if (!isHttpUrl(flow?.loginUrl)) {
    issues.push('Portal login URL is not configured as a valid http(s) URL.');
  }

  if (!hasCredentialProfile(flow)) {
    issues.push('Portal credential profile is not configured.');
  }

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

export function assertPortalRuntimeConfigured(flow) {
  const issues = getPortalRuntimeConfigurationIssues(flow);
  if (issues.length === 0) return;

  throw new PortalConfigurationError(
    `Portal flow is not ready for automation: ${issues.join(' ')}`,
    issues,
  );
}
