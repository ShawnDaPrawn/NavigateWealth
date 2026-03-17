/**
 * Corporate & Governance Panel
 *
 * Phase 2 endpoints:
 * - CIPC Company Search: POST /natural-person-cipc
 * - Director Enquiry: POST /natural-person-director-enquiry
 *
 * Shows companies associated with the client via CIPC records,
 * and their directorship history.
 */

import React from 'react';
import {
  Building2,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import { HoneycombActionCard } from './HoneycombActionCard';

interface CorporateGovernancePanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

export function CorporateGovernancePanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  passport,
  hasIdentification,
  onCheckComplete,
}: CorporateGovernancePanelProps) {
  const baseBody = {
    clientId,
    firstName,
    lastName,
    idNumber,
    passport,
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <p className="text-xs text-purple-700">
          These checks query the CIPC (Companies and Intellectual Property Commission) registry
          and directorship records to identify company associations, active directorships,
          and governance roles for <strong>{firstName} {lastName}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CIPC Company Search */}
        <HoneycombActionCard
          title="CIPC Company Search"
          description="Search the Companies and Intellectual Property Commission registry for companies associated with this person's ID number."
          icon={<Building2 className="h-5 w-5 text-purple-600" />}
          actionLabel="Run CIPC Search"
          endpoint="corporate/cipc"
          requestBody={baseBody}
          variant="default"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />

        {/* Director Enquiry */}
        <HoneycombActionCard
          title="Director Enquiry"
          description="Query directorship records to find all companies where this person has been or is currently appointed as a director."
          icon={<Users className="h-5 w-5 text-blue-600" />}
          actionLabel="Run Director Enquiry"
          endpoint="corporate/director-enquiry"
          requestBody={baseBody}
          variant="blue"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />
      </div>

      {/* ──── Phase 3: Tenders Blue List ──── */}
      <HoneycombActionCard
        title="Tenders Blue List"
        description="Search government tender records (National Treasury Blue List) for tender awards, participation, and restricted supplier entries linked to this person."
        icon={<FileSpreadsheet className="h-5 w-5 text-blue-600" />}
        actionLabel="Search Tenders Blue List"
        endpoint="corporate/tenders-blue"
        requestBody={baseBody}
        variant="blue"
        disabled={!hasIdentification}
        disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
        onSuccess={onCheckComplete}
      />
    </div>
  );
}