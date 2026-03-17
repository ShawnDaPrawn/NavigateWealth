/**
 * VirtualizedClientList — Shared virtualised client row renderer for
 * communication module lists that can grow unbounded.
 *
 * Guidelines §13 — "Virtualise long lists (100+ items)"
 * Memory Audit P2.2 — virtual scrolling for large lists
 */

import React from 'react';
import { Avatar, AvatarFallback } from '../../../../ui/avatar';
import { Checkbox } from '../../../../ui/checkbox';
import { Users, UserCheck } from 'lucide-react';
import { useVirtualizedRows } from '../../../../shared/useVirtualizedRows';

interface ClientStatus {
  icon: React.ReactNode;
  color: string;
  reason?: string;
}

/** Loosely-typed client record — consumers narrow via callbacks. */
type VirtualClient = { id: string; [key: string]: unknown };

interface VirtualizedClientListProps {
  /** Clients to render */
  clients: Array<VirtualClient>;
  /** Max height CSS class for the scroll container */
  maxHeightClass?: string;
  /** Row height in pixels (default: 72) */
  rowHeight?: number;
  /** Threshold for enabling virtualization (default: 50) */
  threshold?: number;
  /** Get display name for a client */
  getDisplayName: (client: VirtualClient) => string;
  /** Get status badge info for a client */
  getStatus: (client: VirtualClient) => ClientStatus;
  /** Check if client is eligible */
  isEligible?: (client: VirtualClient) => boolean;
  /** Called when a client row is clicked */
  onClientClick: (client: VirtualClient) => void;
  /** Contact detail to show (email/phone) */
  contactDetail?: (client: VirtualClient) => string;
  /** Whether to show a checkbox */
  showCheckbox?: boolean;
  /** Whether to show the hover action icon */
  showHoverAction?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** CSS class for eligible/ineligible row styling */
  getRowClassName?: (client: VirtualClient) => string;
}

export function VirtualizedClientList({
  clients,
  maxHeightClass = 'max-h-64',
  rowHeight = 72,
  threshold = 50,
  getDisplayName,
  getStatus,
  isEligible,
  onClientClick,
  contactDetail,
  showCheckbox = false,
  showHoverAction = false,
  emptyMessage = 'No clients found',
  getRowClassName,
}: VirtualizedClientListProps) {
  const { parentRef, virtualItems, totalSize, isVirtualized } = useVirtualizedRows({
    count: clients.length,
    estimateSize: rowHeight,
    overscan: 8,
    threshold,
  });

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className={`${maxHeightClass} overflow-y-auto`}>
      <div
        style={{
          height: isVirtualized ? totalSize : undefined,
          position: isVirtualized ? 'relative' : undefined,
        }}
      >
        {virtualItems.map(vRow => {
          const client = clients[vRow.index];
          const status = getStatus(client);
          const displayName = getDisplayName(client);
          const eligible = isEligible ? isEligible(client) : true;

          const defaultRowClass = eligible
            ? 'hover:bg-green-50 hover:border-green-200 border-gray-200'
            : 'hover:bg-orange-50 hover:border-orange-200 border-orange-100 bg-orange-50/30';

          const rowClass = getRowClassName ? getRowClassName(client) : defaultRowClass;

          return (
            <div
              key={client.id}
              role="row"
              tabIndex={0}
              className={`group flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all duration-200 ${rowClass}`}
              onClick={() => onClientClick(client)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClientClick(client); } }}
              style={isVirtualized ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: vRow.size - 8, // account for gap
                transform: `translateY(${vRow.start}px)`,
                marginBottom: 8,
              } : { marginBottom: 8 }}
            >
              {showCheckbox && (
                <Checkbox
                  checked={false}
                  className="pointer-events-none"
                />
              )}

              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {displayName.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{displayName}</span>
                  <span className={status.color}>
                    {status.icon}
                  </span>
                </div>
                {contactDetail && (
                  <div className="text-xs text-muted-foreground truncate">
                    {contactDetail(client)}
                  </div>
                )}
                {status.reason && (
                  <div className="text-xs text-orange-600 mt-0.5">
                    {status.reason}
                  </div>
                )}
              </div>

              {showHoverAction && (
                <UserCheck className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}