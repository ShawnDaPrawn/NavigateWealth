import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useRecordKeeping } from '../hooks';

const columns = [
  { key: 'title', label: 'Record Category', type: 'text' as const },
  { key: 'documentCategory', label: 'Document Type', type: 'text' as const },
  { key: 'productCategory', label: 'Product Category', type: 'text' as const },
  { key: 'retentionPeriod', label: 'Retention Period', type: 'text' as const },
  { key: 'recordCount', label: 'Record Count', type: 'number' as const },
  { key: 'storageLocation', label: 'Storage', type: 'text' as const },
  { key: 'legalBasis', label: 'Legal Basis', type: 'text' as const },
  { key: 'destructionDate', label: 'Destruction Date', type: 'date' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'documentCategory',
    label: 'Document Category',
    options: [
      { value: 'Advice Documentation', label: 'Advice Documentation' },
      { value: 'Marketing Materials', label: 'Marketing Materials' },
      { value: 'Complaints Register', label: 'Complaints Register' },
      { value: 'Client Files', label: 'Client Files' },
      { value: 'Training Records', label: 'Training Records' }
    ]
  },
  {
    key: 'storageLocation',
    label: 'Storage Location',
    options: [
      { value: 'Digital Archive', label: 'Digital Archive' },
      { value: 'Physical & Digital', label: 'Physical & Digital' },
      { value: 'Physical Archive', label: 'Physical Archive' }
    ]
  }
];

export function RecordKeepingTab() {
  const { data: records = [], isLoading } = useRecordKeeping();

  return (
    <ComplianceTable
      title="Record-keeping Register"
      description="Retention timers for advice documentation, advertisements, complaints (default 5 years, editable per record type)"
      records={records as ComplianceRecord[]}
      columns={columns}
      filters={filters}
      loading={isLoading}
      onAdd={() => console.log('Add record-keeping rule')}
      onEdit={(record) => console.log('Edit retention rule:', record)}
      onExport={() => console.log('Export retention schedule')}
    />
  );
}
