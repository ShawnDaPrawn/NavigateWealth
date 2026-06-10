/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 *
 * Rejects URLs that are not plain http(s) or that target private, loopback,
 * link-local, or cloud-metadata addresses. This blocks the common SSRF vectors
 * (e.g. http://169.254.169.254/ metadata, http://127.0.0.1:<port>/ internal
 * services, RFC-1918 ranges).
 *
 * Limitation: this is a hostname/literal-IP check, not a post-DNS-resolution
 * pin, so it does not fully defeat DNS-rebinding. It is defence-in-depth and
 * should be paired with authentication on the calling route where possible.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost']);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = o;
  return (
    a === 0 || // 0.0.0.0/8
    a === 127 || // loopback
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT 100.64.0.0/10
    a >= 224 // multicast / reserved
  );
}

function isPrivateIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    h === '::1' || // loopback
    h === '::' ||
    h.startsWith('fe80') || // link-local
    h.startsWith('fc') || // unique local
    h.startsWith('fd') ||
    h.startsWith('::ffff:') // IPv4-mapped (could embed a private v4)
  );
}

/**
 * Throws if `rawUrl` is not safe to fetch from the server. Returns the parsed
 * URL on success.
 */
export function assertPublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new Error('URL host is not allowed');
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new Error('URL host resolves to a private or reserved address');
  }

  return parsed;
}

/** Non-throwing variant. */
export function isPublicHttpUrl(rawUrl: string): boolean {
  try {
    assertPublicHttpUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
