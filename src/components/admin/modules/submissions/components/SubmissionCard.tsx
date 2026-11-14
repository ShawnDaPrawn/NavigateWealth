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
import { MoreHorizontal, Eye, Archive } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import type { Submission, SubmissionStatus, SubmissionType } from '../types';
import { SUBMISSION_TYPE_CONFIG } from '../constants';

interface SubmissionCardProps {
  submission: Submission;
  index: number;
  onView: (submission: Submission) => void;
  onStatusChange: (id: string, status: SubmissionStatus) => void;
  /** Delete (the board asks first). */
  onDelete?: (submission: Submission) => void;
}

// ── Left strip colour per type (restrained, single accent) ────────────────────

/** Each submission type's pill colour (SU-Board). */
const TYPE_TONE: Record<SubmissionType, string> = {
  quote: 'brand',
  will_draft: 'warn',
  tax_planning: 'warn',
  consultation: 'ok',
  contact: '',
  client_signup: 'info',
  change_request: 'bad',
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
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
      .replace(/\b\w/g, (c) => c.toUpperCase());
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
      if (taxTypes?.length)
        highlights.push(`${taxTypes.length} tax type${taxTypes.length > 1 ? 's' : ''}`);
    }
  }

  // Consultation
  if (p.meetingType) {
    highlights.push(
      String(p.meetingType)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  }

  // Contact
  if (p.clientType) {
    highlights.push(
      String(p.clientType)
        .replace(/_/g, ' ')
        .replace(/\\b\\w/g, (c) => c.toUpperCase()),
    );
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

  if (submission.type === 'change_request') {
    if (p.changeTypeLabel) highlights.push(String(p.changeTypeLabel));
    if (p.policyNumber) highlights.push(String(p.policyNumber));
  }

  return { serviceName, stage, highlights: highlights.slice(0, 2) };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubmissionCard({
  submission,
  index,
  onView,
  onStatusChange,
  onDelete,
}: SubmissionCardProps) {
  const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
  const preview = extractPreview(submission);

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
              'ds-kcard group mb-2 cursor-grab active:cursor-grabbing',
              snapshot.isDragging && 'sel z-50',
            )}
            onClick={(e) => {
              // Suppress click if the card was just dragged
              if (wasDragged.current) {
                wasDragged.current = false;
                return;
              }
              if (
                !(e.target as HTMLElement).closest('button') &&
                !(e.target as HTMLElement).closest('.no-drag')
              ) {
                onView(submission);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onView(submission);
              }
            }}
            aria-label={`View ${typeCfg.label} from ${submission.submitterName || 'unknown submitter'}`}
          >
            <div className="row pr-8">
              <span className={cn('ds-pill', TYPE_TONE[submission.type])}>{typeCfg.label}</span>
              <span className="ds-meta">{formatShortDate(submission.submittedAt)}</span>
            </div>
            <b className="truncate">{submission.submitterName || 'Unknown'}</b>
            <span className="ds-meta break-words">
              {[
                submission.submitterEmail,
                preview.serviceName,
                preview.stage,
                ...preview.highlights,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More actions for ${submission.submitterName || 'this submission'}`}
                  className="ds-btn ds-btn-ghost ds-btn-sm no-drag absolute right-2 top-2 !w-8 !justify-center !p-0"
                >
                  <MoreHorizontal aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(submission);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {submission.status !== 'new' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(submission.id, 'new');
                    }}
                  >
                    Move to New
                  </DropdownMenuItem>
                )}
                {submission.status !== 'pending' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(submission.id, 'pending');
                    }}
                  >
                    Move to Pending
                  </DropdownMenuItem>
                )}
                {submission.status !== 'completed' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(submission.id, 'completed');
                    }}
                  >
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
                {onDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(submission);
                    }}
                    className="text-red-600 focus:bg-red-50 focus:text-red-700"
                  >
                    Delete…
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }}
    </Draggable>
  );
}
