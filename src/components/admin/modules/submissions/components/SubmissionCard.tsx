/**
 * SubmissionCard
 *
 * Card displayed in each kanban column. Mirrors TaskCard pattern exactly:
 * rounded-lg, p-4, whole-card drag handle, MoreHorizontal dropdown,
 * click to view details — no inline status-change buttons.
 *
 * §7   — Display state derived from constants, never inlined.
 * §8.1 — Mirrors TaskCard for visual consistency.
 * §8.3 — Restrained colour palette; type indicator via left strip only.
 */

import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import {
  MessageSquare, FileText, Calculator, Calendar, Mail,
  MoreHorizontal, Eye, Archive,
  Shield, Stethoscope, TrendingUp, Target, Building2, Briefcase,
  UserPlus,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { Button } from '../../../../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import type { Submission, SubmissionStatus, SubmissionType } from '../types';
import { SUBMISSION_TYPE_CONFIG } from '../constants';

interface SubmissionCardProps {
  submission: Submission;
  index: number;
  onView: (submission: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
}

// ── Left strip colour per type (restrained, single accent) ────────────────────

const TYPE_STRIP_COLOR: Record<SubmissionType, string> = {
  quote: 'bg-purple-500',
  will_draft: 'bg-blue-500',
  tax_planning: 'bg-emerald-500',
  consultation: 'bg-amber-500',
  contact: 'bg-sky-500',
  client_signup: 'bg-violet-500',
};

// ── Service icon for quote submissions ────────────────────────────────────────

function ServiceIcon({ service }: { service: string }) {
  const s = service.toLowerCase();
  const c = 'h-3 w-3';
  if (s.includes('risk')) return <Shield className={c} />;
  if (s.includes('medical')) return <Stethoscope className={c} />;
  if (s.includes('investment')) return <TrendingUp className={c} />;
  if (s.includes('retirement')) return <Target className={c} />;
  if (s.includes('employee') || s.includes('benefit')) return <Building2 className={c} />;
  if (s.includes('estate')) return <FileText className={c} />;
  if (s.includes('tax')) return <Calculator className={c} />;
  return <Briefcase className={c} />;
}

// ── Time formatting ───────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short',
    });
  } catch {
    return '';
  }
}

// ── Extract meaningful preview info ───────────────────────────────────────────

interface CardPreview {
  serviceName: string | null;
  stage: string | null;
  highlights: string[];
}

function extractPreview(submission: Submission): CardPreview {
  const p = submission.payload;
  const pd = p.productDetails as Record<string, unknown> | undefined;

  let serviceName: string | null = null;
  if (p.productName) {
    serviceName = String(p.productName);
  } else if (p.service) {
    serviceName = String(p.service)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  let stage: string | null = null;
  if (p.stage === 'initial') stage = 'Initial';
  else if (p.stage === 'full') stage = 'Full Quote';

  const highlights: string[] = [];

  if (pd?.phase === 2) {
    const vertical = pd.vertical as string | null;

    // Risk
    const rn = pd.risk_needs as Record<string, Record<string, unknown>> | undefined;
    if (rn) {
      const selected = Object.entries(rn).filter(([, e]) => e.selected);
      if (selected.length > 0) {
        highlights.push(`${selected.length} cover${selected.length > 1 ? 's' : ''}`);
      }
    }

    // Medical Aid
    if (vertical === 'MedicalAid') {
      const members = pd.members as Record<string, unknown> | undefined;
      if (members?.membership_type) highlights.push(String(members.membership_type));
    }

    // Investment
    if (vertical === 'Investment') {
      const types = pd.selected_types as string[] | undefined;
      if (types?.length) highlights.push(`${types.length} type${types.length > 1 ? 's' : ''}`);
    }

    // Retirement
    if (vertical === 'Retirement' && pd.selected_product) {
      highlights.push(String(pd.selected_product));
    }

    // Employee Benefits
    if (vertical === 'EmployeeBenefits') {
      if (pd.benefit_type) highlights.push(String(pd.benefit_type));
    }

    // Estate Planning
    if (vertical === 'EstatePlanning' && pd.selected_document) {
      highlights.push(String(pd.selected_document));
    }

    // Tax Planning
    if (vertical === 'TaxPlanning') {
      const taxTypes = pd.selected_types as string[] | undefined;
      if (taxTypes?.length) highlights.push(`${taxTypes.length} tax type${taxTypes.length > 1 ? 's' : ''}`);
    }
  }

  // Consultation
  if (p.meetingType) {
    highlights.push(String(p.meetingType).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }

  // Contact
  if (p.clientType) {
    highlights.push(String(p.clientType).replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()));
  }

  // Client Signup
  if (submission.type === 'client_signup') {
    if (p.accountType) highlights.push(String(p.accountType));
    if (p.applicationNumber) highlights.push(String(p.applicationNumber));
    if (p.applicationStatus) {
      const status = String(p.applicationStatus);
      highlights.push(status.charAt(0).toUpperCase() + status.slice(1));
    }
  }

  return { serviceName, stage, highlights: highlights.slice(0, 2) };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubmissionCard({ submission, index, onView, onStatusChange }: SubmissionCardProps) {
  const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
  const preview = extractPreview(submission);
  const stripColor = TYPE_STRIP_COLOR[submission.type];

  // Track whether a drag occurred so we can suppress the click that fires on mouseup
  const wasDragged = React.useRef(false);

  return (
      <Draggable draggableId={submission.id} index={index}>
        {(provided, snapshot) => {
          // Mark as dragged whenever the snapshot shows dragging
          if (snapshot.isDragging) {
            wasDragged.current = true;
          }

          return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={cn(
              'group bg-white rounded-lg border border-gray-200 p-4 relative mb-3',
              'hover:border-purple-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
              snapshot.isDragging && 'shadow-xl ring-2 ring-purple-500 rotate-2 z-50',
            )}
            onClick={(e) => {
              // Suppress click if the card was just dragged
              if (wasDragged.current) {
                wasDragged.current = false;
                return;
              }
              if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('.no-drag')) {
                onView(submission);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(submission); } }}
            aria-label={`View ${typeCfg.label} from ${submission.submitterName || 'unknown submitter'}`}
          >
            {/* Type Strip — like TaskCard's priority strip */}
            <div className={cn('absolute left-0 top-4 bottom-4 w-1 rounded-r-full', stripColor)} />

            <div className="pl-3">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 leading-snug truncate">
                    {submission.submitterName || 'Unknown'}
                  </h3>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 -mr-2 text-gray-400 hover:text-gray-600 no-drag opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      onView(submission);
                    }}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {submission.status !== 'new' && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(submission.id, 'new');
                      }}>
                        Move to New
                      </DropdownMenuItem>
                    )}
                    {submission.status !== 'pending' && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(submission.id, 'pending');
                      }}>
                        Move to Pending
                      </DropdownMenuItem>
                    )}
                    {submission.status !== 'completed' && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(submission.id, 'completed');
                      }}>
                        Move to Completed
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(submission.id, 'archived');
                      }}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Type label + timestamp */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {typeCfg.shortLabel}
                </span>
                <span className="text-[11px] text-gray-400">
                  {formatRelativeTime(submission.submittedAt)}
                </span>
              </div>

              {/* Email — subtle, single line */}
              {submission.submitterEmail && (
                <p className="text-xs text-gray-500 truncate mb-2">
                  {submission.submitterEmail}
                </p>
              )}

              {/* Service / Stage tags — muted gray only */}
              {(preview.serviceName || preview.stage) && (
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {preview.serviceName && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100">
                      <ServiceIcon service={preview.serviceName} />
                      {preview.serviceName}
                    </span>
                  )}
                  {preview.stage && (
                    <span className="inline-flex items-center text-[11px] font-medium bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100">
                      {preview.stage}
                    </span>
                  )}
                </div>
              )}

              {/* Highlights — muted chips */}
              {preview.highlights.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {preview.highlights.map(h => (
                    <span
                      key={h}
                      className="inline-flex items-center text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        }}
      </Draggable>
  );
}