/**
 * useVirtualizedRows — lightweight hook for virtualising scrollable table/list rows.
 *
 * Wraps @tanstack/react-virtual to provide a consistent API across admin
 * modules that render potentially large client or record lists.
 *
 * Guidelines §13 — "Virtualise long lists (100+ items)"
 * Memory Audit P2.2 — virtual scrolling for large lists
 *
 * Usage:
 *   const { parentRef, virtualItems, totalSize } = useVirtualizedRows({
 *     count: filteredClients.length,
 *     estimateSize: 48,       // row height in px
 *     overscan: 8,            // extra rows above/below viewport
 *   });
 *
 *   <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
 *     <div style={{ height: totalSize, position: 'relative' }}>
 *       {virtualItems.map(vRow => (
 *         <div key={vRow.key} style={{
 *           position: 'absolute', top: 0, left: 0, width: '100%',
 *           height: vRow.size, transform: `translateY(${vRow.start}px)`,
 *         }}>
 *           {renderRow(vRow.index)}
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 */

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface UseVirtualizedRowsOptions {
  /** Total number of items in the list */
  count: number;
  /** Estimated height of each row in pixels (default: 48) */
  estimateSize?: number;
  /** Number of extra rows to render above and below the visible area (default: 8) */
  overscan?: number;
  /** Whether virtualization is enabled — when false, falls back to normal rendering (default: true when count > threshold) */
  enabled?: boolean;
  /** Threshold above which virtualization kicks in (default: 50) */
  threshold?: number;
}

export interface VirtualizedRowsResult {
  /** Ref to attach to the scrollable parent container */
  parentRef: React.RefObject<HTMLDivElement | null>;
  /** Array of virtual items to render */
  virtualItems: Array<{
    key: string | number;
    index: number;
    start: number;
    size: number;
  }>;
  /** Total height of the virtualised content (for the spacer div) */
  totalSize: number;
  /** Whether virtualisation is active (false when below threshold) */
  isVirtualized: boolean;
}

export function useVirtualizedRows({
  count,
  estimateSize = 48,
  overscan = 8,
  enabled,
  threshold = 50,
}: UseVirtualizedRowsOptions): VirtualizedRowsResult {
  const parentRef = useRef<HTMLDivElement>(null);

  // Determine if we should actually virtualise
  const shouldVirtualize = enabled !== undefined ? enabled : count > threshold;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled: shouldVirtualize,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Stable result object to prevent unnecessary re-renders
  const result = useMemo<VirtualizedRowsResult>(() => ({
    parentRef,
    virtualItems: shouldVirtualize
      ? virtualItems.map(item => ({
          key: item.key,
          index: item.index,
          start: item.start,
          size: item.size,
        }))
      : Array.from({ length: count }, (_, i) => ({
          key: i,
          index: i,
          start: i * estimateSize,
          size: estimateSize,
        })),
    totalSize: shouldVirtualize ? totalSize : count * estimateSize,
    isVirtualized: shouldVirtualize,
  }), [shouldVirtualize, virtualItems, totalSize, count, estimateSize]);

  return result;
}
