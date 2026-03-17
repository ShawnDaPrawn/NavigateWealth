import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { useAMLFICARecords } from '../hooks';

const columns = [
  { key: 'title', label: 'Client/Description', type: 'text' as const },
  { key: 'clientId', label: 'Client ID', type: 'text' as const },
  { key: 'kycStatus', label: 'KYC Status', type: 'badge' as const },
  { 
    key: 'riskRating', 
    label: 'Risk Rating', 
    type: 'custom' as const,
    render: (value: string) => {
      const colors = {
        'Low': 'bg-green-100 text-green-700 border-green-200',
        'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'High': 'bg-red-100 text-red-700 border-red-200'
      };
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colors[value as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
          {value}
        </span>
      );
    }
  },
  { key: 'pepStatus', label: 'PEP Status', type: 'text' as const },
  { key: 'sanctionsCheck', label: 'Sanctions', type: 'text' as const },
  { key: 'lastCTR', label: 'Last CTR', type: 'date' as const },
  { key: 'lastSTR', label: 'Last STR', type: 'date' as const },
  { key: 'trainingDate', label: 'Training Date', type: 'date' as const },
  { key: 'nextReview', label: 'Next Review', type: 'date' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'kycStatus',
    label: 'KYC Status',
    options: [
      { value: 'Complete', label: 'Complete' },
      { value: 'Pending Update', label: 'Pending Update' },
      { value: 'Under Review', label: 'Under Review' }
    ]
  },
  {
    key: 'riskRating',
    label: 'Risk Rating',
    options: [
      { value: 'Low', label: 'Low Risk' },
      { value: 'Medium', label: 'Medium Risk' },
      { value: 'High', label: 'High Risk' }
    ]
  },
  {
    key: 'pepStatus',
    label: 'PEP Status',
    options: [
      { value: 'No', label: 'Not PEP' },
      { value: 'Yes', label: 'PEP' },
      { value: 'Screening Required', label: 'Screening Required' }
    ]
  }
];

export function AMLFICATab() {
  const { data: records = [], isLoading } = useAMLFICARecords();

  const handleAdd = () => {
    console.log('Add new AML/FICA record');
  };

  const handleEdit = (record: ComplianceRecord) => {
    console.log('Edit AML/FICA record:', record);
  };

  const handleExport = () => {
    console.log('Export AML/FICA records');
  };

  return (
    <ComplianceTable
      title="AML / FICA Compliance Register"
      description="Client KYC status, risk ratings, PEP/sanctions screening, goAML queue (CTR/STR/TPR), and training records"
      records={records as ComplianceRecord[]}
      columns={columns}
      filters={filters}
      loading={isLoading}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onExport={handleExport}
    />
  );
}