/**
 * Seconds a rate-limited caller should wait, for a `Retry-After` header or a
 * `retryAfter` body field: the time left until `resetAt`, rounded up, and
 * never less than one second.
 *
 * Kept in its own dependency-free module so that tests which replace
 * rateLimiter.ts wholesale still get the real calculation.
 */
export function retryAfterSeconds(resetAt: Date, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
}
