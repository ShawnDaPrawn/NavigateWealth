import React from 'react';
import { ComplianceTable } from './ComplianceTable';
import { ComplianceRecord } from '../types';
import { usePOPIAConsents, usePAIARequests } from '../hooks';

const columns = [
  { key: 'title', label: 'Record Description', type: 'text' as const },
  { key: 'recordType', label: 'Type', type: 'text' as const },
  { 
    key: 'clientsAffected', 
    label: 'Clients Affected', 
    type: 'custom' as const,
    render: (value: number) => value ? value.toLocaleString() : '—'
  },
  { key: 'dataCategories', label: 'Data Categories', type: 'text' as const },
  { 
    key: 'compliance', 
    label: 'Compliance Status', 
    type: 'custom' as const,
    render: (_: unknown, record: ComplianceRecord) => {
      if (record.consentStatus) return record.consentStatus;
      if (record.requestStatus) return record.requestStatus;
      if (record.mitigationStatus) return record.mitigationStatus;
      if (record.publicationStatus) return record.publicationStatus;
      if (record.complianceStatus) return record.complianceStatus;
      return '—';
    }
  },
  { key: 'version', label: 'Version', type: 'text' as const },
  { key: 'lastAudit', label: 'Last Audit', type: 'date' as const },
  { key: 'due', label: 'Review Due', type: 'date' as const },
  { key: 'status', label: 'Status', type: 'badge' as const }
];

const filters = [
  {
    key: 'recordType',
    label: 'Record Type',
    options: [
      { value: 'Consent Management', label: 'Consent Management' },
      { value: 'Data Subject Access Request', label: 'DSAR' },
      { value: 'Data Breach', label: 'Data Breach' },
      { value: 'PAIA Manual', label: 'PAIA Manual' },
      { value: 'POPIA Manual', label: 'POPIA Manual' },
      { value: 'Data Retention Policy', label: 'Retention Policy' }
    ]
  },
  {
    key: 'dataCategories',
    label: 'Data Categories',
    options: [
      { value: 'Personal & Financial', label: 'Personal & Financial' },
      { value: 'Personal & Transaction', label: 'Personal & Transaction' },
      { value: 'Email Addresses', label: 'Email Addresses' }
    ]
  }
];

export function POPIAPAIATab() {
  const { data: consents = [], isLoading: consentsLoading } = usePOPIAConsents();
  const { data: paiaRequests = [], isLoading: paiaLoading } = usePAIARequests();

  // Merge both data sources into a single list for the combined register view
  const records = [...(consents as ComplianceRecord[]), ...(paiaRequests as ComplianceRecord[])];
  const isLoading = consentsLoading || paiaLoading;

  const handleAdd = () => {
    console.log('Add new POPIA/PAIA record');
  };

  const handleEdit = (record: ComplianceRecord) => {
    console.log('Edit POPIA/PAIA record:', record);
  };

  const handleExport = () => {
    console.log('Export POPIA/PAIA records');
  };

  return (
    <ComplianceTable
      title="POPIA / PAIA Compliance Register"
      description="Data protection consents, DSARs, breach log, PAIA/POPIA manual versions and compliance documentation"
      records={records}
      columns={columns}
      filters={filters}
      loading={isLoading}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onExport={handleExport}
    />
  );
}