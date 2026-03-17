/**
 * Client Management Module - Type Definitions
 *
 * SYNC NOTE (§9.3): These types mirror the shared contract defined in
 * /shared/types/client.ts. When modifying types here, the shared types
 * and the frontend module types must be updated in the same change.
 * The server cannot import from /shared/ due to Figma Make constraints.
 */

// Client with profile data
export interface Client {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  accountType: 'personal' | 'business';
  applicationStatus: 'none' | 'incomplete' | 'pending' | 'approved' | 'declined';
  suspended: boolean;
  deleted: boolean;
  accountStatus?: string;
  role: 'client' | 'admin';
  profile?: ClientProfile;
  application?: Record<string, unknown>;
}

// Client profile
export interface ClientProfile {
  userId: string;
  profileType: string;
  role: string;
  accountType: string;
  personalInformation?: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    idNumber?: string;
    passportNumber?: string;
    cellphone?: string;
    email?: string;
  };
  contactInformation?: {
    residentialAddress?: Address;
    postalAddress?: Address;
    workAddress?: Address;
  };
  employmentInformation?: {
    status?: string;
    occupation?: string;
    employer?: string;
    monthlyIncome?: string;
  };
  financialInformation?: {
    goals?: string[];
    investmentExperience?: string;
    riskTolerance?: string;
  };
  applicationId?: string;
  application_id?: string;
  applicationNumber?: string;
  applicationStatus?: string;
  adviserAssigned?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Flat legacy fields (some profiles store these at root level)
  [key: string]: unknown;
}

// Address
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

// Client security status
export interface ClientSecurity {
  suspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  twoFactorEnabled: boolean;
  last2faVerifiedAt?: string;
}

// Client filters
export interface ClientFilters {
  status?: string;
  accountType?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

// Paginated client response
export interface PaginatedClientResponse {
  clients: Client[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Client update data
export interface ClientUpdate {
  firstName?: string;
  lastName?: string;
  accountType?: 'personal' | 'business';
  profile?: Partial<ClientProfile>;
}

// Group matcher data (returned by clientToMatcherFormat)
export interface GroupMatcherData {
  id: string;
  gender?: unknown;
  country?: unknown;
  maritalStatus?: unknown;
  dateOfBirth?: unknown;
  occupation?: unknown;
  employmentStatus?: unknown;
  income?: unknown;
  netWorth?: unknown;
  dependants?: unknown;
  retirementAge?: unknown;
  age?: number;
  productIds: unknown[];
}

// Communication record (loosely-typed KV entry)
export interface CommunicationRecord {
  id?: string;
  created_at?: string;
  [key: string]: unknown;
}