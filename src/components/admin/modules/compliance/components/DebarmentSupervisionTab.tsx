import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useDebarmentRecords, useSupervisionRecords } from '../hooks';

const columns = [
  { key: 'title', label: 'Description', type: 'text' as const },
  { key: 'supervisionType', label: 'Type', type: 'text' as const },
  { key: 'frequency', label: 'Frequency', type: 'text' as const },
  { 
    key: 'progress', 
    label: 'Progress', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => {
      if (record.checkpointsTotal) {
        const percentage = (record.checkpointsCompleted / record.checkpointsTotal) * 100;
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {record.checkpointsCompleted}/{record.checkpointsTotal}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${
                  percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      }
      return record.checkResult || '—';
    }
  },
  { key: 'supervisionStatus', label: 'Status', type: 'badge' as const },
  { key: 'nextCheckpoint', label: 'Next Checkpoint', type: 'date' as const },
  { key: 'due', label: 'Due Date', type: 'date' as const }
];

export function DebarmentSupervisionTab() {
  const { data: debarments = [], isLoading: debarmentsLoading } = useDebarmentRecords();
  const { data: supervision = [], isLoading: supervisionLoading } = useSupervisionRecords();

  // Merge both data sources into a single list for the combined register view
  const records = [...(debarments as ComplianceRecord[]), ...(supervision as ComplianceRecord[])];
  const isLoading = debarmentsLoading || supervisionLoading;

  return (
    <ComplianceTable
      title="Debarment & Supervision Register"
      description="Debarment database checks and supervision plans/checkpoints for representatives and key individuals"
      records={records}
      columns={columns}
      loading={isLoading}
      onAdd={() => console.log('Add supervision record')}
      onEdit={(record) => console.log('Edit record:', record)}
      onExport={() => console.log('Export records')}
    />
  );
}