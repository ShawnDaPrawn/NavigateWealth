/**
 * FNA Intake Queue — admin review of client-submitted intakes
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Inbox } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  acceptIntakeSession,
  listSubmittedIntakes,
  requestIntakeMoreInfo,
  type FnaIntakeDomain,
  type FnaIntakeSession,
} from '../../../../../services/fna-intake-api';
import { normalizeIntakeInputs } from '../../../../../services/form-prefill-api';
import type { PrefillResolveResponse } from '../../../../../shared/form-prefill/types';
import {
  mergePrefillValues,
  normalizeIntakeToWizard,
} from '../../../../../shared/form-prefill/intake-field-mapping';
import { FNAIntakeStatusBadge } from '@/shared/fna-intake/components/FNAIntakeStatusBadge';
import { PrefillReviewModal } from '../../form-prefill';
import { useClientList } from '../hooks/useClientList';
import type { IntakeHandoffState } from './IntakeWizardHandoff';

interface FNAIntakeQueueProps {
  onAccept?: (result: IntakeHandoffState) => void;
  onOpenClient?: (clientId: string) => void;
}

const DOMAIN_LABELS: Record<string, string> = {
  risk: 'Risk Planning',
  medical: 'Medical Aid',
  retirement: 'Retirement',
  investment: 'Investment INA',
  tax: 'Tax Planning',
  estate: 'Estate Planning',
};

export function FNAIntakeQueue({ onAccept, onOpenClient }: FNAIntakeQueueProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FnaIntakeSession[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<FnaIntakeSession | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillResult, setPrefillResult] = useState<PrefillResolveResponse | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessions = await listSubmittedIntakes();
      setItems(sessions);
    } catch {
      toast.error('Failed to load intake queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Names come from the client list the module already holds (same query key
  // as the list itself), so opening the queue costs no extra request. It used
  // to fetch the whole directory a second time and then read a field the
  // endpoint does not return, so every row fell back to the raw client id.
  const { clients } = useClientList();
  const clientNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const client of clients) {
      map[client.id] =
        [client.firstName, client.lastName].filter(Boolean).join(' ').trim() ||
        client.email ||
        client.id;
    }
    return map;
  }, [clients]);

  const clientNameFor = useCallback(
    (clientId: string) => clientNames[clientId] ?? clientId,
    [clientNames],
  );

  const finalizeAccept = async (
    session: FnaIntakeSession,
    mergedInputs: Record<string, unknown>,
  ) => {
    setActingId(session.id);
    try {
      const result = await acceptIntakeSession(session.id);
      toast.success('Intake accepted — adviser draft created');
      onAccept?.({
        clientId: result.clientId,
        clientName: clientNameFor(result.clientId),
        domain: result.domain as FnaIntakeDomain,
        linkedFnaId: result.linkedFnaId,
        initialStep: result.initialStep,
        inputs: mergePrefillValues(result.session?.inputs ?? session.inputs, mergedInputs),
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept intake');
    } finally {
      setActingId(null);
      setPendingSession(null);
      setReviewOpen(false);
    }
  };

  const handleAccept = async (session: FnaIntakeSession) => {
    setPendingSession(session);
    setPrefillLoading(true);
    setReviewOpen(true);
    try {
      const normalized = await normalizeIntakeInputs(
        session.domain,
        session.inputs,
        session.clientId,
      );
      setPrefillResult(normalized.prefill ?? null);
    } catch {
      setPrefillResult(null);
    } finally {
      setPrefillLoading(false);
    }
  };

  const handlePrefillApply = async (selectedFields: string[], overwriteConflicts: boolean) => {
    if (!pendingSession || !prefillResult) {
      if (pendingSession) {
        await finalizeAccept(
          pendingSession,
          normalizeIntakeToWizard(pendingSession.domain as FnaIntakeDomain, pendingSession.inputs),
        );
      }
      return;
    }

    const wizardBase = normalizeIntakeToWizard(
      pendingSession.domain as FnaIntakeDomain,
      pendingSession.inputs,
    );

    const overlay: Record<string, unknown> = {};
    for (const match of prefillResult.matches) {
      if (!selectedFields.includes(match.formField)) continue;
      if (match.conflict && !overwriteConflicts) continue;
      overlay[match.formField] = match.proposedValue;
    }

    await finalizeAccept(pendingSession, mergePrefillValues(wizardBase, overlay));
  };

  const handleRequestInfo = async (session: FnaIntakeSession) => {
    setActingId(session.id);
    try {
      await requestIntakeMoreInfo(session.id);
      toast.success('Returned to client for more information');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request info');
    } finally {
      setActingId(null);
    }
  };

  // An attention banner above the figures (design: CM 1). Nothing waiting,
  // or still loading, shows nothing.
  if (loading) return null;

  const fmtSubmitted = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString('en-ZA', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return (
    <>
      {items.length > 0 && (
        <section
          aria-label="FNA intake queue"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-nw-ink">
            <Inbox className="h-4 w-4 text-nw-amber-700" aria-hidden="true" />
            FNA intake queue · {items.length} waiting
          </div>
          <ul className="mt-2 max-h-[16rem] space-y-2 overflow-y-auto">
            {items.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-2 border-t border-amber-200/70 pt-2 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-nw-amber-700">
                  <span>{DOMAIN_LABELS[session.domain] ?? session.domain} FNA intake from</span>
                  <button
                    type="button"
                    className="font-medium text-nw-ink underline-offset-2 hover:underline"
                    onClick={() => onOpenClient?.(session.clientId)}
                  >
                    {clientNameFor(session.clientId)}
                  </button>
                  {session.submittedAt && (
                    <span>· submitted {fmtSubmitted(session.submittedAt)}</span>
                  )}
                  <FNAIntakeStatusBadge status="submitted" mode="adviser" />
                  <Badge variant="outline" className="bg-white text-[10px]">
                    {session.progressPercent}% complete
                  </Badge>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white"
                    disabled={actingId === session.id}
                    onClick={() => void handleRequestInfo(session)}
                  >
                    Request info
                  </Button>
                  <Button
                    size="sm"
                    disabled={actingId === session.id}
                    onClick={() => void handleAccept(session)}
                  >
                    Accept & open wizard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PrefillReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        loading={prefillLoading}
        result={prefillResult}
        onApply={(fields, overwrite) => void handlePrefillApply(fields, overwrite)}
        onSkip={() => {
          if (pendingSession) {
            void finalizeAccept(
              pendingSession,
              normalizeIntakeToWizard(
                pendingSession.domain as FnaIntakeDomain,
                pendingSession.inputs,
              ),
            );
          }
        }}
      />
    </>
  );
}
