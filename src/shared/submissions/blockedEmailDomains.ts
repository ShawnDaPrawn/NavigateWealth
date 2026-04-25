const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BLOCKED_EMAIL_DOMAINS = ['test.com', 'poisonword.com'] as const;

export function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();

  if (!SIMPLE_EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex === -1 || atIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(atIndex + 1);
}

export function getBlockedEmailDomain(email: string): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) {
    return null;
  }

  return BLOCKED_EMAIL_DOMAINS.some(
    (blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`),
  )
    ? domain
    : null;
}

export function getBlockedEmailDomainWarning(domain: string): string {
  return `Submissions from ${domain} are blocked because this domain has been flagged for scam activity. Please use a different email address or contact Navigate Wealth directly.`;
}
