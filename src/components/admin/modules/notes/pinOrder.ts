/**
 * Pin-order persistence for the notes board.
 *
 * Moved verbatim out of DraggablePinnedGrid so the ordering rules are testable
 * without a drag library in the way, and so they survive the swap from
 * react-dnd to @hello-pangea/dnd unchanged. Per §7 the grid is presentation
 * plus local UI state; which note sits where, and how that is remembered, is
 * neither.
 *
 * Order is stored per personnel id in localStorage. Every read and write is
 * defensive: a corrupt or unavailable store degrades to "no saved order",
 * because losing a preferred layout must never stop the board rendering.
 */
import type { Note } from './types';
import { PIN_ORDER_STORAGE_KEY } from './constants';

export function getStorageKey(personnelId: string): string {
  return `${PIN_ORDER_STORAGE_KEY}_${personnelId}`;
}

export function loadPinOrder(personnelId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(personnelId));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function savePinOrder(personnelId: string, order: string[]): void {
  try {
    localStorage.setItem(getStorageKey(personnelId), JSON.stringify(order));
  } catch {
    // Fail silently
  }
}

// ============================================================================
// APPLY CUSTOM ORDER
// ============================================================================

export function applyCustomOrder(notes: Note[], savedOrder: string[]): Note[] {
  if (savedOrder.length === 0) return notes;

  const orderMap = new Map(savedOrder.map((id, idx) => [id, idx]));
  const ordered = [...notes];

  ordered.sort((a, b) => {
    const aIdx = orderMap.get(a.id);
    const bIdx = orderMap.get(b.id);
    // Both in saved order — use saved positions
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    // Only one in saved order — it comes first
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    // Neither in saved order — keep original relative order
    return 0;
  });

  return ordered;
}
