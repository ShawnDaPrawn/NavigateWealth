/**
 * ClientFNAHub — routes between intake, waiting, and published results
 */

import { useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { AlertCircle, CheckCircle, Clock, Eye, PlayCircle } from 'lucide-react';
import { ClientFNAView } from '../ClientFNAView';
import { ClientFNAIntakeWizard } from './ClientFNAIntakeWizard';
import { FNAIntakeStatusBadge } from '@/shared/fna-intake/components/FNAIntakeStatusBadge';
import { getFnaStatusDescription, resolveFnaHubView } from '@/shared/fna-intake/fna-intake-labels';
import type { BatchFNAStatusItem } from '@/shared/fna-intake/hooks/useFnaBatchStatus';
import type { FnaIntakeDomain } from '../../../services/fna-intake-api';

type ClientFnaType = 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';

type HubIntakeMode = 'none' | 'edit' | 'view';

interface ClientFNAHubProps {
  clientId: string;
  fnaType: ClientFnaType;
  batchItem?: BatchFNAStatusItem;
  title?: string;
  statusError?: string | null;
  onRetryStatus?: () => void;
  isStatusLoading?: boolean;
}

export function ClientFNAHub({
  clientId,
  fnaType,
  batchItem,
  title,
  statusError,
  onRetryStatus,
  isStatusLoading,
}: ClientFNAHubProps) {
  const [intakeMode, setIntakeMode] = useState<HubIntakeMode>('none');

  const view = useMemo(() => {
    if (intakeMode !== 'none') return 'intake';
    return resolveFnaHubView(batchItem?.status);
  }, [batchItem?.status, intakeMode]);

  const domain = fnaType as FnaIntakeDomain;
  const status = batchItem?.status ?? 'not_started';
  const requestInfoAt =
    typeof batchItem?.data?.requestInfoAt === 'string' ? batchItem.data.requestInfoAt : null;

  if (view === 'results') {
    return <ClientFNAView clientId={clientId} fnaType={fnaType} />;
  }

  if (view === 'intake') {
    return (
      <ClientFNAIntakeWizard
        clientId={clientId}
        domain={domain}
        readOnly={intakeMode === 'view'}
        onComplete={() => setIntakeMode('none')}
        onCancel={() => setIntakeMode('none')}
      />
    );
  }

  const description = getFnaStatusDescription(status, 'client', { requestInfoAt });

  return (
    <div className="space-y-4">
      {statusError && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            We could not load your needs analysis status. You can still start or continue your
            discovery.
          </span>
          {onRetryStatus && (
            <Button variant="outline" size="sm" onClick={onRetryStatus} disabled={isStatusLoading}>
              {isStatusLoading ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        </div>
      )}
      {requestInfoAt && status === 'client_draft' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Action needed:</strong> Your adviser needs more information. Open your discovery
          form to update and resubmit.
        </div>
      )}

      <Card className="border-gray-200">
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {status === 'submitted' || status === 'draft' ? (
                  <Clock className="h-5 w-5 text-blue-600" />
                ) : status === 'client_draft' ? (
                  <PlayCircle className="h-5 w-5 text-purple-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
                <h3 className="text-lg font-semibold text-gray-900">
                  {title ?? 'Financial Needs Discovery'}
                </h3>
                <FNAIntakeStatusBadge status={status} mode="client" />
              </div>
              <p className="text-sm leading-relaxed text-gray-600">{description}</p>
              {batchItem?.data && typeof batchItem.data.progressPercent === 'number' && (
                <p className="text-xs text-gray-500">
                  Progress: {batchItem.data.progressPercent as number}%
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(status === 'not_started' || status === 'client_draft') && (
                <Button
                  onClick={() => setIntakeMode('edit')}
                  className="bg-primary text-primary-foreground"
                >
                  {status === 'client_draft' ? 'Continue' : 'Start your needs analysis'}
                </Button>
              )}
              {status === 'submitted' && (
                <Button variant="outline" onClick={() => setIntakeMode('view')}>
                  <Eye className="mr-2 h-4 w-4" />
                  View your submission
                </Button>
              )}
              {status === 'submitted' || status === 'draft' ? (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <CheckCircle className="h-4 w-4" />
                  With your adviser — not advice until published
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {status === 'not_started' && (
        <Card className="border-purple-100 bg-purple-50/40">
          <CardContent className="py-4 text-sm text-gray-700">
            <strong>You prepare. We analyse. Together we plan.</strong> Share your financial facts
            here so your adviser can review, calculate, and publish your formal needs analysis.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
