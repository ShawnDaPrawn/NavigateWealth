/**
 * ServiceFnaModal — shared Needs Analysis modal for client service dashboards
 */

import { ServiceFnaPanel } from './ServiceFnaPanel';
import type { FnaIntakeDomain } from '@/services/fna-intake-api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

interface ServiceFnaModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  fnaType: FnaIntakeDomain;
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
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ServiceFnaPanel
          clientId={clientId}
          fnaType={fnaType}
          title={title}
          description={description}
          showHeader={false}
          className="border-0 shadow-none"
        />
      </DialogContent>
    </Dialog>
  );
}
