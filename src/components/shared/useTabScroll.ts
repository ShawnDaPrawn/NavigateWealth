/**
 * useTabScroll — Scrolls the active tab into view within a horizontally-scrollable container.
 *
 * Shared across all service pages (RiskManagement, MedicalAid, etc.)
 * that use the TabStrip component with horizontal pill navigation.
 *
 * @param scrollRef - React ref to the scrollable container element
 * @param activeId  - The currently active tab identifier
 */

import { useEffect, type RefObject } from 'react';

export function useTabScroll(scrollRef: RefObject<HTMLDivElement>, activeId: string) {
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!activeBtn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = activeBtn.getBoundingClientRect();
    const delta = (bRect.left + bRect.width / 2) - (cRect.left + cRect.width / 2);
    container.scrollTo({ left: Math.max(0, container.scrollLeft + delta), behavior: 'smooth' });
  }, [activeId, scrollRef]);
}
