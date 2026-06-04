/**
 * TimelineHelpers.tsx
 *
 * Timeline helper sub-components for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import { Badge } from '../../../../../ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { fmtDate, fmtDateTime, fmtRelative } from '../clientOverviewUtils';
import type { ActivityEvent } from '../clientOverviewUtils';

// ── TimelineEvent component ──────────────────────────────────────────────

export function TimelineEvent({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const EvtIcon = event.icon;

  return (
    <div className={`flex items-start gap-3 relative pl-1 ${isLast ? '' : 'pb-4'}`}>
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-full bg-white border-2 z-10 flex-shrink-0 ${
          event.success === false ? 'border-red-300' : 'border-gray-200'
        }`}
      >
        <EvtIcon className={`h-4 w-4 ${event.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-sm font-medium ${event.success === false ? 'text-red-700' : 'text-gray-800'}`}
          >
            {event.label}
          </p>
          {event.success === false && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-4 border-red-200 text-red-500"
            >
              Failed
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400" title={fmtDateTime(event.timestamp)}>
            {fmtDate(event.timestamp)} {'·'} {fmtRelative(event.timestamp)}
          </p>
        </div>
        {event.detail && <p className="text-xs text-red-500 mt-0.5">{event.detail}</p>}
      </div>
    </div>
  );
}

// ── EmptyBox component ───────────────────────────────────────────────────

export function EmptyBox({ message, small }: { message: string; small?: boolean }) {
  return (
    <div
      className={`text-center ${small ? 'py-4' : 'py-8'} bg-gray-50 rounded-lg border border-dashed border-gray-200`}
    >
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ── StatusDot component ──────────────────────────────────────────────────

export function StatusDot({ active }: { active: boolean }) {
  return active ? (
    <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
  ) : (
    <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
  );
}
