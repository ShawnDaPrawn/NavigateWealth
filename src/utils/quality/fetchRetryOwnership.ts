/**
 * Marks a fetch whose caller retries and reports the failure it was left with.
 *
 * The issue reporter files a network error for every other call to our
 * backend, because that throw is often the only signal (a toast, a hidden
 * section). The API client is the exception: it retries "Failed to fetch"
 * and, when that also fails, throws an APIError the query layer reports.
 * Filing the first attempt opened issues for calls that had already succeeded.
 *
 * The mark is a symbol, so it never becomes a request header.
 */

const RETRY_OWNED = Symbol('nw.retryOwnedFetch');

export function ownRetryFetch(init: RequestInit): RequestInit {
  const owned = { ...init };
  Object.defineProperty(owned, RETRY_OWNED, { value: true });
  return owned;
}

export function isRetryOwnedFetch(init: RequestInit | undefined): boolean {
  return !!init && Reflect.get(init, RETRY_OWNED) === true;
}

/** A copy of `init` without the ownership mark, safe to pass to the real fetch. */
export function withoutRetryOwnership(init: RequestInit | undefined): RequestInit | undefined {
  if (!init || !isRetryOwnedFetch(init)) return init;
  return { ...init };
}
