/**
 * CommunicationList — Message list with loading / empty states and pagination.
 */

import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { CommunicationCard } from './CommunicationCard';
import { ITEMS_PER_PAGE } from '../constants';
import type { Communication } from '../types';

interface CommunicationListProps {
  communications: Communication[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelect: (comm: Communication) => void;
}

export function CommunicationList({
  communications,
  isLoading,
  hasActiveFilters,
  currentPage,
  onPageChange,
  onSelect,
}: CommunicationListProps) {
  const totalPages = Math.ceil(communications.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const page = communications.slice(startIndex, endIndex);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-gray-200 shadow-sm animate-pulse">
            <CardContent className="p-6 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (page.length === 0) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No communications</h3>
          <p className="text-sm text-gray-500">
            {hasActiveFilters
              ? 'There are no messages matching your criteria'
              : 'You have no new messages at this time'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="contents">
      {/* Cards */}
      <div className="space-y-3">
        {page.map((comm) => (
          <CommunicationCard key={comm.id} communication={comm} onClick={onSelect} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, communications.length)} of{' '}
            {communications.length} messages
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={currentPage === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  className={currentPage === p ? 'bg-[#6d28d9] hover:bg-[#5b21b6]' : ''}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
