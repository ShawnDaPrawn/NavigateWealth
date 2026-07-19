/**
 * PeriodStatusCard — one VAT period's submission lifecycle + VAT201 view.
 *
 * Open periods can be marked submitted (capturing the eFiling date + SARS
 * reference), which LOCKS transaction edits inside the period server-side.
 * Submitted periods track the s45 refund payout clock (21 business days) and
 * move through verification → refund received → closed; reopening is an
 * explicit, audited unlock. The VAT201 table shows the field-by-field values
 * to transcribe into eFiling.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../../ui/alert-dialog';
import { useEntitySubmissions, useUpsertSubmission } from '../hooks/useRefundClusters';
import { formatZar, type VatPeriod } from '../vat';
import {
  computeVat201,
  isLockedStatus,
  periodKey,
  refundClock,
  SUBMISSION_STATUS_LABELS,
  vat201Rows,
} from '../vat201';
import type { RefundTransaction, VatSubmission } from '../types';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface PeriodStatusCardProps {
  clusterId: string;
  entityId: string;
  period: VatPeriod;
  /** Transactions already filtered to this period. */
  transactions: RefundTransaction[];
}

export function PeriodStatusCard({
  clusterId,
  entityId,
  period,
  transactions,
}: PeriodStatusCardProps) {
  const { data: submissions = [] } = useEntitySubmissions(clusterId, entityId);
  const upsert = useUpsertSubmission();
  const [vat201Open, setVat201Open] = useState(false);
  const [submitFormOpen, setSubmitFormOpen] = useState(false);
  const [refundFormOpen, setRefundFormOpen] = useState(false);
  const [unlockConfirm, setUnlockConfirm] = useState(false);
  const [submittedDate, setSubmittedDate] = useState(todayIso());
  const [sarsRef, setSarsRef] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState(todayIso());

  const pKey = periodKey(period.start, period.end);
  const submission: VatSubmission | undefined = submissions.find((s) => s.periodKey === pKey);
  const status = submission?.status ?? 'open';
  const locked = isLockedStatus(status);
  const fields = useMemo(() => computeVat201(transactions), [transactions]);
  const clock =
    submission?.submittedDate && (status === 'submitted' || status === 'verification')
      ? refundClock(submission.submittedDate, todayIso())
      : null;

  const save = (changes: Parameters<typeof upsert.mutate>[0]['submission']) =>
    upsert.mutate({
      clusterId,
      entityId,
      periodKey: pKey,
      submission: {
        periodStart: period.start,
        periodEnd: period.end,
        periodLabel: period.label,
        ...changes,
      },
    });

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <Lock className="h-4 w-4 text-amber-600" />
        ) : (
          <LockOpen className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">Period status:</span>
        <Badge
          variant={status === 'open' ? 'secondary' : status === 'closed' ? 'outline' : 'default'}
        >
          {SUBMISSION_STATUS_LABELS[status]}
        </Badge>
        {submission?.sarsRef ? (
          <span className="text-xs text-muted-foreground">SARS ref {submission.sarsRef}</span>
        ) : null}
        {clock ? (
          <span
            className={`text-xs ${clock.overdue ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}
          >
            {clock.overdue
              ? `Refund overdue — payout was due by ${clock.expectedBy} (s45: 21 business days)`
              : `Refund expected by ${clock.expectedBy} · ${clock.elapsed}/21 business days elapsed`}
          </span>
        ) : null}
        {status === 'refund_received' && submission?.refundAmount != null ? (
          <span className="text-xs text-green-700">
            {formatZar(submission.refundAmount)} received {submission.refundReceivedDate ?? ''}
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {status === 'open' && (
            <Button size="sm" variant="outline" onClick={() => setSubmitFormOpen((v) => !v)}>
              Mark Submitted
            </Button>
          )}
          {status === 'submitted' && (
            <Button
              size="sm"
              variant="outline"
              disabled={upsert.isPending}
              onClick={() => save({ status: 'verification' })}
            >
              Under Verification
            </Button>
          )}
          {(status === 'submitted' || status === 'verification') && (
            <Button size="sm" variant="outline" onClick={() => setRefundFormOpen((v) => !v)}>
              Refund Received
            </Button>
          )}
          {status === 'refund_received' && (
            <Button
              size="sm"
              variant="outline"
              disabled={upsert.isPending}
              onClick={() => save({ status: 'closed' })}
            >
              Close Period
            </Button>
          )}
          {locked && (
            <Button size="sm" variant="ghost" onClick={() => setUnlockConfirm(true)}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <p className="text-xs text-muted-foreground">
          Locked — transactions in this period can&apos;t be added, edited or deleted. Evidence
          files can still be attached for verification.
        </p>
      )}

      {submitFormOpen && status === 'open' && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-2">
          <div className="space-y-1">
            <Label htmlFor="sub-date" className="text-xs">
              eFiling submission date
            </Label>
            <Input
              id="sub-date"
              type="date"
              className="h-8"
              value={submittedDate}
              onChange={(e) => setSubmittedDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-ref" className="text-xs">
              SARS reference (optional)
            </Label>
            <Input
              id="sub-ref"
              className="h-8"
              value={sarsRef}
              onChange={(e) => setSarsRef(e.target.value)}
              placeholder="e.g. VAT201 ref"
            />
          </div>
          <Button
            size="sm"
            disabled={upsert.isPending}
            onClick={() => {
              save({ status: 'submitted', submittedDate, sarsRef: sarsRef.trim() || undefined });
              setSubmitFormOpen(false);
            }}
          >
            {upsert.isPending ? 'Saving…' : 'Confirm — lock period'}
          </Button>
        </div>
      )}

      {refundFormOpen && (status === 'submitted' || status === 'verification') && (
        <div className="flex flex-wrap items-end gap-2 border-t pt-2">
          <div className="space-y-1">
            <Label htmlFor="ref-amount" className="text-xs">
              Refund amount
            </Label>
            <Input
              id="ref-amount"
              type="number"
              step="0.01"
              min="0"
              className="h-8"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder={formatZar(Math.abs(Math.min(fields.netVat, 0)))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-date" className="text-xs">
              Received on
            </Label>
            <Input
              id="ref-date"
              type="date"
              className="h-8"
              value={refundDate}
              onChange={(e) => setRefundDate(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={upsert.isPending}
            onClick={() => {
              save({
                status: 'refund_received',
                refundAmount: Number(refundAmount) || Math.abs(Math.min(fields.netVat, 0)),
                refundReceivedDate: refundDate,
              });
              setRefundFormOpen(false);
            }}
          >
            {upsert.isPending ? 'Saving…' : 'Record refund'}
          </Button>
        </div>
      )}

      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setVat201Open((v) => !v)}
      >
        {vat201Open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        VAT201 field values (transcribe into eFiling)
      </button>
      {vat201Open && (
        <table className="text-xs w-full max-w-md">
          <tbody>
            {vat201Rows(fields).map((row) => (
              <tr key={row.field} className="border-b last:border-0">
                <td className="py-1 pr-2 font-mono text-muted-foreground w-10">{row.field}</td>
                <td className="py-1 pr-2">{row.label}</td>
                <td className="py-1 text-right font-medium whitespace-nowrap">
                  {formatZar(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AlertDialog open={unlockConfirm} onOpenChange={setUnlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this VAT period?</AlertDialogTitle>
            <AlertDialogDescription>
              The period was already reported to SARS. Reopening unlocks transaction edits, so the
              ledger can drift from what was declared on the VAT201. This action is audit-logged at
              warning severity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep locked</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                save({ status: 'open' });
                setUnlockConfirm(false);
              }}
            >
              Reopen period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
