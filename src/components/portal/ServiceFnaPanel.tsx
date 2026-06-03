/**
 * ServiceFnaPanel — inline Financial Needs Discovery for a single service domain
 */

import { forwardRef } from 'react';
import { Calculator } from 'lucide-react';
import { ClientFNAHub } from '../client/fna-intake/ClientFNAHub';
import { ClientFNAView } from '../client/ClientFNAView';
import { useFnaBatchStatus } from '@/shared/fna-intake/hooks/useFnaBatchStatus';
import { isFnaIntakeFeatureEnabled } from '@/shared/fna-intake/fna-intake-labels';
import type { FnaIntakeDomain } from '@/services/fna-intake-api';

type ServiceFnaType = FnaIntakeDomain;

interface ServiceFnaPanelProps {
  clientId: string;
  fnaType: ServiceFnaType;
  title?: string;
  description?: string;
  className?: string;
  /** When false, omits the section header (e.g. inside ServiceFnaModal). */
  showHeader?: boolean;
}

export const ServiceFnaPanel = forwardRef<HTMLDivElement, ServiceFnaPanelProps>(
  function ServiceFnaPanel(
    {
      clientId,
      fnaType,
      title = 'Financial Needs Discovery',
      description = 'Share your information or view your published analysis',
      className,
      showHeader = true,
    },
    ref,
  ) {
    const intakeEnabled = isFnaIntakeFeatureEnabled();
    const {
      data: batchFnaData,
      error: batchStatusError,
      isLoading: batchStatusLoading,
      refetch: refetchBatchStatus,
    } = useFnaBatchStatus(clientId, { enabled: !!clientId });

    return (
      <div
        ref={ref}
        id={`service-fna-panel-${fnaType}`}
        className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className ?? ''}`}
      >
        {showHeader && (
          <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <Calculator className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </div>
          </div>
        )}
        <div className={showHeader ? 'px-5 py-5 sm:px-6' : ''}>
          {intakeEnabled ? (
            <ClientFNAHub
              clientId={clientId}
              fnaType={fnaType}
              batchItem={batchFnaData?.find((item) => item.key === fnaType)}
              title={title}
              statusError={batchStatusError?.message ?? null}
              onRetryStatus={() => void refetchBatchStatus()}
              isStatusLoading={batchStatusLoading}
            />
          ) : (
            <ClientFNAView clientId={clientId} fnaType={fnaType} />
          )}
        </div>
      </div>
    );
  },
);
