import React from 'react';
import { toast } from 'sonner@2.0.3';
import { ComplianceTable } from './ComplianceTable';
import { useFAISRecords } from '../hooks/useFAISRecords';
import { ComplianceRecord, FAISRecord } from '../types';

const columns = [
  { key: 'title', label: 'Name & Role', type: 'text' as const },
  { key: 'reNumber', label: 'RE Number', type: 'text' as const },
  { key: 'reStatus', label: 'RE Status', type: 'badge' as const },
  { key: 'reExpiry', label: 'RE Expiry', type: 'date' as const },
  { key: 'cob', label: 'COB', type: 'text' as const },
  { key: 'pst', label: 'PST Category', type: 'text' as const },
  { 
    key: 'cpdProgress', 
    label: 'CPD Hours', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => {
      // Type guard or safe cast
      const faisRecord = record as FAISRecord;
      if (typeof faisRecord.cpdHours === 'undefined' || typeof faisRecord.cpdRequired === 'undefined') {
        return <span>—</span>;
      }
      
      return (
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {faisRecord.cpdHours}/{faisRecord.cpdRequired}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full ${
                faisRecord.cpdHours >= faisRecord.cpdRequired 
                  ? 'bg-green-500' 
                  : faisRecord.cpdHours >= faisRecord.cpdRequired * 0.7 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min((faisRecord.cpdHours / faisRecord.cpdRequired) * 100, 100)}%` }}
            />
          </div>
        </div>
      );
    }
  },
  { key: 'supervisionPlan', label: 'Supervision', type: 'text' as const },
  { key: 'status', label: 'Status', type: 'badge' as const },
  { key: 'due', label: 'Review Due', type: 'date' as const }
];

const filters = [
  {
    key: 'reStatus',
    label: 'RE Status',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Lapsed', label: 'Lapsed' },
      { value: 'Application Submitted', label: 'Pending' }
    ]
  },
  {
    key: 'ragStatus',
    label: 'RAG Status',
    options: [
      { value: 'green', label: 'Green' },
      { value: 'amber', label: 'Amber' },
      { value: 'red', label: 'Red' }
    ]
  }
];

export function FAISTab() {
  const { records, loading } = useFAISRecords();

  const handleAdd = () => {
    toast.info('Add FAIS record functionality coming soon');
  };

  const handleEdit = (record: ComplianceRecord) => {
    toast.info('Edit FAIS record functionality coming soon');
  };

  const handleExport = () => {
    toast.info('Export FAIS records functionality coming soon');
  };

  return (
    <ComplianceTable
      title="FAIS Fit & Proper Register"
      description="Key Individuals and Representatives - RE status, COB/PST categories, CPD compliance, and supervision requirements"
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