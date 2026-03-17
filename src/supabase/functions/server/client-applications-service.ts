/**
 * Client Application Lifecycle Service
 * Navigate Wealth Admin Server
 *
 * Business logic for the client-facing application flow and the admin
 * "complete on behalf of client" flow. Both paths write to the same
 * KV structure so resume and dual-path completion work identically.
 *
 * KV Key Convention (SS5.4):
 *   application:{applicationId}             -> Application metadata (status, timestamps, audit)
 *   application:{applicationId}:step_{n}    -> Per-step form data (1-5)
 *
 * Application State Machine:
 *   draft -> in_progress -> submitted -> under_review -> approved | declined
 *
 * The `completedBy` field on each step records who saved the data:
 *   - { type: 'client', userId }   for self-service
 *   - { type: 'admin', userId }    for admin on-behalf-of
 *
 * Last-write-wins concurrency: no optimistic locking. The most recent
 * save overwrites previous data for a given step.
 *
 * SS4.2: Services own business logic, KV access patterns, and cross-entity consistency.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendAdminApplicationNotification,
  sendClientApplicationReceivedEmail,
} from './email-service.ts';

const log = createModuleLogger('client-applications-service');

// ── Types ──────────────────────────────────────────────────────────────────────

export type ApplicationLifecycleStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'declined'
  | 'invited';

export interface CompletedBy {
  type: 'client' | 'admin';
  userId: string;
  timestamp: string;
}

export interface StepData {
  stepNumber: number;
  data: Record<string, unknown>;
  completedBy: CompletedBy;
  savedAt: string;
}

export interface ApplicationMetadata {
  id: string;
  userId: string;
  status: ApplicationLifecycleStatus;
  applicationNumber: string;
  currentStep: number;
  stepsCompleted: number[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  submittedBy: CompletedBy | null;
  origin: 'self_service' | 'admin_invite' | 'admin_import';
}

// ── Valid state transitions ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ApplicationLifecycleStatus, ApplicationLifecycleStatus[]> = {
  draft: ['in_progress'],
  in_progress: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'declined'],
  approved: [],
  declined: [],
  invited: ['in_progress', 'submitted'],
};

// ── Key helpers ────────────────────────────────────────────────────────────────

function metadataKey(applicationId: string): string {
  return `application:${applicationId}`;
}

function stepKey(applicationId: string, step: number): string {
  return `application:${applicationId}:step_${step}`;
}

// ── Service ────────────────────────────────────────────────────────────────────

export const clientApplicationsService = {

  /**
   * Create a new application for a user (self-service).
   * Idempotent: if the user already has a non-deprecated application, returns it.
   */
  async create(
    userId: string,
    origin: 'self_service' | 'admin_invite' | 'admin_import' = 'self_service',
  ): Promise<Record<string, unknown>> {
    // Idempotent: check if an application already exists
    const existing = await this.getByUserId(userId);
    if (existing) {
      log.info('Application already exists for user, returning existing', { userId, id: existing.id });
      return existing;
    }

    const now = new Date().toISOString();
    const applicationId = crypto.randomUUID();
    const applicationNumber = `NW-${Date.now().toString(36).toUpperCase()}`;

    const application: Record<string, unknown> = {
      id: applicationId,
      user_id: userId,
      status: 'draft',
      applicationNumber,
      currentStep: 1,
      stepsCompleted: [],
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
      submittedAt: null,
      submitted_at: null,
      submittedBy: null,
      origin,
      application_data: {},
    };

    await kv.set(metadataKey(applicationId), application);
    log.info('Application created', { applicationId, userId, origin });

    return application;
  },

  /**
   * Get or create an application for a user (upsert pattern).
   * Used by save-progress to ensure the application exists before saving.
   */
  async getOrCreate(userId: string): Promise<Record<string, unknown>> {
    const existing = await this.getByUserId(userId);
    if (existing) return existing;
    return this.create(userId, 'self_service');
  },

  /**
   * Get application metadata by userId.
   * Scans all application:* entries to find the one belonging to this user.
   * Returns the most recent non-deprecated application.
   */
  async getByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const entries = await kv.getByPrefix('application:');
    // Filter to entries that are top-level application records (not step data)
    // and belong to this user
    const userApps = (entries as Record<string, unknown>[])
      .filter(e =>
        e &&
        e.user_id === userId &&
        e.deprecated !== true &&
        // Exclude step data entries (they have stepNumber)
        !('stepNumber' in e)
      )
      .sort((a, b) => {
        const aTime = new Date(String(a.created_at || 0)).getTime();
        const bTime = new Date(String(b.created_at || 0)).getTime();
        return bTime - aTime; // Most recent first
      });

    return userApps[0] || null;
  },

  /**
   * Get application metadata by application ID.
   */
  async getById(applicationId: string): Promise<Record<string, unknown> | null> {
    return (await kv.get(metadataKey(applicationId))) as Record<string, unknown> | null;
  },

  /**
   * Save a single step's form data.
   * Also updates the application metadata (currentStep, stepsCompleted, status).
   *
   * Pre-population: if step 1 and no data exists, the caller should
   * pass user_metadata fields in the data payload.
   */
  async saveStep(
    applicationId: string,
    step: number,
    data: Record<string, unknown>,
    completedBy: CompletedBy,
  ): Promise<{ success: boolean; application: Record<string, unknown> }> {
    // Validate step range
    if (step < 1 || step > 5) {
      throw new Error(`Invalid step number: ${step}. Must be 1-5.`);
    }

    const application = await kv.get(metadataKey(applicationId)) as Record<string, unknown> | null;
    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    // Build step entry
    const stepData: StepData = {
      stepNumber: step,
      data,
      completedBy,
      savedAt: new Date().toISOString(),
    };

    // Update stepsCompleted array
    const stepsCompleted = (application.stepsCompleted as number[]) || [];
    if (!stepsCompleted.includes(step)) {
      stepsCompleted.push(step);
      stepsCompleted.sort();
    }

    // Auto-transition: draft -> in_progress on first step save
    let status = application.status as string;
    if (status === 'draft' || status === 'invited') {
      status = 'in_progress';
    }

    // Also merge step data into application_data for backward compatibility
    // with the existing admin Applications module that reads application_data
    const existingAppData = (application.application_data || {}) as Record<string, unknown>;
    const mergedAppData = { ...existingAppData, ...data, currentStep: step };

    const now = new Date().toISOString();

    // Multi-entry consistency: update both step entry and metadata together
    await Promise.all([
      kv.set(stepKey(applicationId, step), stepData),
      kv.set(metadataKey(applicationId), {
        ...application,
        status,
        currentStep: step,
        stepsCompleted,
        updatedAt: now,
        application_data: mergedAppData,
        updated_at: now,
      }),
    ]);

    log.info('Step saved', { applicationId, step, completedByType: completedBy.type });

    return {
      success: true,
      application: {
        ...application,
        status,
        currentStep: step,
        stepsCompleted,
        updatedAt: now,
      },
    };
  },

  /**
   * Load a single step's form data.
   */
  async getStep(applicationId: string, step: number): Promise<StepData | null> {
    return (await kv.get(stepKey(applicationId, step))) as StepData | null;
  },

  /**
   * Load all steps for an application (for resume or admin review).
   */
  async getAllSteps(applicationId: string): Promise<Record<number, StepData>> {
    const keys = [1, 2, 3, 4, 5].map(s => stepKey(applicationId, s));
    const values = await kv.mget(keys);

    const result: Record<number, StepData> = {};
    values.forEach((val, idx) => {
      if (val) {
        result[idx + 1] = val as StepData;
      }
    });

    return result;
  },

  /**
   * Submit a completed application for review.
   * Supports two save paths:
   *   1. Per-step entries (admin flow via saveStep) — checks step KV entries
   *   2. Bulk save (client flow via saveProgress) — checks application_data blob
   * If per-step entries don't exist, falls back to validating application_data.
   */
  async submit(
    applicationId: string,
    submittedBy: CompletedBy,
  ): Promise<{ success: boolean; application: Record<string, unknown> }> {
    const application = await kv.get(metadataKey(applicationId)) as Record<string, unknown> | null;
    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    const status = application.status as string;
    if (status !== 'in_progress' && status !== 'draft' && status !== 'invited') {
      throw new Error(`Cannot submit application in '${status}' status. Must be in_progress.`);
    }

    // Try per-step entries first (admin per-step flow)
    const steps = await this.getAllSteps(applicationId);
    const completedSteps = Object.keys(steps).map(Number);
    const hasPerStepData = completedSteps.length > 0;

    // Fall back to application_data blob (client bulk-save flow)
    const appData = (application.application_data || {}) as Record<string, unknown>;
    const hasBulkData = !!(
      appData.firstName &&
      appData.lastName &&
      appData.emailAddress &&
      appData.cellphoneNumber &&
      appData.termsAccepted &&
      appData.signatureFullName
    );

    if (!hasPerStepData && !hasBulkData) {
      // Neither path has sufficient data — report what's missing
      const missingSteps = [1, 2, 3, 4, 5].filter(s => !completedSteps.includes(s));
      throw new Error(`Cannot submit: steps ${missingSteps.join(', ')} are not completed.`);
    }

    const now = new Date().toISOString();

    // Build complete application_data from whichever path has data
    let finalAppData: Record<string, unknown> = { ...appData };
    if (hasPerStepData) {
      for (const [, stepData] of Object.entries(steps)) {
        Object.assign(finalAppData, stepData.data);
      }
    }

    const updatedApplication = {
      ...application,
      status: 'submitted',
      submittedAt: now,
      submitted_at: now,
      updatedAt: now,
      updated_at: now,
      submittedBy,
      application_data: {
        ...(application.application_data as Record<string, unknown> || {}),
        ...finalAppData,
        currentStep: 5,
      },
    };

    await kv.set(metadataKey(applicationId), updatedApplication);

    // Also update the user profile's applicationStatus
    const userId = application.user_id as string;
    if (userId) {
      try {
        const profileKey = `user_profile:${userId}:personal_info`;
        const profile = await kv.get(profileKey) as Record<string, unknown> | null;
        if (profile) {
          await kv.set(profileKey, {
            ...profile,
            accountStatus: 'submitted_for_review',
            applicationStatus: 'submitted',
            metadata: {
              ...(profile.metadata as Record<string, unknown> || {}),
              updatedAt: now,
            },
          });
        }
      } catch (profileErr) {
        log.error('Failed to update profile status on submit (non-blocking)', profileErr);
      }
    }

    // Send email notifications (non-blocking — submission should not fail if emails fail)
    const applicationNumber = (application.applicationNumber || updatedApplication.applicationNumber || '') as string;
    const clientName = [finalAppData.firstName, finalAppData.lastName].filter(Boolean).join(' ') || 'Client';
    const clientEmail = (finalAppData.emailAddress || '') as string;

    try {
      await Promise.all([
        sendAdminApplicationNotification({
          applicationNumber,
          clientName,
          clientEmail,
          applicationType: 'Personal Client',
        }),
        clientEmail
          ? sendClientApplicationReceivedEmail({
              to: clientEmail,
              clientName,
              applicationNumber,
            })
          : Promise.resolve(),
      ]);
      log.info('Submission notification emails sent', { applicationId, applicationNumber });
    } catch (emailErr) {
      log.error('Failed to send submission notification emails (non-blocking)', emailErr);
    }

    log.info('Application submitted', { applicationId, submittedByType: submittedBy.type });

    return { success: true, application: updatedApplication };
  },

  /**
   * Save all form data at once (backward-compatible with existing save-progress).
   * This wraps the per-step logic for compatibility with the current
   * useOnboarding hook which saves all data as one blob.
   */
  async saveProgress(
    applicationId: string,
    applicationData: Record<string, unknown>,
    userId: string,
  ): Promise<{ success: boolean }> {
    const now = new Date().toISOString();
    const application = await kv.get(metadataKey(applicationId)) as Record<string, unknown> | null;

    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    // Auto-transition: draft -> in_progress
    let status = application.status as string;
    if (status === 'draft' || status === 'invited') {
      status = 'in_progress';
    }

    const existingAppData = (application.application_data || {}) as Record<string, unknown>;

    // Multi-entry consistency (SS5.4, SS12.3):
    // Update both the application record AND the user profile's accountStatus
    // to ensure route guards on the frontend work after page refresh.
    const profileKey = `user_profile:${userId}:personal_info`;
    const profileUpdate = (async () => {
      try {
        const profile = await kv.get(profileKey) as Record<string, unknown> | null;
        if (profile) {
          const currentProfileStatus = profile.accountStatus as string;
          // Only update if status is still in a pre-application state
          if (currentProfileStatus === 'no_application' || currentProfileStatus === 'draft' || !currentProfileStatus) {
            await kv.set(profileKey, {
              ...profile,
              accountStatus: 'application_in_progress',
              metadata: {
                ...(profile.metadata as Record<string, unknown> || {}),
                updatedAt: now,
              },
            });
          }
        }
      } catch (profileErr) {
        log.error('Failed to sync profile accountStatus during save-progress (non-blocking)', profileErr);
      }
    })();

    await Promise.all([
      kv.set(metadataKey(applicationId), {
        ...application,
        status,
        application_data: { ...existingAppData, ...applicationData },
        updated_at: now,
        updatedAt: now,
      }),
      profileUpdate,
    ]);

    return { success: true };
  },
};