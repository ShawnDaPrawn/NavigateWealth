import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useNewBusinessRecords } from '../hooks';

const columns = [
  { key: 'title', label: 'Client & Product', type: 'text' as const },
  { key: 'provider', label: 'Provider', type: 'text' as const },
  { key: 'productType', label: 'Product Type', type: 'text' as const },
  { key: 'policyNumber', label: 'Policy Number', type: 'text' as const },
  { 
    key: 'businessFlags', 
    label: 'Business Type', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => (
      <div className="space-y-1">
        {(record as Record<string, unknown>).replacementBusiness && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">
            Replacement
          </span>
        )}
        {(record as Record<string, unknown>).section14Transfer && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
            Section 14
          </span>
        )}
        {!(record as Record<string, unknown>).replacementBusiness && !(record as Record<string, unknown>).section14Transfer && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-700">
            New Business
          </span>
        )}
      </div>
    )
  },
  { 
    key: 'commission', 
    label: 'Commission', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => (
      <div className="text-sm">
        <div>R{(record as Record<string, unknown>).commissionAmount != null ? Number((record as Record<string, unknown>).commissionAmount).toLocaleString() : ''}</div>
        <div className="text-xs text-muted-foreground">{String((record as Record<string, unknown>).commissionType || '')}</div>
      </div>
    )
  },
  { key: 'clawbackExpiry', label: 'Clawback Expiry', type: 'date' as const },
  { key: 'businessStatus', label: 'Business Status', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'productType',
    label: 'Product Type',
    options: [
      { value: 'Life Insurance', label: 'Life Insurance' },
      { value: 'Medical Aid', label: 'Medical Aid' },
      { value: 'Retirement Annuity', label: 'Retirement Annuity' },
      { value: 'Investment', label: 'Investment' }
    ]
  },
  {
    key: 'businessStatus',
    label: 'Business Status',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Pending Acceptance', label: 'Pending Acceptance' },
      { value: 'Documentation Outstanding', label: 'Documentation Outstanding' }
    ]
  }
];

export function NewBusinessRegisterTab() {
  const { data: records = [], isLoading } = useNewBusinessRecords();

  return (
    <ComplianceTable
      title="New Business Register"
      description="Product/provider pipeline tracking, Section 14/replacement flags, commission & clawback periods, and documentation status"
      records={records as ComplianceRecord[]}
      columns={columns}
      filters={filters}
      loading={isLoading}
      onAdd={() => console.log('Add new business record')}
      onEdit={(record) => console.log('Edit business record:', record)}
      onExport={() => console.log('Export new business register')}
    />
  );
}