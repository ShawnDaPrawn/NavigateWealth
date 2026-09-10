/**
 * One-shot guard for the "open this article in the browser" escape.
 *
 * When the installed PWA captures an emailed article link it tries to hand the
 * article to a real browser. If anything sends that navigation back into the
 * app's scope — an apex host that 301s to `www` rather than serving the article,
 * for instance — the app relaunches, the interstitial mounts fresh, and it fires
 * the same escape again. Component state cannot break that cycle because every
 * relaunch is a brand new page: the client just watches the browser and the app
 * trade the link back and forth, which is the loading loop this guard exists to
 * stop.
 *
 * So the attempt is recorded where a relaunch can still see it. One recent
 * attempt per article URL is allowed; anything after that renders the
 * interstitial and waits for a deliberate tap. The record expires so a client
 * returning to the same article later still gets an automatic hand-off.
 *
 * Where the record CANNOT survive a relaunch — private mode, hardened storage
 * settings, a full quota — there is no automatic hand-off at all. An in-memory
 * fallback would be worthless here: it resets with the page, so a bouncing link
 * would clear it on every launch and fire again, which is precisely the loop.
 * Better to leave the client on the interstitial and let them tap through.
 */

const ATTEMPT_KEY = 'nw-article-escape-attempt';
const PROBE_KEY = `${ATTEMPT_KEY}:probe`;

/** How long a recorded attempt suppresses the next automatic one. */
export const ESCAPE_ATTEMPT_TTL_MS = 90_000;

interface EscapeAttempt {
  url: string;
  at: number;
}

/**
 * Whether a record written now would still be readable after the app relaunches.
 * Probing with a real write is the only honest check: storage can be present but
 * refuse writes (private mode, blocked site data, exhausted quota).
 */
function canPersistAcrossRelaunch(): boolean {
  try {
    localStorage.setItem(PROBE_KEY, '1');
    localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readAttempt(): EscapeAttempt | null {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EscapeAttempt> | null;
    if (!parsed || typeof parsed.url !== 'string' || typeof parsed.at !== 'number') {
      return null;
    }
    return { url: parsed.url, at: parsed.at };
  } catch {
    return null;
  }
}

function writeAttempt(attempt: EscapeAttempt): void {
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    /* Already ruled out by canPersistAcrossRelaunch; nothing useful to do. */
  }
}

/**
 * True when the automatic hand-off may fire for `url`, recording the attempt as
 * a side effect.
 *
 * Returns false once an attempt for the same URL is already on record and still
 * within {@link ESCAPE_ATTEMPT_TTL_MS} — that is the bounce coming back, and
 * firing again would restart the loop. Also returns false whenever the record
 * could not outlive the page, because then a bounce is indistinguishable from a
 * first launch.
 */
export function claimEscapeAttempt(url: string, now: number = Date.now()): boolean {
  if (!canPersistAcrossRelaunch()) return false;

  const previous = readAttempt();
  if (previous && previous.url === url && now - previous.at < ESCAPE_ATTEMPT_TTL_MS) {
    return false;
  }
  writeAttempt({ url, at: now });
  return true;
}

/** Test seam — clears the stored record. */
export function resetEscapeAttempt(): void {
  try {
    localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* nothing to clear */
  }
}
