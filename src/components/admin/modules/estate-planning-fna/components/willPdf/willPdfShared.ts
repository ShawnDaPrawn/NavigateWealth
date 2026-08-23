/**
 * The shapes a stored will takes, and the labels and date formatting every
 * section renders with.
 *
 * Split out of `WillPdfView.tsx` (1,396 lines).
 */

export interface WillDataPayload {
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

export interface LivingWillDataPayload {
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

export interface WillRecord {
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

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_cop: 'Married in Community of Property',
  married_anc: 'Married ANC with Accrual',
  married_customary: 'Married under Customary Law',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

export const formatDate = (dateString: string): string => {
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
