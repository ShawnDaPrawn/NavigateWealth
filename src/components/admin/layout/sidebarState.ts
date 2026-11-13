/**
 * Which sidebar groups the person has closed. Kept in localStorage so the
 * sidebar looks the same after a reload. Storage can be missing, full or
 * blocked (private mode, some embedded browsers), so every access is guarded
 * and falls back to "all groups open".
 */
export const CLOSED_GROUPS_KEY = 'nw.admin.sidebar.closedGroups';

export function readClosedGroups(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(CLOSED_GROUPS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function writeClosedGroups(groups: string[]): void {
  try {
    globalThis.localStorage?.setItem(CLOSED_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // Storage unavailable: the choice lasts until the page reloads.
  }
}
