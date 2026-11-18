/** Two-digit position label: 1 → "01". */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
