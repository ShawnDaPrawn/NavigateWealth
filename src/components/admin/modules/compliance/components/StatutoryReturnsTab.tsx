import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { useStatutoryRecords } from '../hooks/useStatutoryRecords';
import { ComplianceRecord, StatutoryRecord } from '../types';

const columns = [
  { key: 'title', label: 'Return Description', type: 'text' as const },
  { key: 'returnType', label: 'Type', type: 'text' as const },
  { key: 'submissionDate', label: 'Submitted', type: 'date' as const },
  { key: 'due', label: 'Due Date', type: 'date' as const },
  { key: 'receiptNumber', label: 'Receipt Number', type: 'text' as const },
  { 
    key: 'ratios', 
    label: 'Key Ratios', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => {
      const statRecord = record as StatutoryRecord;
      if (statRecord.liquidityRatio) {
        return (
          <div className="text-sm">
            <div>Liquidity: {statRecord.liquidityRatio}</div>
            <div className="text-xs text-muted-foreground">Min: {statRecord.minimumRequired}</div>
          </div>
        );
      }
      if (statRecord.capitalRatio) {
        return (
          <div className="text-sm">
            <div>Capital: {statRecord.capitalRatio}%</div>
            <div className="text-xs text-muted-foreground">Min: {statRecord.minimumRequired}%</div>
          </div>
        );
      }
      return '—';
    }
  },
  { key: 'auditFirm', label: 'Audit Firm', type: 'text' as const },
  { key: 'auditOpinion', label: 'Opinion', type: 'text' as const },
  { key: 'filingStatus', label: 'Filing Status', type: 'badge' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'returnType',
    label: 'Return Type',
    options: [
      { value: 'Annual Financial Statements', label: 'AFS' },
      { value: 'Section 19(3) Liquidity', label: 'Liquidity' },
      { value: 'Capital Adequacy', label: 'Capital' },
      { value: 'Independent Audit Report', label: 'Audit' }
    ]
  },
  {
    key: 'filingStatus',
    label: 'Filing Status',
    options: [
      { value: 'Submitted & Accepted', label: 'Accepted' },
      { value: 'In Preparation', label: 'In Preparation' },
      { value: 'Overdue', label: 'Overdue' }
    ]
  }
];

export function StatutoryReturnsTab() {
  const { records, loading } = useStatutoryRecords();

  const handleAdd = () => {
    console.log('Add new statutory return');
  };

  const handleEdit = (record: ComplianceRecord) => {
    console.log('Edit statutory return:', record);
  };

  const handleExport = () => {
    console.log('Export statutory returns');
  };

  return (
    <ComplianceTable
      title="Statutory Returns Register"
      description="Annual Financial Statements, Section 19(3) liquidity/audit returns, submission dates and regulatory receipts"
      records={records}
      columns={columns}
      filters={filters}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onExport={handleExport}
      loading={loading}
    />
  );
}