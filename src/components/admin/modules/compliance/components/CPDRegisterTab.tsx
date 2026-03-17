import React from 'react';
import { ComplianceTable } from './ComplianceTable';

const columns = [
  { key: 'title', label: 'Activity/Training', type: 'text' as const },
  { key: 'representative', label: 'Representative', type: 'text' as const },
  { key: 'date', label: 'Date', type: 'date' as const },
  { key: 'hours', label: 'CPD Hours', type: 'text' as const },
  { key: 'provider', label: 'Provider', type: 'text' as const },
  { key: 'category', label: 'Category', type: 'text' as const },
  { key: 'verificationStatus', label: 'Verification', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

export function CPDRegisterTab() {
  return (
    <ComplianceTable
      title="CPD Register"
      description="Continuous Professional Development tracking for representatives."
      records={[]}
      columns={columns}
      onAdd={() => console.log('Add CPD record')}
      onEdit={(record) => console.log('Edit CPD record:', record)}
      onExport={() => console.log('Export CPD register')}
    />
  );
}
