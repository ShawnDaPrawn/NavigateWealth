/**
 * HistoryDialog — Communication History Modal
 *
 * Displays a filterable, virtualized list of past communications.
 * Presentation-only — filtering is derived from props.
 */

import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Badge } from '../../../../../ui/badge';
import { CardDescription } from '../../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Search,
  Loader2,
  MessageSquare,
  CheckCircle2,
  Eye,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { useVirtualizedRows } from '../../../../../shared/useVirtualizedRows';
import { getCategoryIcon, getCategoryColor, CATEGORIES } from './constants';
import type { CommunicationLog } from '../../../communication/types';

export interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communications: CommunicationLog[];
  isLoading: boolean;
  onViewDetail: (log: CommunicationLog) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}

const COMM_ROW_HEIGHT = 72;

export function HistoryDialog({
  open,
  onOpenChange,
  communications,
  isLoading,
  onViewDetail,
  onDelete,
}: HistoryDialogProps) {
  // Local filter state — scoped to this dialog
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const filteredCommunications = useMemo(() => {
    return communications.filter((comm: CommunicationLog) => {
      const matchesSearch =
        searchQuery === '' ||
        comm.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (comm.body && comm.body.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = filterCategory === 'All' || comm.category === filterCategory;

      let matchesDate = true;
      if (filterStartDate) {
        matchesDate = matchesDate && new Date(comm.created_at) >= new Date(filterStartDate);
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(comm.created_at) <= end;
      }

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [communications, searchQuery, filterCategory, filterStartDate, filterEndDate]);

  const {
    parentRef: commListRef,
    virtualItems: commVirtualItems,
    totalSize: commTotalSize,
    isVirtualized: commIsVirtualized,
  } = useVirtualizedRows({
    count: filteredCommunications.length,
    estimateSize: COMM_ROW_HEIGHT,
    overscan: 8,
    threshold: 50,
  });

  const readCount = communications.filter(c => c.read).length;
  const unreadCount = communications.filter(c => !c.read).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Communication History</DialogTitle>
          <CardDescription>
            {communications.length} communication{communications.length !== 1 ? 's' : ''} sent
          </CardDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subject or content..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-[200px]">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-[140px]"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                className="w-[140px]"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 px-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{readCount} Read</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-gray-500" />
              <span>{unreadCount} Unread</span>
            </div>
          </div>

          {/* List */}
          <div ref={commListRef} className="flex-1 border rounded-md overflow-y-auto" style={{ maxHeight: '500px' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredCommunications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
                <p>No communications found</p>
              </div>
            ) : (
              <div
                style={{
                  height: commIsVirtualized ? commTotalSize : undefined,
                  position: commIsVirtualized ? 'relative' : undefined,
                }}
              >
                {commVirtualItems.map(vRow => {
                  const log = filteredCommunications[vRow.index];
                  const Icon = getCategoryIcon(log.category);
                  const isRead = log.read;

                  return (
                    <div
                      key={log.id}
                      role="row"
                      tabIndex={0}
                      className="flex items-center p-4 border-b border-gray-100 hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => onViewDetail(log)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onViewDetail(log);
                        }
                      }}
                      style={commIsVirtualized ? {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: vRow.size,
                        transform: `translateY(${vRow.start}px)`,
                      } : undefined}
                    >
                      {/* Icon */}
                      <div className={`p-2 rounded-full ${getCategoryColor(log.category)} bg-opacity-10 mr-4 flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${getCategoryColor(log.category)}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium truncate ${!isRead ? 'text-black' : 'text-gray-700'}`}>
                            {log.subject}
                          </h4>
                          {!isRead && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" title="Unread" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            {new Date(log.created_at).toLocaleString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{log.sender_name || 'System'}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{log.category}</span>
                        </div>
                      </div>

                      {/* Badges & Actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-2">
                            {log.sent_via_email && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-gray-500">
                                Email
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-gray-500">
                              Portal
                            </Badge>
                          </div>
                          {log.attachments && log.attachments.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <Paperclip className="h-3 w-3" />
                              {log.attachments.length}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete communication"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(log.id, e);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
