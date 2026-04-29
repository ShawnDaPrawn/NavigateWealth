type HeaderGetter = (headerName: string) => string | null | undefined;

export const BLOCKED_IP_ADDRESSES = ['105.224.67.241'] as const;

function stripIpv4Port(ipAddress: string): string {
  const ipv4WithPortMatch = ipAddress.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  return ipv4WithPortMatch ? ipv4WithPortMatch[1] : ipAddress;
}

export function normalizeIpAddress(ipAddress: string | null | undefined): string | null {
  if (!ipAddress) {
    return null;
  }

  const trimmed = ipAddress.trim();
  if (!trimmed) {
    return null;
  }

  const firstValue = trimmed.split(',')[0]?.trim();
  if (!firstValue) {
    return null;
  }

  const withoutIpv6Prefix = firstValue.startsWith('::ffff:')
    ? firstValue.slice('::ffff:'.length)
    : firstValue;

  return stripIpv4Port(withoutIpv6Prefix);
}

export function extractClientIp(getHeader: HeaderGetter): string | null {
  const candidateHeaders = [
    'CF-Connecting-IP',
    'True-Client-IP',
    'Fly-Client-IP',
    'X-Forwarded-For',
    'X-Real-IP',
  ];

  for (const headerName of candidateHeaders) {
    const normalizedIp = normalizeIpAddress(getHeader(headerName));
    if (normalizedIp) {
      return normalizedIp;
    }
  }

  return null;
}

export function getBlockedIpAddress(ipAddress: string | null | undefined): string | null {
  const normalizedIp = normalizeIpAddress(ipAddress);
  if (!normalizedIp) {
    return null;
  }

  return (BLOCKED_IP_ADDRESSES as readonly string[]).includes(normalizedIp)
    ? normalizedIp
    : null;
}

export function getBlockedClientIp(getHeader: HeaderGetter): string | null {
  return getBlockedIpAddress(extractClientIp(getHeader));
}

export function getBlockedIpAddressWarning(ipAddress: string): string {
  return `Requests from IP address ${ipAddress} are blocked due to abuse activity. Please contact Navigate Wealth directly if you believe this is an error.`;
}
