import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useConflictRecords, useMarketingRecords } from '../hooks';
import { logger } from '../../../../../utils/logger';

const columns = [
  { key: 'title', label: 'Description', type: 'text' as const },
  { key: 'conflictType', label: 'Type', type: 'text' as const },
  { key: 'value', label: 'Value', type: 'currency' as const },
  { key: 'provider', label: 'Provider/Party', type: 'text' as const },
  { key: 'approvalStatus', label: 'Approval Status', type: 'badge' as const },
  { key: 'retentionPeriod', label: 'Retention', type: 'text' as const },
  { key: 'mitigationActions', label: 'Mitigation', type: 'text' as const },
  { key: 'due', label: 'Retention Until', type: 'date' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
];

export function ConflictsMarketingTab() {
  const { data: conflicts = [], isLoading: conflictsLoading } = useConflictRecords();
  const { data: marketing = [], isLoading: marketingLoading } = useMarketingRecords();

  // Merge both data sources into a single list for the combined register view
  const records = [...(conflicts as ComplianceRecord[]), ...(marketing as ComplianceRecord[])];
  const isLoading = conflictsLoading || marketingLoading;

  return (
    <ComplianceTable
      title="Conflicts & Marketing Register"
      description="Conflict of interest register (gifts/benefits) and marketing material approvals with 5+ year retention"
      records={records}
      columns={columns}
      loading={isLoading}
      onAdd={() => logger.info('Add conflict/marketing record')}
      onEdit={(record) => logger.info('Edit record:', { record })}
      onExport={() => logger.info('Export records')}
    />
  );
}
