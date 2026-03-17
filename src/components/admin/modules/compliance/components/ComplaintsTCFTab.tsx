import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useComplaints } from '../hooks';

const columns = [
  { key: 'title', label: 'Complaint Description', type: 'text' as const },
  { key: 'complaintId', label: 'ID', type: 'text' as const },
  { key: 'complaintType', label: 'Type', type: 'text' as const },
  { key: 'channel', label: 'Channel', type: 'text' as const },
  { key: 'productType', label: 'Product', type: 'text' as const },
  { 
    key: 'tat', 
    label: 'TAT Progress', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => (
      <div className="space-y-1">
        <div className="text-sm font-medium">
          {record.tatDays}/{record.targetTAT} days
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full ${
              record.tatDays <= record.targetTAT * 0.7
                ? 'bg-green-500' 
                : record.tatDays <= record.targetTAT 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min((record.tatDays / record.targetTAT) * 100, 100)}%` }}
          />
        </div>
      </div>
    )
  },
  { key: 'outcome', label: 'Outcome', type: 'badge' as const },
  { 
    key: 'redressAmount', 
    label: 'Redress', 
    type: 'custom' as const,
    render: (value: number) => value > 0 ? `R${value.toLocaleString()}` : '—'
  },
  { key: 'tcfOutcome', label: 'TCF Outcome', type: 'text' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'complaintType',
    label: 'Complaint Type',
    options: [
      { value: 'Claim Dispute', label: 'Claim Dispute' },
      { value: 'Premium Dispute', label: 'Premium Dispute' },
      { value: 'Service Quality', label: 'Service Quality' },
      { value: 'Mis-selling', label: 'Mis-selling' },
      { value: 'Administrative', label: 'Administrative' }
    ]
  },
  {
    key: 'outcome',
    label: 'Outcome',
    options: [
      { value: 'In Progress', label: 'In Progress' },
      { value: 'Upheld - Partial', label: 'Upheld - Partial' },
      { value: 'Upheld - Resolved', label: 'Upheld - Resolved' },
      { value: 'Under Investigation', label: 'Under Investigation' }
    ]
  }
];

export function ComplaintsTCFTab() {
  const { data: records = [], isLoading } = useComplaints();

  return (
    <ComplianceTable
      title="Complaints & TCF Register"
      description="Customer complaints register with turnaround times, outcomes, redress amounts and TCF outcome mapping"
      records={records as ComplianceRecord[]}
      columns={columns}
      filters={filters}
      loading={isLoading}
      onAdd={() => console.log('Add complaint')}
      onEdit={(record) => console.log('Edit complaint:', record)}
      onExport={() => console.log('Export complaints')}
    />
  );
}