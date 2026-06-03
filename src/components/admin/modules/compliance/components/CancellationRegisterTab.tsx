import { ComplianceTable } from './ComplianceTable';
import { logger } from '../../../../../utils/logger';

const columns = [
  { key: 'title', label: 'Client & Policy', type: 'text' as const },
  { key: 'policyNumber', label: 'Policy Number', type: 'text' as const },
  { key: 'cancellationDate', label: 'Cancellation Date', type: 'date' as const },
  { key: 'reason', label: 'Reason', type: 'text' as const },
  { key: 'adviser', label: 'Adviser', type: 'text' as const },
  { key: 'clawback', label: 'Clawback', type: 'currency' as const },
  { key: 'replacementStatus', label: 'Replacement Advice', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
];

export function CancellationRegisterTab() {
  return (
    <ComplianceTable
      title="Cancellation Register"
      description="Track policy cancellations, reasons, clawbacks, and potential replacements."
      records={[]} // No mock data
      columns={columns}
      onAdd={() => logger.info('Add cancellation record')}
      onEdit={(record) => logger.info('Edit cancellation record:', { record })}
      onExport={() => logger.info('Export cancellation register')}
    />
  );
}
