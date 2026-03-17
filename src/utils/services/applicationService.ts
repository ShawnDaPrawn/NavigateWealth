/**
 * Application Service
 * Handles Personal Client application submission and management
 */

import { projectId, publicAnonKey } from '../supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

export interface ApplicationSubmissionData {
  userId: string;
  applicationData: {
    // Personal Information
    title: string;
    firstName: string;
    middleName: string;
    preferredName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    idType: string;
    idNumber: string;
    taxNumber: string;
    isSATaxResident: boolean | null;
    maritalStatus: string;
    maritalRegime: string;
    numberOfDependants: string;
    
    // Spouse
    spouseFirstName: string;
    spouseLastName: string;
    spouseDateOfBirth: string;
    spouseEmployed: string;
    
    // Contact Details
    emailAddress: string;
    alternativeEmail: string;
    cellphoneNumber: string;
    alternativeCellphone: string;
    whatsappNumber: string;
    preferredContactMethod: string;
    bestTimeToContact: string;
    residentialAddressLine1: string;
    residentialAddressLine2: string;
    residentialSuburb: string;
    residentialCity: string;
    residentialProvince: string;
    residentialPostalCode: string;
    residentialCountry: string;
    
    // Employment Information
    employmentStatus: string;
    jobTitle: string;
    employerName: string;
    industry: string;
    selfEmployedCompanyName: string;
    selfEmployedIndustry: string;
    selfEmployedDescription: string;
    grossMonthlyIncome: string;
    monthlyExpensesEstimate: string;
    
    // Services & Interests
    accountReasons: string[];
    otherReason: string;
    financialGoals: string;
    urgency: string;
    existingProducts: string[];
    existingProductProviders: Record<string, string>;
    
    // Terms & Conditions
    termsAccepted: boolean;
    popiaConsent: boolean;
    disclosureAcknowledged: boolean;
    faisAcknowledged: boolean;
    electronicCommunicationConsent: boolean;
    communicationConsent: boolean;
    signatureFullName: string;
  };
}

export interface ApplicationResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Submit application for review
 */
export async function submitApplication(
  submissionData: ApplicationSubmissionData
): Promise<ApplicationResponse> {
  try {
    console.log('📤 Submitting application for user:', submissionData.userId);
    
    const response = await fetch(`${BASE_URL}/applications/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(submissionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Application submission failed:', errorData);
      throw new Error(errorData.error || 'Failed to submit application');
    }

    const result = await response.json();
    console.log('✅ Application submitted successfully:', result);
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('❌ Error submitting application:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get application for a specific user
 */
export async function getApplication(userId: string): Promise<ApplicationResponse> {
  try {
    console.log('📥 Fetching application for user:', userId);
    
    const response = await fetch(`${BASE_URL}/applications/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Failed to fetch application:', errorData);
      throw new Error(errorData.error || 'Failed to fetch application');
    }

    const result = await response.json();
    console.log('✅ Application fetched successfully:', result.data ? 'Found' : 'Not found');
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('❌ Error fetching application:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Save application progress (auto-save while filling out)
 */
export async function saveApplicationProgress(
  userId: string,
  applicationData: Partial<ApplicationSubmissionData['applicationData']>
): Promise<ApplicationResponse> {
  try {
    console.log('💾 Saving application progress for user:', userId);
    
    const response = await fetch(`${BASE_URL}/applications/save-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ userId, applicationData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Failed to save progress:', errorData);
      throw new Error(errorData.error || 'Failed to save progress');
    }

    const result = await response.json();
    console.log('✅ Progress saved successfully');
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('❌ Error saving progress:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}