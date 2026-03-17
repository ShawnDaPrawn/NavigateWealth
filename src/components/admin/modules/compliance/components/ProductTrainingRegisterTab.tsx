import React from 'react';
import { ComplianceTable } from './ComplianceTable';

const columns = [
  { key: 'title', label: 'Product Name', type: 'text' as const },
  { key: 'provider', label: 'Product Supplier', type: 'text' as const },
  { key: 'representative', label: 'Representative', type: 'text' as const },
  { key: 'completionDate', label: 'Completion Date', type: 'date' as const },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' as const },
  { key: 'assessmentScore', label: 'Score', type: 'text' as const },
  { key: 'competencyStatus', label: 'Competency', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

export function ProductTrainingRegisterTab() {
  return (
    <ComplianceTable
      title="Product Specific Training Register"
      description="Track product specific training completion and competency for representatives."
      records={[]}
      columns={columns}
      onAdd={() => console.log('Add training record')}
      onEdit={(record) => console.log('Edit training record:', record)}
      onExport={() => console.log('Export training register')}
    />
  );
}
