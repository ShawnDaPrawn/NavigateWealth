export type UserRole = 'super_admin' | 'admin' | 'adviser' | 'paraplanner' | 'compliance' | 'viewer';
export type PersonnelStatus = 'active' | 'suspended' | 'pending';
export type FSCAStatus = 'active' | 'debarred' | 'pending';

export interface PersonnelDocument {
  id: string;
  name: string;
  type: 'qualification' | 'cpd' | 'identification' | 'other';
  url: string;
  uploadedAt: string;
  expiryDate?: string;
}

export interface PersonnelProfile {
  id: string; // Links to auth.users.id
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: PersonnelStatus;
  
  // Professional Details
  jobTitle?: string;
  branch?: string;
  managerId?: string; // Reporting line
  
  // Compliance & Regulatory
  fspReference?: string;
  fscaStatus?: FSCAStatus;
  qualifications?: {
    re5: boolean;
    cfp: boolean;
    cob: boolean; // Class of Business
    other?: string[];
  };
  cpdPoints?: {
    year: number;
    points: number;
    required: number;
  }[];
  documents?: PersonnelDocument[];
  
  // Commission & Revenue
  commissionSplit: number; // e.g., 0.70 for 70%
  commissionEntity?: 'personal' | 'company';
  commissionReference?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  invitedAt?: string;
}

export interface CreatePersonnelPayload {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status?: PersonnelStatus;
  commissionSplit?: number;
  fscaStatus?: FSCAStatus;
}