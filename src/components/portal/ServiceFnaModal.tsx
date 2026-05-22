/**
 * ServiceFnaModal — shared Needs Analysis modal for client service dashboards
 */

import React from 'react';
import { Calculator } from 'lucide-react';
import { ClientFNAHub } from '../client/fna-intake/ClientFNAHub';
import { ClientFNAView } from '../client/ClientFNAView';
import { useFnaBatchStatus } from '@/shared/fna-intake/hooks/useFnaBatchStatus';
import { isFnaIntakeFeatureEnabled } from '@/shared/fna-intake/fna-intake-labels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type ServiceFnaType = 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';

interface ServiceFnaModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  fnaType: ServiceFnaType;
  title: string;
  description?: string;
}

export function ServiceFnaModal({
  open,
  onClose,
  clientId,
  fnaType,
  title,
  description = 'Share your information or view your published analysis',
}: ServiceFnaModalProps) {
  const intakeEnabled = isFnaIntakeFeatureEnabled();
  const {
    data: batchFnaData,
    error: batchStatusError,
    isLoading: batchStatusLoading,
    refetch: refetchBatchStatus,
  } = useFnaBatchStatus(clientId, { enabled: open && !!clientId });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Calculator className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
