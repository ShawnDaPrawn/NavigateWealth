/**
 * Will PDF View
 * Renders a drafted will in the Navigate Wealth base PDF template.
 * Handles multi-page pagination so content never bleeds over the footer.
 *
 * Uses the BasePdfLayout component for consistent branding and A4 structure.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Loader2, Printer, X, Download } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { BasePdfLayout, BASE_PDF_CSS } from '../../resources/templates/BasePdfLayout';
import { downloadWillPdf, type WillRecord as WillRecordPdf } from '../utils/will-pdf-generator';

// ── Types ──────────────────────────────────────────────────────────
interface WillDataPayload {
  personalDetails: {
    fullName: string;
    idNumber: string;
    dateOfBirth: string;
    maritalStatus: string;
    spouseName?: string;
    spouseIdNumber?: string;
    physicalAddress: string;
  };
  executors: Array<{
    id: string;
    type: 'individual' | 'professional';
    name: string;
    idNumber?: string;
    company?: string;
    contactDetails: string;
  }>;
  beneficiaries: Array<{
    id: string;
    name: string;
    idNumber: string;
    relationship: string;
    percentage: number;
  }>;
  guardians: Array<{
    id: string;
    name: string;
    idNumber: string;
    relationship: string;
    address: string;
  }>;
  specificBequests: Array<{
    id: string;
    itemDescription: string;
    beneficiaryName: string;
    beneficiaryIdNumber: string;
  }>;
  residueDistribution: string;
  funeralWishes: string;
  additionalClauses: string;
}

interface LivingWillDataPayload {
  personalDetails: {
    fullName: string;
    idNumber: string;
    dateOfBirth: string;
    maritalStatus: string;
    spouseName?: string;
    spouseIdNumber?: string;
    physicalAddress: string;
  };
  healthcareAgents: Array<{
    id: string;
    name: string;
    idNumber: string;
    relationship: string;
    contactDetails: string;
    isPrimary: boolean;
  }>;
  lifeSustainingTreatment: {
    ventilator: string;
    cpr: string;
    artificialNutrition: string;
    dialysis: string;
    antibiotics: string;
    additionalInstructions: string;
  };
  painManagement: {
    comfortCareOnly: boolean;
    maximumPainRelief: boolean;
    additionalInstructions: string;
  };
  organDonation: {
    isDonor: boolean;
    donationType: string;
    specificOrgans: string;
    additionalInstructions: string;
  };
  funeralWishes: string;
  additionalDirectives: string;
}

interface WillRecord {
  id: string;
  clientId: string;
  clientName: string;
  type: 'last_will' | 'living_will';
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  version: string;
  createdBy: string;
  data: WillDataPayload | LivingWillDataPayload;
}

interface WillPdfViewProps {
  open: boolean;
  onClose: () => void;
  willId: string;
  clientName: string;
}

// ── Helpers ────────────────────────────────────────────────────────
const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_cop: 'Married in Community of Property',
  married_anc: 'Married ANC with Accrual',
  married_customary: 'Married under Customary Law',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

// ── PDF Content Sections ──────────────────────────────────────────
// Each section returns HTML-like JSX. We render all sections into a
// single flow and let BasePdfLayout's multi-page support handle pagination.

function SectionPreamble({ data }: { data: WillDataPayload }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">1.</span>
        <h2>Preamble</h2>
      </div>
      <div className="callout" style={{ marginTop: '2mm' }}>
        <p style={{ fontSize: '9.5px', lineHeight: 1.5 }}>
          I, <strong>{data.personalDetails.fullName || '___________________'}</strong>,
          Identity Number <strong>{data.personalDetails.idNumber || '___________________'}</strong>,
          born on <strong>{formatDate(data.personalDetails.dateOfBirth)}</strong>,
          residing at <strong>{data.personalDetails.physicalAddress || '___________________'}</strong>,
          being of sound mind and under no duress, hereby revoke all former wills and testamentary
          dispositions previously made by me and declare this to be my Last Will and Testament.
        </p>
      </div>
    </div>
  );
}

function SectionPersonalDetails({ data }: { data: WillDataPayload }) {
  const pd = data.personalDetails;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">2.</span>
        <h2>Personal Information</h2>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Full Legal Name</th>
            <td>{pd.fullName || '-'}</td>
          </tr>
          <tr>
            <th>Identity Number</th>
            <td>{pd.idNumber || '-'}</td>
          </tr>
          <tr>
            <th>Date of Birth</th>
            <td>{formatDate(pd.dateOfBirth)}</td>
          </tr>
          <tr>
            <th>Marital Status</th>
            <td>{MARITAL_STATUS_LABELS[pd.maritalStatus] || pd.maritalStatus}</td>
          </tr>
          {pd.maritalStatus?.startsWith('married') && pd.spouseName && (
            <tr>
              <th>Spouse</th>
              <td>{pd.spouseName}{pd.spouseIdNumber ? ` (ID: ${pd.spouseIdNumber})` : ''}</td>
            </tr>
          )}
          <tr>
            <th>Physical Address</th>
            <td>{pd.physicalAddress || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionExecutors({ executors }: { executors: WillDataPayload['executors'] }) {
  if (executors.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">3.</span>
        <h2>Appointment of Executor(s)</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I hereby nominate and appoint the following person(s) as executor(s) of this my Last Will and Testament:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '25%' }}>Name</th>
            <th style={{ width: '15%' }}>Type</th>
            <th style={{ width: '20%' }}>ID / Company</th>
            <th style={{ width: '35%' }}>Contact Details</th>
          </tr>
        </thead>
        <tbody>
          {executors.map((exec, idx) => (
            <tr key={exec.id}>
              <td>{idx + 1}</td>
              <td>{exec.name}</td>
              <td>{exec.type === 'professional' ? 'Professional' : 'Individual'}</td>
              <td>{exec.type === 'professional' ? (exec.company || '-') : (exec.idNumber || '-')}</td>
              <td>{exec.contactDetails || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBeneficiaries({ beneficiaries }: { beneficiaries: WillDataPayload['beneficiaries'] }) {
  if (beneficiaries.length === 0) return null;
  const total = beneficiaries.reduce((s, b) => s + b.percentage, 0);
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">4.</span>
        <h2>Beneficiaries &amp; Distribution of Estate</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        Subject to the specific bequests herein below, the residue of my estate shall be distributed as follows:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '30%' }}>Name</th>
            <th style={{ width: '20%' }}>ID Number</th>
            <th style={{ width: '20%' }}>Relationship</th>
            <th style={{ width: '12%' }}>Share (%)</th>
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((ben, idx) => (
            <tr key={ben.id}>
              <td>{idx + 1}</td>
              <td>{ben.name}</td>
              <td>{ben.idNumber || '-'}</td>
              <td>{ben.relationship || '-'}</td>
              <td style={{ textAlign: 'right' }}>{ben.percentage}%</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right' }}>Total</td>
            <td style={{ fontWeight: 700, textAlign: 'right', color: total === 100 ? '#16a34a' : '#dc2626' }}>
              {total}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionGuardians({ guardians }: { guardians: WillDataPayload['guardians'] }) {
  if (guardians.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">5.</span>
        <h2>Guardianship of Minor Children</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        In the event of my death, I nominate and appoint the following person(s) as guardian(s) of my minor children:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '25%' }}>Name</th>
            <th style={{ width: '15%' }}>ID Number</th>
            <th style={{ width: '15%' }}>Relationship</th>
            <th style={{ width: '40%' }}>Address</th>
          </tr>
        </thead>
        <tbody>
          {guardians.map((g, idx) => (
            <tr key={g.id}>
              <td>{idx + 1}</td>
              <td>{g.name}</td>
              <td>{g.idNumber || '-'}</td>
              <td>{g.relationship || '-'}</td>
              <td>{g.address || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionBequests({ bequests }: { bequests: WillDataPayload['specificBequests'] }) {
  if (bequests.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">6.</span>
        <h2>Specific Bequests</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I bequeath the following specific items to the persons named below:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '40%' }}>Item / Description</th>
            <th style={{ width: '30%' }}>Beneficiary</th>
            <th style={{ width: '25%' }}>ID Number</th>
          </tr>
        </thead>
        <tbody>
          {bequests.map((beq, idx) => (
            <tr key={beq.id}>
              <td>{idx + 1}</td>
              <td>{beq.itemDescription}</td>
              <td>{beq.beneficiaryName}</td>
              <td>{beq.beneficiaryIdNumber || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionFuneralWishes({ funeralWishes, additionalClauses }: { funeralWishes: string; additionalClauses: string }) {
  const hasFuneral = funeralWishes && funeralWishes.trim().length > 0;
  const hasAdditional = additionalClauses && additionalClauses.trim().length > 0;
  if (!hasFuneral && !hasAdditional) return null;

  // Calculate section number dynamically based on what's rendered
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">7.</span>
        <h2>Funeral Wishes &amp; Additional Clauses</h2>
      </div>
      {hasFuneral && (
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Funeral Wishes:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{funeralWishes}</p>
          </div>
        </div>
      )}
      {hasAdditional && (
        <div>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Additional Clauses:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{additionalClauses}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLegalNotice() {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">8.</span>
        <h2>Legal Notice</h2>
      </div>
      <div className="callout" style={{
        background: '#fffbeb',
        borderColor: '#fde68a',
      }}>
        <p style={{ fontSize: '9px', lineHeight: 1.5, color: '#92400e' }}>
          <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for review purposes only.
          It does not constitute a valid Last Will and Testament until it has been printed, signed by the testator
          in the presence of two competent witnesses (who must also sign), in compliance with the requirements
          of the Wills Act 7 of 1953 (South Africa). Navigate Wealth recommends that the testator seek
          independent legal advice before executing this will.
        </p>
      </div>
    </div>
  );
}

function SectionSignatures({ data }: { data: WillDataPayload }) {
  return (
    <div className="section" style={{ marginTop: '8mm' }}>
      <div className="section-head">
        <span className="num">9.</span>
        <h2>Signatures</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '4mm' }}>
        Signed at _________________________ on this _________ day of _________________________ 20______
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '4mm' }}>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>TESTATOR</p>
          <div className="signature-box" style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>
            {data.personalDetails.fullName || 'Full Name'}
          </p>
        </div>
        <div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '6mm' }}>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 1</p>
          <div className="signature-box" style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 2</p>
          <div className="signature-box" style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div className="signature-line" style={{ marginTop: '10mm' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
        </div>
      </div>
    </div>
  );
}

// ── Living Will Section Components ─────────────────────────────────

const TREATMENT_PREF_LABELS: Record<string, string> = {
  accept: 'Accept',
  refuse: 'Refuse',
  limited: 'Limited Trial',
};

function LivingWillPreamble({ data }: { data: LivingWillDataPayload }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">1.</span>
        <h2>Declaration</h2>
      </div>
      <div className="callout" style={{ marginTop: '2mm' }}>
        <p style={{ fontSize: '9.5px', lineHeight: 1.5 }}>
          I, <strong>{data.personalDetails.fullName || '___________________'}</strong>,
          Identity Number <strong>{data.personalDetails.idNumber || '___________________'}</strong>,
          born on <strong>{formatDate(data.personalDetails.dateOfBirth)}</strong>,
          residing at <strong>{data.personalDetails.physicalAddress || '___________________'}</strong>,
          being of sound and disposing mind and memory, make this Living Will to express my wishes
          regarding medical treatment and end-of-life care in the event that I am unable to communicate
          my decisions.
        </p>
      </div>
    </div>
  );
}

function LivingWillPersonalDetails({ data }: { data: LivingWillDataPayload }) {
  const pd = data.personalDetails;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">2.</span>
        <h2>Personal Information</h2>
      </div>
      <table>
        <tbody>
          <tr><th>Full Legal Name</th><td>{pd.fullName || '-'}</td></tr>
          <tr><th>Identity Number</th><td>{pd.idNumber || '-'}</td></tr>
          <tr><th>Date of Birth</th><td>{formatDate(pd.dateOfBirth)}</td></tr>
          <tr><th>Physical Address</th><td>{pd.physicalAddress || '-'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionHealthcareAgents({ agents }: { agents: LivingWillDataPayload['healthcareAgents'] }) {
  if (!agents || agents.length === 0) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">3.</span>
        <h2>Healthcare Agent / Proxy</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        I appoint the following person(s) to make healthcare decisions on my behalf:
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '22%' }}>Name</th>
            <th style={{ width: '15%' }}>ID Number</th>
            <th style={{ width: '15%' }}>Relationship</th>
            <th style={{ width: '25%' }}>Contact</th>
            <th style={{ width: '12%' }}>Priority</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a, idx) => (
            <tr key={a.id}>
              <td>{idx + 1}</td>
              <td>{a.name}</td>
              <td>{a.idNumber || '-'}</td>
              <td>{a.relationship || '-'}</td>
              <td>{a.contactDetails || '-'}</td>
              <td>{a.isPrimary ? 'Primary' : 'Alternate'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTreatmentPreferences({ treatment }: { treatment: LivingWillDataPayload['lifeSustainingTreatment'] }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">4.</span>
        <h2>Life-Sustaining Treatment Preferences</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '2mm' }}>
        In the event of a terminal condition, persistent vegetative state, or irreversible coma:
      </p>
      <table>
        <tbody>
          <tr><th>Mechanical Ventilation</th><td>{TREATMENT_PREF_LABELS[treatment.ventilator] || '-'}</td></tr>
          <tr><th>CPR</th><td>{TREATMENT_PREF_LABELS[treatment.cpr] || '-'}</td></tr>
          <tr><th>Artificial Nutrition &amp; Hydration</th><td>{TREATMENT_PREF_LABELS[treatment.artificialNutrition] || '-'}</td></tr>
          <tr><th>Dialysis</th><td>{TREATMENT_PREF_LABELS[treatment.dialysis] || '-'}</td></tr>
          <tr><th>Antibiotics</th><td>{TREATMENT_PREF_LABELS[treatment.antibiotics] || '-'}</td></tr>
        </tbody>
      </table>
      {treatment.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Additional Instructions:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{treatment.additionalInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPainManagement({ painMgmt }: { painMgmt: LivingWillDataPayload['painManagement'] }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">5.</span>
        <h2>Pain Management &amp; Comfort Care</h2>
      </div>
      <table>
        <tbody>
          <tr><th>Comfort Care Only</th><td>{painMgmt.comfortCareOnly ? 'Yes' : 'No'}</td></tr>
          <tr><th>Maximum Pain Relief</th><td>{painMgmt.maximumPainRelief ? 'Yes' : 'No'}</td></tr>
        </tbody>
      </table>
      {painMgmt.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Additional Instructions:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{painMgmt.additionalInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionOrganDonation({ donation }: { donation: LivingWillDataPayload['organDonation'] }) {
  const donationTypeLabel = donation.donationType === 'all' ? 'All organs and tissues'
    : donation.donationType === 'specific' ? 'Specific organs only' : 'None';
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">6.</span>
        <h2>Organ Donation</h2>
      </div>
      <table>
        <tbody>
          <tr><th>Organ Donor</th><td>{donation.isDonor ? 'Yes' : 'No'}</td></tr>
          {donation.isDonor && <tr><th>Donation Type</th><td>{donationTypeLabel}</td></tr>}
          {donation.donationType === 'specific' && donation.specificOrgans && (
            <tr><th>Specific Organs</th><td>{donation.specificOrgans}</td></tr>
          )}
        </tbody>
      </table>
      {donation.additionalInstructions && (
        <div style={{ marginTop: '2mm' }}>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{donation.additionalInstructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLivingWillWishes({ funeralWishes, additionalDirectives }: { funeralWishes: string; additionalDirectives: string }) {
  const hasFuneral = funeralWishes && funeralWishes.trim().length > 0;
  const hasDirectives = additionalDirectives && additionalDirectives.trim().length > 0;
  if (!hasFuneral && !hasDirectives) return null;
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">7.</span>
        <h2>Funeral &amp; End-of-Life Wishes</h2>
      </div>
      {hasFuneral && (
        <div style={{ marginBottom: '3mm' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Funeral Wishes:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{funeralWishes}</p>
          </div>
        </div>
      )}
      {hasDirectives && (
        <div>
          <p style={{ fontSize: '9.5px', fontWeight: 700, marginBottom: '1mm' }}>Additional Directives:</p>
          <div className="callout">
            <p style={{ fontSize: '9.5px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{additionalDirectives}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LivingWillLegalNotice() {
  return (
    <div className="section">
      <div className="section-head">
        <span className="num">8.</span>
        <h2>Legal Notice</h2>
      </div>
      <div className="callout" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <p style={{ fontSize: '9px', lineHeight: 1.5, color: '#92400e' }}>
          <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for review purposes only.
          It does not constitute a valid Living Will until it has been printed, signed by the declarant
          in the presence of two competent witnesses (who must also sign). Navigate Wealth recommends that the
          declarant seek independent legal advice before executing this living will.
        </p>
      </div>
    </div>
  );
}

function LivingWillSignatures({ data }: { data: LivingWillDataPayload }) {
  return (
    <div className="section" style={{ marginTop: '8mm' }}>
      <div className="section-head">
        <span className="num">9.</span>
        <h2>Signatures</h2>
      </div>
      <p style={{ fontSize: '9.5px', lineHeight: 1.5, marginBottom: '4mm' }}>
        Signed at _________________________ on this _________ day of _________________________ 20______
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '4mm' }}>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>DECLARANT</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>
            {data.personalDetails.fullName || 'Full Name'}
          </p>
        </div>
        <div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm', marginTop: '6mm' }}>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 1</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
        </div>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, marginBottom: '1mm' }}>WITNESS 2</p>
          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
            <div style={{ marginTop: '10mm', borderBottom: '1px solid #000' }}></div>
          </div>
          <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
          <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export function WillPdfView({ open, onClose, willId, clientName }: WillPdfViewProps) {
  const [will, setWill] = useState<WillRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !willId) return;
    loadWill();
  }, [open, willId]);

  const loadWill = async () => {
    setIsLoading(true);
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
      const response = await fetch(`${API_BASE}/estate-planning-fna/wills/${willId}`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load will: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load will');
      }

      setWill(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading will for PDF view:', errorMessage);
      toast.error(`Failed to load will: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = useCallback(() => {
    if (!will?.data) return;

    // For living wills, use the jsPDF generator which already handles both types
    if (will.type === 'living_will') {
      try {
        downloadWillPdf(will as unknown as WillRecordPdf);
        toast.success('Living Will PDF generated — you can print from your PDF viewer.');
      } catch (err) {
        console.error('Error generating living will PDF for print:', err);
        toast.error('Failed to generate PDF for printing');
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please allow pop-ups.');
      return;
    }

    const data = will.data;
    const displayDate = formatDate(will.createdAt);
    const status = will.status === 'draft' ? 'DRAFT' : will.status.toUpperCase();

    // Build the sections HTML
    const sectionsHtml = `
      <div class="section">
        <div class="section-head">
          <span class="num">1.</span>
          <h2>Preamble</h2>
        </div>
        <div class="callout" style="margin-top:2mm;">
          <p style="font-size:9.5px;line-height:1.5;">
            I, <strong>${data.personalDetails.fullName || '___________________'}</strong>,
            Identity Number <strong>${data.personalDetails.idNumber || '___________________'}</strong>,
            born on <strong>${formatDate(data.personalDetails.dateOfBirth)}</strong>,
            residing at <strong>${data.personalDetails.physicalAddress || '___________________'}</strong>,
            being of sound mind and under no duress, hereby revoke all former wills and testamentary
            dispositions previously made by me and declare this to be my Last Will and Testament.
          </p>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <span class="num">2.</span>
          <h2>Personal Information</h2>
        </div>
        <table>
          <tbody>
            <tr><th>Full Legal Name</th><td>${data.personalDetails.fullName || '-'}</td></tr>
            <tr><th>Identity Number</th><td>${data.personalDetails.idNumber || '-'}</td></tr>
            <tr><th>Date of Birth</th><td>${formatDate(data.personalDetails.dateOfBirth)}</td></tr>
            <tr><th>Marital Status</th><td>${MARITAL_STATUS_LABELS[data.personalDetails.maritalStatus] || data.personalDetails.maritalStatus}</td></tr>
            ${data.personalDetails.spouseName ? `<tr><th>Spouse</th><td>${data.personalDetails.spouseName}${data.personalDetails.spouseIdNumber ? ` (ID: ${data.personalDetails.spouseIdNumber})` : ''}</td></tr>` : ''}
            <tr><th>Physical Address</th><td>${data.personalDetails.physicalAddress || '-'}</td></tr>
          </tbody>
        </table>
      </div>

      ${data.executors.length > 0 ? `
      <div class="section">
        <div class="section-head">
          <span class="num">3.</span>
          <h2>Appointment of Executor(s)</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          I hereby nominate and appoint the following person(s) as executor(s) of this my Last Will and Testament:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th style="width:15%">Type</th><th style="width:20%">ID / Company</th><th style="width:35%">Contact Details</th></tr></thead>
          <tbody>
            ${data.executors.map((e, i) => `<tr><td>${i+1}</td><td>${e.name}</td><td>${e.type === 'professional' ? 'Professional' : 'Individual'}</td><td>${e.type === 'professional' ? (e.company || '-') : (e.idNumber || '-')}</td><td>${e.contactDetails || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${data.beneficiaries.length > 0 ? `
      <div class="section">
        <div class="section-head">
          <span class="num">4.</span>
          <h2>Beneficiaries &amp; Distribution of Estate</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          Subject to the specific bequests herein below, the residue of my estate shall be distributed as follows:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:30%">Name</th><th style="width:20%">ID Number</th><th style="width:20%">Relationship</th><th style="width:12%">Share (%)</th></tr></thead>
          <tbody>
            ${data.beneficiaries.map((b, i) => `<tr><td>${i+1}</td><td>${b.name}</td><td>${b.idNumber || '-'}</td><td>${b.relationship || '-'}</td><td style="text-align:right">${b.percentage}%</td></tr>`).join('')}
            <tr><td colspan="4" style="font-weight:700;text-align:right">Total</td><td style="font-weight:700;text-align:right">${data.beneficiaries.reduce((s, b) => s + b.percentage, 0)}%</td></tr>
          </tbody>
        </table>
      </div>` : ''}

      ${data.guardians.length > 0 ? `
      <div class="section">
        <div class="section-head">
          <span class="num">5.</span>
          <h2>Guardianship of Minor Children</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          In the event of my death, I nominate and appoint the following person(s) as guardian(s) of my minor children:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:25%">Name</th><th style="width:15%">ID Number</th><th style="width:15%">Relationship</th><th style="width:40%">Address</th></tr></thead>
          <tbody>
            ${data.guardians.map((g, i) => `<tr><td>${i+1}</td><td>${g.name}</td><td>${g.idNumber || '-'}</td><td>${g.relationship || '-'}</td><td>${g.address || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${data.specificBequests.length > 0 ? `
      <div class="section">
        <div class="section-head">
          <span class="num">6.</span>
          <h2>Specific Bequests</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:2mm;">
          I bequeath the following specific items to the persons named below:
        </p>
        <table>
          <thead><tr><th style="width:5%">#</th><th style="width:40%">Item / Description</th><th style="width:30%">Beneficiary</th><th style="width:25%">ID Number</th></tr></thead>
          <tbody>
            ${data.specificBequests.map((b, i) => `<tr><td>${i+1}</td><td>${b.itemDescription}</td><td>${b.beneficiaryName}</td><td>${b.beneficiaryIdNumber || '-'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${(data.funeralWishes || data.additionalClauses) ? `
      <div class="section">
        <div class="section-head">
          <span class="num">7.</span>
          <h2>Funeral Wishes &amp; Additional Clauses</h2>
        </div>
        ${data.funeralWishes ? `
          <p style="font-size:9.5px;font-weight:700;margin-bottom:1mm;">Funeral Wishes:</p>
          <div class="callout"><p style="font-size:9.5px;line-height:1.5;white-space:pre-wrap;">${data.funeralWishes}</p></div>
        ` : ''}
        ${data.additionalClauses ? `
          <p style="font-size:9.5px;font-weight:700;margin-bottom:1mm;margin-top:3mm;">Additional Clauses:</p>
          <div class="callout"><p style="font-size:9.5px;line-height:1.5;white-space:pre-wrap;">${data.additionalClauses}</p></div>
        ` : ''}
      </div>` : ''}

      <div class="section">
        <div class="section-head">
          <span class="num">8.</span>
          <h2>Legal Notice</h2>
        </div>
        <div class="callout" style="background:#fffbeb;border-color:#fde68a;">
          <p style="font-size:9px;line-height:1.5;color:#92400e;">
            <strong>Important:</strong> This document is a draft prepared by Navigate Wealth for review purposes only.
            It does not constitute a valid Last Will and Testament until it has been printed, signed by the testator
            in the presence of two competent witnesses (who must also sign), in compliance with the requirements
            of the Wills Act 7 of 1953 (South Africa). Navigate Wealth recommends that the testator seek
            independent legal advice before executing this will.
          </p>
        </div>
      </div>

      <div class="section" style="margin-top:8mm;">
        <div class="section-head">
          <span class="num">9.</span>
          <h2>Signatures</h2>
        </div>
        <p style="font-size:9.5px;line-height:1.5;margin-bottom:4mm;">
          Signed at _________________________ on this _________ day of _________________________ 20______
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:4mm;">
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">TESTATOR</p>
            <div class="signature-box" style="border:1px solid #d1d5db;border-radius:4px;padding:4px;">
              <div class="signature-line" style="margin-top:10mm;"></div>
            </div>
            <p style="font-size:8.5px;color:#6b7280;margin-top:1mm;">${data.personalDetails.fullName || 'Full Name'}</p>
          </div>
          <div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm;">
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">WITNESS 1</p>
            <div class="signature-box" style="border:1px solid #d1d5db;border-radius:4px;padding:4px;">
              <div class="signature-line" style="margin-top:10mm;"></div>
            </div>
            <p style="font-size:8.5px;color:#6b7280;margin-top:1mm;">Full Name: _______________________________</p>
            <p style="font-size:8.5px;color:#6b7280;">ID Number: _______________________________</p>
          </div>
          <div>
            <p style="font-size:9px;font-weight:700;margin-bottom:1mm;">WITNESS 2</p>
            <div className="signature-box" style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px' }}>
              <div className="signature-line" style={{ marginTop: '10mm' }}></div>
            </div>
            <p style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1mm' }}>Full Name: _______________________________</p>
            <p style={{ fontSize: '8.5px', color: '#6b7280' }}>ID Number: _______________________________</p>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Last Will and Testament - ${data.personalDetails.fullName} - Navigate Wealth</title>
  <style>
    ${BASE_PDF_CSS}
    /* Override for print: allow content to flow across pages naturally */
    .pdf-page {
      height: auto !important;
      min-height: var(--a4-h);
      overflow: visible !important;
      page-break-after: auto !important;
    }
    .pdf-content {
      height: auto !important;
      padding-bottom: var(--margin-bottom) !important;
    }
    .pdf-footer {
      position: relative !important;
      bottom: auto !important;
      margin-top: 8mm;
    }
    /* Ensure sections don't break across pages mid-section */
    .section {
      page-break-inside: avoid;
    }
    /* Allow tables to break if they are very long */
    table {
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
    }
    /* Signatures should stay together */
    .section:last-child {
      page-break-inside: avoid;
    }
    @media print {
      .pdf-page {
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">
          <div class="top-masthead">
            <div class="masthead-left">LAST WILL AND TESTAMENT &mdash; ${status}</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">Last Will and Testament</h1>
                <div class="meta-grid">
                  <div class="meta-k">Client</div>
                  <div class="meta-v">${data.personalDetails.fullName}</div>
                  <div class="meta-k">Date Created</div>
                  <div class="meta-v">${displayDate}</div>
                  <div class="meta-k">Status</div>
                  <div class="meta-v">${status}</div>
                  <div class="meta-k">Version</div>
                  <div class="meta-v">${will.version || '1.0'}</div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0;" />
          <main>
            ${sectionsHtml}
          </main>
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">Page 1</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider - FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, [will]);

  const handleDownload = useCallback(() => {
    if (!will) return;
    try {
      downloadWillPdf(will as unknown as WillRecordPdf);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    }
  }, [will]);

  if (!open) return null;

  const data = will?.data;
  const status = will?.status === 'draft' ? 'DRAFT' : (will?.status || '').toUpperCase();
  const displayDate = will ? formatDate(will.createdAt) : '';
  // Use client name from will data if available, fallback to prop
  const displayClientName = data?.personalDetails?.fullName || clientName;

  const willTypeLabel = will?.type === 'living_will' ? 'Living Will' : 'Last Will and Testament';

  // Build the page content sections for the PDF layout
  const buildPages = (): React.ReactNode[] => {
    if (!data) return [];

    // Living Will — render living will specific sections
    if (will?.type === 'living_will') {
      const lwData = data as unknown as LivingWillDataPayload;
      return [
        <div key="living-will-content">
          <LivingWillPreamble data={lwData} />
          <LivingWillPersonalDetails data={lwData} />
          <SectionHealthcareAgents agents={lwData.healthcareAgents} />
          <SectionTreatmentPreferences treatment={lwData.lifeSustainingTreatment} />
          <SectionPainManagement painMgmt={lwData.painManagement} />
          <SectionOrganDonation donation={lwData.organDonation} />
          <SectionLivingWillWishes
            funeralWishes={lwData.funeralWishes}
            additionalDirectives={lwData.additionalDirectives}
          />
          <LivingWillLegalNotice />
          <LivingWillSignatures data={lwData} />
        </div>
      ];
    }

    // Last Will — render standard sections
    const lwData = data as WillDataPayload;
    return [
      <div key="will-content">
        <SectionPreamble data={lwData} />
        <SectionPersonalDetails data={lwData} />
        <SectionExecutors executors={lwData.executors} />
        <SectionBeneficiaries beneficiaries={lwData.beneficiaries} />
        <SectionGuardians guardians={lwData.guardians} />
        <SectionBequests bequests={lwData.specificBequests} />
        <SectionFuneralWishes
          funeralWishes={lwData.funeralWishes}
          additionalClauses={lwData.additionalClauses}
        />
        <SectionLegalNotice />
        <SectionSignatures data={lwData} />
      </div>
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[900px] max-h-[95vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold">
              {willTypeLabel} {status ? `(${status})` : ''}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayClientName} {displayDate ? `- Created ${displayDate}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-4" ref={contentRef}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9] mb-3" />
              <p className="text-sm text-muted-foreground">Loading will document...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">Unable to load will data.</p>
            </div>
          ) : (
            <div className="contents">
              {/* Override: allow content to flow naturally in preview instead of clipping at A4 height.
                  Print/PDF output uses the separate print handler which opens a new window with proper pagination. */}
              <style dangerouslySetInnerHTML={{ __html: `
                .will-pdf-preview .pdf-page {
                  height: auto !important;
                  min-height: var(--a4-h);
                  overflow: visible !important;
                }
                .will-pdf-preview .pdf-content {
                  height: auto !important;
                  min-height: 100%;
                }
                .will-pdf-preview .pdf-footer {
                  position: relative !important;
                  bottom: auto !important;
                  margin-top: 8mm;
                }
              `}} />
              <div className="will-pdf-preview">
                <BasePdfLayout
                  pages={buildPages()}
                  docTitle={willTypeLabel}
                  issueDate={displayDate}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}