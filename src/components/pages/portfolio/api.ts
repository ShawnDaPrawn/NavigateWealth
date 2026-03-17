/**
 * Client Portal — Portfolio API Layer
 * Data boundary for the client-facing portfolio dashboard (Guidelines §5.1)
 *
 * All server communication goes through this layer.
 * Raw errors are caught here and transformed into typed results.
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { getSupabaseClient } from '../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/client-portal`;
const CALENDAR_API = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/calendar`;
const DOCUMENTS_API = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents`;

/**
 * Retrieve the current user's Supabase access token (JWT).
 * Falls back to publicAnonKey if no active session exists.
 * This ensures authenticated routes (e.g. calendar) receive a valid JWT
 * rather than the anon key, which would fail requireAuth checks.
 */
async function getAccessToken(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || publicAnonKey;
  } catch {
    return publicAnonKey;
  }
}

export interface PortfolioClientData {
  firstName: string;
  lastName: string;
  memberNumber: string;
  totalWealthValue: number;
  lastUpdated: string;
  riskTolerance: string;
  financialScore: number;
}

export interface FinancialPillar {
  status: string;
  statusText: string;
  nextReview: string;
  [key: string]: unknown;
}

export interface PortfolioFinancialOverview {
  retirement: FinancialPillar & {
    currentValue: number;
    projectedValue: number;
    monthlyContribution: number;
    progressToGoal: number;
  };
  risk: FinancialPillar & {
    deathCover: number;
    disabilityCover: number;
    criticalIllnessCover: number;
  };
  investment: FinancialPillar & {
    totalValue: number;
    monthlyContribution: number;
    goalsLinked: number;
    performance: string;
  };
  estate: FinancialPillar & {
    willStatus: string;
    trustStatus: string;
    nominationStatus: string;
    lastUpdated: string;
  };
  medicalAid: FinancialPillar & {
    scheme: string;
    plan: string;
    monthlyPremium: number;
    dependants: number;
  };
  tax: FinancialPillar & {
    returnStatus: string;
    estimatedRefund: number;
    taxYear: number;
    filingDate: string;
  };
}

export interface PortfolioRecommendation {
  id: string;
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  iconSlug: string;
  title: string;
  description: string;
  action: string;
  dueDate: string;
}

export interface PortfolioDocument {
  id: string;
  documentType: string;
  category: string;
  uploaded: boolean;
  uploadDate: string | null;
  downloadUrl: string | null;
}

export interface PortfolioEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  time: string | null;
  status: string;
}

/** Per-product policy detail returned by the server (Guidelines §9.3) */
export interface ProductHolding {
  id: string;
  category: string;
  provider: string;
  product: string;
  policyNumber: string;
  value: number;
  premium: number;
  status: string;
}

/** Adviser details resolved from the client's assigned adviser profile */
export interface AdviserDetails {
  name: string;
  email: string;
  phone: string;
  fspReference: string;
}

export interface PortfolioSummary {
  clientData: PortfolioClientData;
  financialOverview: PortfolioFinancialOverview;
  recommendations: PortfolioRecommendation[];
  recentDocuments: PortfolioDocument[];
  upcomingEvents: PortfolioEvent[];
  productHoldings: ProductHolding[];
  adviserDetails: AdviserDetails;
}

/**
 * Fetch the aggregated portfolio summary for a client
 */
export async function fetchPortfolioSummary(clientId: string): Promise<PortfolioSummary> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE}/portfolio/${clientId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Failed to fetch portfolio summary (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch portfolio summary');
  }

  return result.data;
}

/**
 * Input shape for booking a meeting request via the client portal
 */
export interface BookMeetingInput {
  meetingType: string;
  preferredTime: string;
  format: string;
  notes: string;
  clientId: string;
  clientName: string;
}

/**
 * Input shape for uploading a document via the client portal
 */
export interface UploadDocumentInput {
  file: File;
  title: string;
  category: string;
  userId: string;
}

/**
 * Submit a meeting booking request via the calendar API.
 * Creates a calendar event of type 'meeting' for the client.
 *
 * Uses the user's real session access token (not anon key) because
 * POST /calendar/events uses requireAuth middleware.
 */
export async function bookMeeting(
  input: BookMeetingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();

    // Compute a date roughly 3 business days from now as default
    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 3);
    const dateStr = proposedDate.toISOString().split('T')[0];

    const body = {
      title: `${input.meetingType} — ${input.clientName}`,
      description: input.notes || `${input.meetingType} requested by client`,
      type: 'meeting',
      date: dateStr,
      startDate: dateStr,
      startTime: input.preferredTime === 'morning'
        ? '09:00'
        : input.preferredTime === 'afternoon'
        ? '13:00'
        : '17:00',
      endTime: input.preferredTime === 'morning'
        ? '10:00'
        : input.preferredTime === 'afternoon'
        ? '14:00'
        : '18:00',
      status: 'pending',
      clientId: input.clientId,
      format: input.format,
    };

    const response = await fetch(`${CALENDAR_API}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('bookMeeting API error:', response.status, errText);
      return { success: false, error: `Failed to book meeting (${response.status})` };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('bookMeeting exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Network error while booking meeting' };
  }
}

/**
 * Upload a document to the client's secure vault via the documents API.
 *
 * Uses the user's real session access token for consistency, though the
 * upload route does not currently enforce requireAuth.
 */
export async function uploadDocument(
  input: UploadDocumentInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getAccessToken();

    const formData = new FormData();
    formData.append('file', input.file);
    formData.append('title', input.title);
    formData.append('productCategory', input.category);
    formData.append('uploadedBy', input.userId);
    formData.append('policyNumber', '');

    const response = await fetch(`${DOCUMENTS_API}/${input.userId}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('uploadDocument API error:', response.status, errText);
      return { success: false, error: `Failed to upload document (${response.status})` };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('uploadDocument exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Network error while uploading document' };
  }
}