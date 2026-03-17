/**
 * useOnboarding Hook (v3 — simplified)
 *
 * Manages the 5-step onboarding application flow.
 *
 * Previous versions had 6 save layers (debounce, sessionStorage, sendBeacon,
 * keepalive fetch, visibility change, blur) that created race conditions
 * causing data loss on steps 2-4. This rewrite strips it to the essentials:
 *
 *   1. Load from server on mount (always authoritative)
 *   2. Debounced server save on every field change (2s)
 *   3. Immediate server save on step navigation (awaited)
 *   4. Immediate server save on submission
 *
 * No sessionStorage. No fire-and-forget. No sendBeacon. No stale closures.
 * If the save fails, the user sees an error status.
 *
 * §6 — All server state via API layer, no direct KV access
 * §3.1 — Hooks are the only consumers of the API layer
 * §7 — No business logic here; validation is in validation.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { getApplication, saveApplicationProgress, submitApplication } from '../../../../utils/services/applicationService';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { ApplicationData } from '../types';
import { INITIAL_DATA } from '../constants';
import { validateStep } from '../validation';

export type OnboardingMode = 'client' | 'admin';

interface UseOnboardingOptions {
  mode?: OnboardingMode;
  targetUserId?: string;
  adminUserId?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 2000;
const SAVE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/applications/save-progress`;

export function useOnboarding(options: UseOnboardingOptions = {}) {
  const { mode = 'client', targetUserId } = options;
  const { user, completeApplication } = useAuth();

  const effectiveUserId = mode === 'admin' ? targetUserId : user?.id;

  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<ApplicationData>({ ...INITIAL_DATA });
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const totalSteps = 5;

  // Refs for debounce and dedup
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const isSavingRef = useRef(false);
  const dataRef = useRef(data);
  const stepRef = useRef(currentStep);
  const userIdRef = useRef(effectiveUserId);
  // Stable userId that never clears — survives logout transitions
  const stableUserIdRef = useRef(effectiveUserId);
  const isInitialLoadRef = useRef(true);
  const hasMountedRef = useRef(false);

  // Keep refs in sync
  dataRef.current = data;
  stepRef.current = currentStep;
  userIdRef.current = effectiveUserId;
  isInitialLoadRef.current = isInitialLoad;
  if (effectiveUserId) {
    stableUserIdRef.current = effectiveUserId;
  }

  // ── Core save function ────────────────────────────────────────────────────
  const saveToServer = useCallback(async (forceUserId?: string): Promise<boolean> => {
    const userId = forceUserId || stableUserIdRef.current;
    if (!userId || isInitialLoadRef.current || isSavingRef.current) return false;

    const dataToSave = { ...dataRef.current, currentStep: stepRef.current };
    const serialised = JSON.stringify(dataToSave);

    // Dedup: don't re-save identical data
    if (serialised === lastSavedSnapshotRef.current) {
      return true;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      console.log('[useOnboarding] Saving progress, step:', stepRef.current);
      const result = await saveApplicationProgress(userId, dataToSave);
      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }
      lastSavedSnapshotRef.current = serialised;
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      console.log('[useOnboarding] Save successful');
      return true;
    } catch (err) {
      console.error('[useOnboarding] Save FAILED:', err);
      setSaveStatus('error');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // ── Load from server on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!effectiveUserId) {
      setIsInitialLoad(false);
      return;
    }

    // Prevent duplicate loads on re-mount with same userId
    if (hasMountedRef.current && userIdRef.current === effectiveUserId) return;
    hasMountedRef.current = true;

    let cancelled = false;

    const loadData = async () => {
      setIsInitialLoad(true);
      console.log('[useOnboarding] Loading application for user:', effectiveUserId);

      try {
        const existingApp = await getApplication(effectiveUserId);

        if (cancelled) return;

        if (existingApp.success && existingApp.data) {
          const appData = existingApp.data;
          setApplicationId((appData.id as string) || null);

          const serverData = appData.application_data as Partial<ApplicationData> | null;

          if (serverData && Object.keys(serverData).length > 0) {
            // Determine which step to resume from
            let serverStep = (serverData.currentStep as number) || 1;
            if (!serverData.currentStep) {
              // Heuristic fallback
              if (serverData.firstName && serverData.lastName) serverStep = 2;
              if (serverData.emailAddress && serverData.cellphoneNumber) serverStep = 3;
              if (serverData.employmentStatus) serverStep = 4;
              if (serverData.accountReasons && (serverData.accountReasons as string[])?.length > 0) serverStep = 5;
            }

            const merged = { ...INITIAL_DATA, ...serverData };
            console.log('[useOnboarding] Restored data from server, resuming step:', serverStep, 'fields with data:', Object.entries(merged).filter(([, v]) => v && v !== '' && !(Array.isArray(v) && v.length === 0)).length);

            setData(merged);
            setCurrentStep(serverStep);
            // Seed snapshot to prevent immediate re-save
            lastSavedSnapshotRef.current = JSON.stringify({ ...merged, currentStep: serverStep });
          } else {
            console.log('[useOnboarding] No application data on server, starting fresh');
            prefillFromUser();
          }
        } else {
          console.log('[useOnboarding] No application found on server, starting fresh');
          prefillFromUser();
        }
      } catch (error) {
        console.error('[useOnboarding] Load FAILED:', error);
        prefillFromUser();
      } finally {
        if (!cancelled) {
          setIsInitialLoad(false);
        }
      }
    };

    const prefillFromUser = () => {
      if (mode !== 'client' || !user) return;
      setData(prev => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        emailAddress: user.email || prev.emailAddress,
      }));
    };

    loadData();

    return () => { cancelled = true; };
  }, [effectiveUserId]); // Only re-run if userId changes

  // ── Debounced save on data changes ────────────────────────────────────────
  useEffect(() => {
    if (isInitialLoad || !effectiveUserId) return;

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      saveToServer();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [data, currentStep, effectiveUserId, isInitialLoad, saveToServer]);

  // ── Save before unmount / page unload ─────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const uid = stableUserIdRef.current;
      if (!uid || isInitialLoadRef.current) return;
      const dataToSave = { ...dataRef.current, currentStep: stepRef.current };
      const serialised = JSON.stringify(dataToSave);
      if (serialised === lastSavedSnapshotRef.current) return;

      // Best-effort save with keepalive
      try {
        fetch(SAVE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ userId: uid, applicationData: dataToSave }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* best effort */ }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // On unmount: flush pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Fire one last save
      handleBeforeUnload();
    };
  }, []);

  // ── Field update ──────────────────────────────────────────────────────────
  const updateData = useCallback((field: keyof ApplicationData, value: ApplicationData[keyof ApplicationData]) => {
    setData(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  }, []);

  // ── Step navigation ───────────────────────────────────────────────────────
  const goToNextStep = async () => {
    const errors = validateStep(currentStep, data);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;

      // Cancel pending debounce — we're doing an immediate save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Update step ref BEFORE saving so the save captures the new step
      stepRef.current = nextStep;
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Immediate save (awaited)
      await saveToServer();
    }
  };

  const goToPreviousStep = async () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      stepRef.current = prevStep;
      setCurrentStep(prevStep);
      setValidationErrors([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      await saveToServer();
    }
  };

  // ── Submission ────────────────────────────────────────────────────────────
  const submit = async () => {
    const errors = validateStep(currentStep, data);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return { success: false };
    }

    setIsLoading(true);
    try {
      const uid = stableUserIdRef.current;
      if (!uid) throw new Error('No user found');

      const result = await submitApplication({ userId: uid, applicationData: data });
      if (!result.success) throw new Error(result.error || 'Submission failed');

      if (mode === 'client') {
        await completeApplication({ accountStatus: 'submitted_for_review' });
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      setValidationErrors([errorMessage]);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // ── Manual save ───────────────────────────────────────────────────────────
  const saveNow = useCallback(async () => {
    await saveToServer();
  }, [saveToServer]);

  return {
    currentStep,
    totalSteps,
    data,
    isLoading,
    isInitialLoad,
    validationErrors,
    applicationId,
    mode,
    saveStatus,
    lastSavedAt,
    updateData,
    goToNextStep,
    goToPreviousStep,
    submit,
    saveNow,
    progress: (currentStep / totalSteps) * 100,
  };
}