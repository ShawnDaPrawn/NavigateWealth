/**
 * FNA Intake Queue — admin review of client-submitted intakes
 */

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { BrandSectionLoader } from '../../../../ui/brand-loader';
import {
  acceptIntakeSession,
  listSubmittedIntakes,
  requestIntakeMoreInfo,
  type FnaIntakeDomain,
  type FnaIntakeSession,
} from '../../../../../services/fna-intake-api';
import { normalizeIntakeInputs } from '../../../../../services/form-prefill-api';
import type { FormPrefillId, PrefillResolveResponse } from '../../../../../shared/form-prefill/types';
import { mergePrefillValues, normalizeIntakeToWizard } from '../../../../../shared/form-prefill/intake-field-mapping';
import { FNAIntakeStatusBadge } from '@/shared/fna-intake/components/FNAIntakeStatusBadge';
import { PrefillReviewModal } from '../../form-prefill/PrefillReviewModal';
import { clientApi } from '../api';
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

function intakeFormId(domain: FnaIntakeDomain): FormPrefillId {
  const map: Record<FnaIntakeDomain, FormPrefillId> = {
    risk: 'risk-fna-step1',
    medical: 'medical-fna-step1',
    retirement: 'retirement-fna-step1',
    tax: 'tax-fna-step1',
    estate: 'estate-fna-step1',
    investment: 'investment-ina-step1',
  };
  return map[domain];
}

export function FNAIntakeQueue({ onAccept, onOpenClient }: FNAIntakeQueueProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FnaIntakeSession[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
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

  useEffect(() => {
    void (async () => {
      try {
        const response = await clientApi.getClients({ perPage: 500 });
        const map: Record<string, string> = {};
        for (const entry of response.clients ?? []) {
          const e = entry as { id: string; email?: string; fullName?: string; firstName?: string; lastName?: string };
          const name =
            e.fullName ||
            [e.firstName, e.lastName].filter(Boolean).join(' ').trim() ||
            e.email ||
            e.id;
          map[e.id] = name;
        }
        setClientNames(map);
      } catch {
        // Queue still works with client IDs if lookup fails
      }
    })();
  }, []);

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
    const formId = intakeFormId(session.domain as FnaIntakeDomain);
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

  if (loading) {
    return (
      <BrandSectionLoader title="Loading intake queue" message="Fetching submitted client intakes." />
    );
  }

  return (
    <>
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-base">FNA Intake Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No client intakes awaiting review.</p>
          ) : (
            items.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {DOMAIN_LABELS[session.domain] ?? session.domain}
                    </p>
                    <FNAIntakeStatusBadge status="submitted" mode="adviser" />
                    <Badge variant="outline" className="text-[10px]">
                      {session.progressPercent}% complete
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Client:{' '}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => onOpenClient?.(session.clientId)}
                    >
                      {clientNameFor(session.clientId)}
                    </button>
                  </p>
                  {session.submittedAt && (
                    <p className="text-xs text-gray-500">
                      Submitted: {new Date(session.submittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === session.id}
                    onClick={() => void handleRequestInfo(session)}
                  >
                    Request info
                  </Button>
                  <Button
                    size="sm"
                    disabled={actingId === session.id}
                    onClick={() => void handleAccept(session)}
                    className="bg-primary text-primary-foreground"
                  >
                    Accept & open wizard
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
              normalizeIntakeToWizard(pendingSession.domain as FnaIntakeDomain, pendingSession.inputs),
            );
          }
        }}
      />
    </>
  );
}
