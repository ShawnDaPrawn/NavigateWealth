/**
 * Building blocks the Honeycomb check panels share (design CM-K-Identity,
 * CM-K-CDD): the client identification card, a check's result, and the
 * history table.
 */
import type React from 'react';
import { Loader2 } from 'lucide-react';
import { PanelCard, StatusPill } from './ComplianceShared';
import { checkStatusTone } from './complianceTypes';

export interface CheckRunResult {
  success: boolean;
  data?: Record<string, unknown>;
  matterId?: string;
  checkType?: string;
  error?: string;
}

export interface CheckHistoryEntry {
  id: string;
  checkType: string;
  submittedAt: string;
  status: string;
  summary: string;
  matterId: string | null;
}

export function ClientIdentificationCard({
  idNumber,
  passport,
  matterId,
  aside,
}: {
  idNumber: string | null;
  passport: string | null;
  matterId: string | null;
  /** The panel's main action, in the card's header row. */
  aside?: React.ReactNode;
}) {
  const maskedId = idNumber
    ? `${idNumber.substring(0, 6)}•••••${idNumber.substring(idNumber.length - 2)}`
    : null;
  return (
    <PanelCard title="Client identification" aside={aside}>
      <dl className="grid gap-4 sm:grid-cols-3">
        <IdField label="SA ID" value={maskedId} mono />
        <IdField label="Passport" value={passport ? `${passport.substring(0, 3)}•••` : null} mono />
        <IdField label="Matter ID" value={matterId} mono />
      </dl>
    </PanelCard>
  );
}

export function CheckHistoryCard({
  loading,
  history,
  emptyText,
  checkLabel,
  completeLabel,
}: {
  loading: boolean;
  history: CheckHistoryEntry[];
  emptyText: string;
  checkLabel: (entry: CheckHistoryEntry) => string;
  /** The pill text for a completed check, e.g. "Verification complete". */
  completeLabel: string;
}) {
  return (
    <PanelCard title="History">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" aria-hidden="true" />
        </div>
      ) : history.length === 0 ? (
        <p className="py-2 text-sm text-nw-text-3">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                <th scope="col" className="px-3 py-2.5">
                  Date
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Check
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Status
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-t border-nw-line align-top">
                  <td className="px-3 py-3 whitespace-nowrap text-nw-ink">
                    {new Date(entry.submittedAt).toLocaleString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-3 text-nw-ink">{checkLabel(entry)}</td>
                  <td className="px-3 py-3">
                    <StatusPill tone={checkStatusTone(entry.status)}>
                      {entry.status === 'completed'
                        ? completeLabel
                        : entry.status === 'failed'
                          ? 'Failed'
                          : entry.status}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-3 text-nw-text-2">{entry.summary || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}

function IdField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-nw-text-3">{label}</dt>
      <dd
        className={`mt-1 text-sm ${value ? 'text-nw-ink' : 'text-nw-text-3'} ${mono && value ? 'font-mono' : ''}`}
      >
        {value ?? 'Not set'}
      </dd>
    </div>
  );
}

export function CheckResult({
  result,
  successLabel,
  failureLabel,
  showDetails,
  onToggleDetails,
  photoMatch,
}: {
  result: CheckRunResult;
  successLabel: string;
  failureLabel: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  photoMatch?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-nw-line p-3 text-sm">
      <StatusPill tone={result.success ? 'good' : 'bad'}>
        {result.success ? successLabel : failureLabel}
      </StatusPill>
      {result.error && <p className="text-xs text-red-700">{result.error}</p>}
      {photoMatch !== undefined && (
        <p className={`text-xs font-medium ${photoMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
          {photoMatch ? 'Photo matches bureau records' : 'Photo match inconclusive or failed'}
        </p>
      )}
      {result.success && (
        <>
          {result.matterId && (
            <p className="text-xs text-nw-text-2">
              Matter ID <span className="font-mono text-nw-ink">{result.matterId}</span>
            </p>
          )}
          <button
            type="button"
            onClick={onToggleDetails}
            className="text-xs font-medium text-nw-violet hover:underline"
          >
            {showDetails ? 'Hide' : 'Show'} full response
          </button>
          {showDetails && (
            <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 font-mono text-xs text-gray-100">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
