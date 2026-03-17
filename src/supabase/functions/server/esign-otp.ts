/**
 * E-Signature OTP Service (KV Store Version)
 * Handles OTP generation, storage, verification, and expiration
 */

import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";

const log = createModuleLogger('esign-otp');

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_CHARSET = '0123456789';

interface OTPData {
  otpHash: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * OTP_CHARSET.length);
    otp += OTP_CHARSET[randomIndex];
  }
  return otp;
}

/**
 * Hash OTP for secure storage (using SHA-256)
 */
export async function hashOTP(otp: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(otp);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    log.error('OTP hashing error:', error);
    throw new Error('Failed to hash OTP');
  }
}

/**
 * Store OTP for a signer
 */
export async function storeOTP(signerId: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const otpData: OTPData = {
      otpHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`esign:otp:${signerId}`, otpData);

    log.success(`OTP stored for signer ${signerId}, expires at ${expiresAt}`);
    return { success: true };
  } catch (error) {
    log.error('Store OTP exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Verify OTP for a signer
 */
export async function verifyOTP(
  signerId: string,
  otp: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Fetch OTP data
    const otpData: OTPData | null = await kv.get(`esign:otp:${signerId}`);

    if (!otpData) {
      return { valid: false, error: 'No OTP has been sent for this signer' };
    }

    // Check if OTP expired
    const now = new Date();
    const expiresAt = new Date(otpData.expiresAt);

    if (now > expiresAt) {
      log.warn(`OTP expired for signer ${signerId}`);
      await kv.del(`esign:otp:${signerId}`);
      return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }

    // Verify OTP hash
    const otpHash = await hashOTP(otp);

    if (otpHash !== otpData.otpHash) {
      log.warn(`Invalid OTP for signer ${signerId}`);
      return { valid: false, error: 'Invalid OTP code' };
    }

    log.success(`OTP verified for signer ${signerId}`);
    return { valid: true };
  } catch (error) {
    log.error('Verify OTP exception:', error);
    return { valid: false, error: 'Failed to verify OTP' };
  }
}

/**
 * Verify optional access code for a signer
 */
export async function verifyAccessCode(
  signerId: string,
  accessCode: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const signer = await kv.get(`esign:signer:${signerId}`);

    if (!signer) {
      return { valid: false, error: 'Signer not found' };
    }

    // If no access code is set, consider it valid
    if (!signer.access_code) {
      return { valid: true };
    }

    // Check if provided access code matches
    if (accessCode !== signer.access_code) {
      log.warn(`Invalid access code for signer ${signerId}`);
      return { valid: false, error: 'Invalid access code' };
    }

    log.success(`Access code verified for signer ${signerId}`);
    return { valid: true };
  } catch (error) {
    log.error('Verify access code exception:', error);
    return { valid: false, error: 'Failed to verify access code' };
  }
}

/**
 * Update signer status after successful OTP verification
 */
export async function markOTPVerified(signerId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const signer = await kv.get(`esign:signer:${signerId}`);
    
    if (!signer) {
      return { success: false, error: 'Signer not found' };
    }

    const updated = {
      ...signer,
      otp_verified: true,
      status: signer.status === 'pending' ? 'sent' : signer.status,
    };

    await kv.set(`esign:signer:${signerId}`, updated);

    log.success(`Signer ${signerId} marked as OTP verified`);
    return { success: true };
  } catch (error) {
    log.error('Mark OTP verified exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Clear OTP after successful verification (security best practice)
 */
export async function clearOTP(signerId: string): Promise<void> {
  try {
    await kv.del(`esign:otp:${signerId}`);
    log.success(`OTP cleared for signer ${signerId}`);
  } catch (error) {
    log.error('Clear OTP exception:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Check if signer requires OTP
 */
export async function isOTPRequired(signerId: string): Promise<boolean> {
  try {
    const signer = await kv.get(`esign:signer:${signerId}`);

    if (!signer) {
      log.error('Signer not found');
      return true; // Default to requiring OTP for security
    }

    return signer.requires_otp || false;
  } catch (error) {
    log.error('Check OTP required exception:', error);
    return true; // Default to requiring OTP for security
  }
}

/**
 * Generate and send OTP (returns the OTP for email sending)
 */
export async function generateAndStoreOTP(signerId: string): Promise<{ otp: string | null; error?: string }> {
  try {
    // Generate OTP
    const otp = generateOTP();

    // Store hashed OTP
    const { success, error } = await storeOTP(signerId, otp);

    if (!success) {
      return { otp: null, error };
    }

    return { otp, error: undefined };
  } catch (error) {
    log.error('Generate and store OTP exception:', error);
    return { otp: null, error: String(error) };
  }
}

/**
 * Clean up expired OTPs (run periodically)
 * This can be called by a cron job or periodically
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  try {
    // Get all OTP keys
    const otpKeys = await kv.getByPrefix('esign:otp:');
    const now = new Date();
    let cleanedCount = 0;

    for (const otpData of otpKeys) {
      if (otpData && otpData.expiresAt) {
        const expiresAt = new Date(otpData.expiresAt);
        if (now > expiresAt) {
          // Extract signerId from the key pattern
          const signerId = otpData.signerId || 'unknown';
          await kv.del(`esign:otp:${signerId}`);
          cleanedCount++;
        }
      }
    }

    log.success(`Cleaned up ${cleanedCount} expired OTPs`);
    return cleanedCount;
  } catch (error) {
    log.error('Cleanup expired OTPs exception:', error);
    return 0;
  }
}
