import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceColumn, DocumentsInsuranceRecord } from '../types';
import { useDocumentsInsuranceRecords } from '../hooks/useDocumentsInsuranceRecords';

const columns: ComplianceColumn[] = [
  { key: 'title', label: 'Document', type: 'text' as const },
  { key: 'documentType', label: 'Type', type: 'text' as const },
  { key: 'version', label: 'Version', type: 'text' as const },
  { 
    key: 'insurance', 
    label: 'Insurance Details', 
    type: 'custom' as const,
    render: (_, record) => {
      // Cast to DocumentsInsuranceRecord to access specific fields safely
      const docRecord = record as DocumentsInsuranceRecord;
      
      if (docRecord.sumInsured) {
        return (
          <div className="text-sm">
            <div>Sum: R{docRecord.sumInsured.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{docRecord.insuranceProvider}</div>
          </div>
        );
      }
      return '—';
    }
  },
  { key: 'approvedBy', label: 'Approved By', type: 'text' as const },
  { key: 'effectiveDate', label: 'Effective Date', type: 'date' as const },
  { key: 'reviewCycle', label: 'Review Cycle', type: 'text' as const },
  { key: 'due', label: 'Next Review', type: 'date' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'documentType',
    label: 'Document Type',
    options: [
      { value: 'Compliance Manual', label: 'Compliance Manual' },
      { value: 'RMCP', label: 'RMCP' },
      { value: 'PI Insurance', label: 'PI Insurance' },
      { value: 'COI Policy', label: 'COI Policy' },
      { value: 'TCF Policy', label: 'TCF Policy' }
    ]
  }
];

export function DocumentsInsuranceTab() {
  const { records, loading } = useDocumentsInsuranceRecords();

  return (
    <ComplianceTable
      title="Documents & Insurance Register"
      description="Policy library (Compliance Manual, RMCP, COI, TCF, POPIA/PAIA) and Professional Indemnity insurance tracking"
      records={records}
      columns={columns}
      filters={filters}
      loading={loading}
      onAdd={() => console.log('Add document/insurance record')}
      onEdit={(record) => console.log('Edit record:', record)}
      onExport={() => console.log('Export records')}
    />
  );
}
