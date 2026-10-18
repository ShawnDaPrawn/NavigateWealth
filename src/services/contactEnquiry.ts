/**
 * Public enquiry submission — the one client for POST /contact-form/submit.
 *
 * The Contact page and the "Let us call you back" form on every service page
 * both send leads here. The service-page form used to only clear itself and
 * show a success message, so every call-back request was silently lost; it now
 * goes through the same endpoint, which stores the submission and emails both
 * the firm and the person who enquired.
 */
import { projectId, publicAnonKey } from '../utils/supabase/info';

export interface ContactEnquiry {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  service?: string;
  message?: string;
  clientType?: string;
  /** Honeypot — real visitors leave it empty. */
  website?: string;
}

export type ContactEnquiryResult = { ok: true } | { ok: false; error: string };

export async function submitContactEnquiry(enquiry: ContactEnquiry): Promise<ContactEnquiryResult> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(enquiry),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Contact form submission error:', result);
      return { ok: false, error: result.error || 'Something went wrong. Please try again.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('Contact form network error:', error);
    return {
      ok: false,
      error: 'Unable to submit your enquiry. Please check your connection and try again.',
    };
  }
}

/**
 * Splits a single "Full name" field into the first and last names the
 * endpoint requires. A one-word name keeps a placeholder surname, since the
 * endpoint rejects an empty one.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
