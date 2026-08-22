/**
 * Ratchet tighten-notices that are actually visible.
 * =================================================
 *
 * Every baseline ratchet in this repo ends with the same branch: the measured
 * count came in BELOW the committed floor, so somebody fixed something and the
 * floor should be lowered to lock the win in. That branch used to call
 * `console.log` / `console.warn`.
 *
 * Under this repo's Vitest (4.1.7, default reporter) console output from a
 * PASSING test is swallowed — verified by probe: a `console.warn` marker never
 * reaches the terminal, a `process.stdout.write` marker always does. So every
 * one of those notices was dead code. The ratchets still failed correctly when
 * a count ROSE; they just never told anyone when a count FELL, which is the
 * half that keeps the floors from drifting upward into meaninglessness.
 *
 * `process.stdout.write` bypasses Vitest's console interception, so use this
 * helper rather than `console.*` for anything a ratchet needs a human to read.
 */

/**
 * Announce that a ratchet's measured count is below its committed floor.
 *
 * @param tag         short ratchet name, e.g. `route-auth`
 * @param actual      the count measured on this run
 * @param floor       the value currently committed in the baseline file
 * @param baselineFile the baseline filename to edit, e.g. `.route-auth-baseline`
 * @param unit        what is being counted, e.g. `unguarded routes`
 */
export function announceRatchetSlack(
  tag: string,
  actual: number,
  floor: number,
  baselineFile: string,
  unit: string,
): void {
  process.stdout.write(
    `\n[${tag}] ${actual} ${unit}, below floor ${floor} — tighten the ratchet by ` +
      `setting ${baselineFile} to ${actual}.\n`,
  );
}
