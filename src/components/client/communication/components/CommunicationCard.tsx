/**
 * CommunicationCard — Individual message card in the inbox list.
 * Config-driven category rendering (§5.3, §7.1).
 *
 * Message content may be HTML from the admin compose editor.
 * We strip tags for the preview excerpt and render full HTML in the detail modal.
 */

import { useMemo } from 'react';
import { User, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { CATEGORY_CONFIG } from '../constants';
import { formatRelativeDate, stripHtml, isHtmlContent } from '../utils';
import type { Communication, CommunicationCategory } from '../types';

interface CommunicationCardProps {
  communication: Communication;
  onClick: (comm: Communication) => void;
}

export function CommunicationCard({ communication: comm, onClick }: CommunicationCardProps) {
  const cfg = CATEGORY_CONFIG[comm.category as CommunicationCategory] ?? CATEGORY_CONFIG.General;
  const CategoryIcon = cfg.icon;

  /** Plain-text excerpt for the card preview (strip HTML if present) */
  const previewText = useMemo(() => {
    if (!comm.message) return '';
    return isHtmlContent(comm.message) ? stripHtml(comm.message) : comm.message;
  }, [comm.message]);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border-gray-200 shadow-sm group ${
        !comm.read ? 'border-l-4 border-l-[#6d28d9] bg-blue-50/20' : ''
      }`}
      onClick={() => onClick(comm)}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${cfg.bgColor}`}>
              <CategoryIcon className={`h-6 w-6 ${cfg.iconColor}`} />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    className={`text-base truncate ${
                      !comm.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                    }`}
                  >
                    {comm.subject}
                  </h4>
                  {!comm.read && (
                    <Badge className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-xs flex-shrink-0">
                      New
                    </Badge>
                  )}
                </div>

                <p
                  className={`text-sm mb-3 line-clamp-2 break-words ${
                    !comm.read ? 'text-gray-700' : 'text-gray-500'
                  }`}
                >
                  {previewText}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{comm.from}</span>
                  </div>
                  <span>&bull;</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatRelativeDate(comm.timestamp)}</span>
                  </div>
                </div>

                <div className="mt-3">
                  <Badge variant="outline" className={`${cfg.badgeClass} gap-1.5`}>
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-center h-full flex-shrink-0">
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-[#6d28d9] transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
