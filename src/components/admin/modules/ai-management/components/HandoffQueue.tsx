/**
 * HandoffQueue — Handoffs tab
 *
 * Manages adviser handoff requests (lead capture) from Vasco conversations.
 * Guidelines: §7, §8.3
 */

import React, { useState, useMemo } from 'react';
import {
  PhoneForwarded, Search, Loader2, Clock, Mail, Phone, User,
  MessageSquare, ChevronDown, Filter, Inbox, CheckCircle2,
} from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { cn } from '../../../../ui/utils';
import { useHandoffs, useUpdateHandoffStatus } from '../hooks';
import { HANDOFF_STATUS_CONFIG } from '../constants';
import type { HandoffStatus, HandoffRequest } from '../types';

type FilterStatus = HandoffStatus | 'all';

const STATUS_OPTIONS: HandoffStatus[] = ['new', 'contacted', 'converted', 'closed'];

export function HandoffQueue() {
  const { data: handoffs, isLoading } = useHandoffs();
  const updateStatus = useUpdateHandoffStatus();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!handoffs) return [];
    return handoffs.filter(h => {
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return (
          h.name.toLowerCase().includes(lower) ||
          h.email.toLowerCase().includes(lower) ||
          h.topic.toLowerCase().includes(lower)
        );
      }
      return true;
    });
  }, [handoffs, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    if (!handoffs) return { new: 0, contacted: 0, converted: 0, closed: 0 };
    return {
      new: handoffs.filter(h => h.status === 'new').length,
      contacted: handoffs.filter(h => h.status === 'contacted').length,
      converted: handoffs.filter(h => h.status === 'converted').length,
      closed: handoffs.filter(h => h.status === 'closed').length,
    };
  }, [handoffs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_OPTIONS.map(status => {
          const cfg = HANDOFF_STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={cn(
                'bg-white p-4 rounded-xl border shadow-sm text-center transition-all',
                statusFilter === status ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-100'
              )}
            >
              <p className="text-2xl font-bold text-gray-900">{stats[status]}</p>
              <p className="text-xs text-gray-500">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {statusFilter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Handoff List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {handoffs?.length === 0 ? 'No handoff requests yet' : 'No handoffs match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(handoff => (
            <HandoffCard
              key={handoff.id}
              handoff={handoff}
              onStatusChange={(status) => updateStatus.mutate({ id: handoff.id, status })}
              isUpdating={updateStatus.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HandoffCard({ handoff, onStatusChange, isUpdating }: {
  handoff: HandoffRequest;
  onStatusChange: (status: HandoffStatus) => void;
  isUpdating: boolean;
}) {
  const statusCfg = HANDOFF_STATUS_CONFIG[handoff.status];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Badge className={cn('text-xs', statusCfg.badgeClass)}>
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', statusCfg.dotClass)} />
              {statusCfg.label}
            </Badge>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(handoff.createdAt).toLocaleDateString('en-ZA', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {handoff.name}
            </span>
            <a
              href={`mailto:${handoff.email}`}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <Mail className="h-3.5 w-3.5" />
              {handoff.email}
            </a>
            {handoff.phone && (
              <a
                href={`tel:${handoff.phone}`}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <Phone className="h-3.5 w-3.5" />
                {handoff.phone}
              </a>
            )}
          </div>

          {/* Topic */}
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700">{handoff.topic}</span>
          </div>

          {/* Conversation Summary */}
          {handoff.conversationSummary && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
              {handoff.conversationSummary}
            </p>
          )}
        </div>

        {/* Status Change Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={isUpdating}>
              Update
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUS_OPTIONS.filter(s => s !== handoff.status).map(status => {
              const cfg = HANDOFF_STATUS_CONFIG[status];
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className="gap-2"
                >
                  <span className={cn('w-2 h-2 rounded-full', cfg.dotClass)} />
                  Mark as {cfg.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
