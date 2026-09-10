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
 */

const ATTEMPT_KEY = 'nw-article-escape-attempt';

/** How long a recorded attempt suppresses the next automatic one. */
export const ESCAPE_ATTEMPT_TTL_MS = 90_000;

interface EscapeAttempt {
  url: string;
  at: number;
}

// Fallback for private-mode / blocked storage. It only survives within a single
// page, which is enough to stop a same-page re-fire; a relaunch there falls back
// to allowing one more attempt, which is still bounded and never a loop.
let inMemoryAttempt: EscapeAttempt | null = null;

function readAttempt(): EscapeAttempt | null {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return inMemoryAttempt;
    const parsed = JSON.parse(raw) as Partial<EscapeAttempt> | null;
    if (!parsed || typeof parsed.url !== 'string' || typeof parsed.at !== 'number') {
      return inMemoryAttempt;
    }
    return { url: parsed.url, at: parsed.at };
  } catch {
    return inMemoryAttempt;
  }
}

function writeAttempt(attempt: EscapeAttempt): void {
  inMemoryAttempt = attempt;
  try {
    localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    /* storage unavailable — the in-memory record still guards this page */
  }
}

/**
 * True when the automatic hand-off may fire for `url`, recording the attempt as
 * a side effect. Returns false once an attempt for the same URL is already on
 * record and still within {@link ESCAPE_ATTEMPT_TTL_MS} — that is the bounce
 * coming back, and firing again would restart the loop.
 */
export function claimEscapeAttempt(url: string, now: number = Date.now()): boolean {
  const previous = readAttempt();
  if (previous && previous.url === url && now - previous.at < ESCAPE_ATTEMPT_TTL_MS) {
    return false;
  }
  writeAttempt({ url, at: now });
  return true;
}

/** Test seam — clears both the stored and in-memory records. */
export function resetEscapeAttempt(): void {
  inMemoryAttempt = null;
  try {
    localStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* nothing to clear */
  }
}
