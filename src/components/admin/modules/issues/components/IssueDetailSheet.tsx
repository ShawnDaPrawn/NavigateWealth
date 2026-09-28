/**
 * The review sheet for one issue. Reads top to bottom in the order you need
 * it: what it is, your response (status, owner, note), what happened, what to
 * do next, then the reference details. Save sits in a footer that never
 * scrolls away. Owns only the unsaved draft; saving and task creation are the
 * module's handlers.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Loader2, Wrench } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/sheet';
import { Textarea } from '../../../../ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../../../../ui/toggle-group';
import {
  getQualityIssueResponseSlaHours,
  isQualityIssuePastResponseSla,
  recommendQualityIssueActions,
} from '../../../../../shared/quality/qualityIssues';
import { describeStoredIssue } from '../../../../../shared/quality/issueLabels';
import {
  categoryLabels,
  formatCvssScore,
  formatDate,
  formatHours,
  formatIssueLocation,
  formatRelativeTime,
  pluralize,
  severityLabels,
  sourceLabels,
  statusLabels,
} from '../issuePresentation';
import type { QualityIssue, QualityIssueStatus, QualityIssueWorkflowUpdate } from '../types';
import {
  IssueDiagnosis,
  IssueSignalBadges,
  PriorityBadge,
  SectionHeading,
  WorkflowBadge,
} from './IssueBadges';

const WORKFLOW_STATUSES: QualityIssueStatus[] = ['open', 'acknowledged', 'resolved'];

interface WorkflowDraft {
  status: QualityIssueStatus;
  ownerName: string;
  statusNote: string;
  resolutionEvidence: string;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 wrap-anywhere">{children}</dd>
    </div>
  );
}

function IssueReferenceDetails({ issue }: { issue: QualityIssue }) {
  const location = formatIssueLocation(issue);
  const cvssScore = formatCvssScore(issue.cvssScore);
  const isOverdue = isQualityIssuePastResponseSla(issue);
  const labels = describeStoredIssue(issue);

  return (
    <section className="space-y-1">
      <SectionHeading>Details</SectionHeading>
      <dl className="divide-y divide-gray-100 text-sm">
        <DetailRow label="Source">
          {sourceLabels[issue.source]} · {categoryLabels[issue.category]} ·{' '}
          {severityLabels[issue.severity]}
        </DetailRow>
        {labels.area ? <DetailRow label="Area">{labels.area}</DetailRow> : null}
        {location ? (
          <DetailRow label="Location">
            <code className="text-xs">{location}</code>
          </DetailRow>
        ) : null}
        {issue.route ? (
          <DetailRow label="Route">
            <code className="text-xs">{issue.route}</code>
          </DetailRow>
        ) : null}
        {issue.component ? <DetailRow label="Component">{issue.component}</DetailRow> : null}
        {issue.ruleId ? <DetailRow label="Rule">{issue.ruleId}</DetailRow> : null}
        <DetailRow label="First seen">{formatDate(issue.firstSeenAt)}</DetailRow>
        <DetailRow label="Last seen">{formatDate(issue.lastSeenAt)}</DetailRow>
        <DetailRow label="Occurrences">{issue.occurrences.toLocaleString('en-ZA')}</DetailRow>
        {issue.affectedUsers || issue.anonymous ? (
          <DetailRow label="Affected">
            {[
              issue.affectedUsers ? pluralize(issue.affectedUsers, 'signed-in user') : null,
              issue.anonymous ? 'signed-out visitors' : null,
            ]
              .filter(Boolean)
              .join(' and ')}
          </DetailRow>
        ) : null}
        <DetailRow label="Response target">
          {formatHours(getQualityIssueResponseSlaHours(issue))}
          {issue.status !== 'resolved' ? (
            <span className={isOverdue ? 'text-red-700' : 'text-gray-500'}>
              {isOverdue ? ' · overdue' : ' · on track'}
            </span>
          ) : null}
        </DetailRow>
        {issue.reopenedAt ? (
          <DetailRow label="Reopened">
            {formatDate(issue.reopenedAt)} · {pluralize(issue.regressionCount || 1, 'time')} after
            being resolved
          </DetailRow>
        ) : null}
        {issue.packageName ? (
          <DetailRow label="Package">
            {issue.packageName}
            {issue.packageVersion ? `@${issue.packageVersion}` : ''}
            {issue.vulnerableRange ? (
              <span className="text-gray-500"> (affected: {issue.vulnerableRange})</span>
            ) : null}
          </DetailRow>
        ) : null}
        {issue.category === 'security' ? (
          <DetailRow label="Fix">
            {issue.fixAvailable
              ? `Available${issue.fixVersion ? ` in ${issue.fixVersion}` : ''}`
              : 'No fix published yet'}
          </DetailRow>
        ) : null}
        {issue.advisoryId || issue.cve || cvssScore ? (
          <DetailRow label="Advisory">
            {[issue.advisoryId, issue.cve, cvssScore ? `CVSS ${cvssScore}` : null]
              .filter(Boolean)
              .join(' · ')}
            {issue.referenceUrl ? (
              <a
                href={issue.referenceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center gap-0.5 text-purple-700 hover:text-purple-800"
              >
                Reference
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </DetailRow>
        ) : null}
        {issue.detectedBy ? <DetailRow label="Detected by">{issue.detectedBy}</DetailRow> : null}
        {issue.workflowUpdatedAt ? (
          <DetailRow label="Last updated">
            {formatDate(issue.workflowUpdatedAt)}
            {issue.workflowUpdatedBy ? ` by ${issue.workflowUpdatedBy}` : ''}
          </DetailRow>
        ) : null}
        <DetailRow label="Fingerprint">
          <code className="text-xs text-gray-600">{issue.fingerprint}</code>
        </DetailRow>
      </dl>
    </section>
  );
}

function IssueDetail({
  issue,
  onSave,
  onCreateTask,
}: {
  issue: QualityIssue;
  onSave: (update: QualityIssueWorkflowUpdate) => Promise<void>;
  onCreateTask: (issue: QualityIssue) => Promise<void>;
}) {
  const { status, ownerName, statusNote, resolutionEvidence } = issue;
  const [draft, setDraft] = useState<WorkflowDraft>({
    status,
    ownerName: ownerName || '',
    statusNote: statusNote || '',
    resolutionEvidence: resolutionEvidence || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // A save, a task link or a refresh changes the stored workflow; show it.
  useEffect(() => {
    setDraft({
      status,
      ownerName: ownerName || '',
      statusNote: statusNote || '',
      resolutionEvidence: resolutionEvidence || '',
    });
  }, [status, ownerName, statusNote, resolutionEvidence]);

  const draftIssue: QualityIssue = {
    ...issue,
    status: draft.status,
    ownerName: draft.ownerName.trim() || undefined,
    statusNote: draft.statusNote.trim() || undefined,
    resolutionEvidence: draft.resolutionEvidence.trim() || undefined,
  };
  const hasChanges =
    draftIssue.status !== issue.status ||
    draftIssue.ownerName !== (issue.ownerName || undefined) ||
    draftIssue.statusNote !== (issue.statusNote || undefined) ||
    draftIssue.resolutionEvidence !== (issue.resolutionEvidence || undefined);
  const nextSteps = recommendQualityIssueActions(draftIssue);
  const showEvidence = draft.status === 'resolved' || !!issue.resolutionEvidence;
  const labels = describeStoredIssue(issue);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave({
        fingerprint: issue.fingerprint,
        status: draftIssue.status,
        ownerName: draftIssue.ownerName ?? null,
        statusNote: draftIssue.statusNote ?? null,
        resolutionEvidence: draftIssue.resolutionEvidence ?? null,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTask() {
    setIsCreatingTask(true);
    try {
      await onCreateTask(draftIssue);
    } finally {
      setIsCreatingTask(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="space-y-3 border-b border-gray-100 px-6 py-5 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={issue.priority} />
          <WorkflowBadge status={issue.status} />
          <IssueSignalBadges issue={issue} />
        </div>
        <SheetTitle className="text-xl wrap-anywhere">{labels.title}</SheetTitle>
        <SheetDescription>
          {[
            sourceLabels[issue.source],
            labels.area,
            issue.occurrences > 1
              ? `seen ${pluralize(issue.occurrences, 'time')}, last ${formatRelativeTime(issue.lastSeenAt)}`
              : `seen ${formatRelativeTime(issue.lastSeenAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <section className="space-y-4">
          <SectionHeading>Your response</SectionHeading>
          <div className="space-y-2">
            <Label id="issue-status-label">Status</Label>
            <ToggleGroup
              type="single"
              value={draft.status}
              onValueChange={(value) =>
                value &&
                setDraft((current) => ({ ...current, status: value as QualityIssueStatus }))
              }
              aria-labelledby="issue-status-label"
              className="w-full rounded-lg bg-gray-100 p-1"
            >
              {WORKFLOW_STATUSES.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-8 rounded-md text-gray-600 hover:bg-transparent hover:text-gray-900 data-[state=on]:bg-white data-[state=on]:text-gray-900 data-[state=on]:shadow-sm"
                >
                  {statusLabels[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-owner">Owner</Label>
            <Input
              id="issue-owner"
              value={draft.ownerName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, ownerName: event.target.value }))
              }
              placeholder="Who is handling this?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue-status-note">Note</Label>
            <Textarea
              id="issue-status-note"
              value={draft.statusNote}
              onChange={(event) =>
                setDraft((current) => ({ ...current, statusNote: event.target.value }))
              }
              placeholder="What's been decided, or what still needs to happen"
              className="min-h-20 rounded-lg border-gray-200 bg-white shadow-sm"
            />
          </div>
          {showEvidence ? (
            <div className="space-y-2">
              <Label htmlFor="issue-resolution-evidence">How do you know it's fixed?</Label>
              <Textarea
                id="issue-resolution-evidence"
                value={draft.resolutionEvidence}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, resolutionEvidence: event.target.value }))
                }
                placeholder="Link the PR, commit, deploy or test run that proves it"
                className="min-h-20 rounded-lg border-gray-200 bg-white shadow-sm"
              />
              <p className="text-xs text-muted-foreground">
                Kept with the issue so the closure can be checked later, and used to flag a
                regression if the same problem comes back.
              </p>
            </div>
          ) : null}
        </section>

        <IssueDiagnosis issue={issue} />

        {nextSteps.length > 0 ? (
          <section className="space-y-3">
            <SectionHeading>Suggested next steps</SectionHeading>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 marker:text-gray-400">
              {nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}

        <IssueReferenceDetails issue={issue} />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {issue.linkedTaskId ? (
          <Button variant="outline" asChild>
            <a href="/admin?module=tasks" title={issue.linkedTaskTitle}>
              View linked task
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCreateTask()}
            disabled={isCreatingTask}
          >
            {isCreatingTask ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wrench className="h-4 w-4" aria-hidden="true" />
            )}
            Create remediation task
          </Button>
        )}
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !hasChanges}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}

export function IssueDetailSheet({
  issue,
  onClose,
  onSave,
  onCreateTask,
}: {
  issue: QualityIssue | null;
  onClose: () => void;
  onSave: (update: QualityIssueWorkflowUpdate) => Promise<void>;
  onCreateTask: (issue: QualityIssue) => Promise<void>;
}) {
  return (
    <Sheet open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        {issue ? (
          <IssueDetail
            key={issue.fingerprint}
            issue={issue}
            onSave={onSave}
            onCreateTask={onCreateTask}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
