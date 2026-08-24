/**
 * Keeps a signer's in-progress work in localStorage.
 *
 * Lets someone pause a signing session and come back without losing fields
 * they had already filled — on a legally binding document, silently losing
 * that work is the failure this guards against.
 *
 * Both effects moved verbatim out of SigningWorkflow.tsx, which was over the
 * 1,000-line budget. Every read and write is best-effort: quota limits,
 * private mode and corrupt JSON all degrade to "no saved progress" rather than
 * breaking the signing flow.
 */
import { useEffect } from 'react';
import type { SignatureData } from './types';
import { inProgressKey } from './signingIdentity';

type WorkflowPhase = 'reading' | 'signing';

export function useInProgressSignatures({
  token,
  signatures,
  phase,
  setSignatures,
  setPhase,
}: {
  token: string | undefined;
  signatures: SignatureData[];
  phase: WorkflowPhase;
  setSignatures: React.Dispatch<React.SetStateAction<SignatureData[]>>;
  setPhase: React.Dispatch<React.SetStateAction<WorkflowPhase>>;
}) {
  // ── Restore in-progress signatures from localStorage on mount ────────
  // Lets a signer pause then return without losing any field they filled.
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(inProgressKey(token));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { signatures?: SignatureData[]; phase?: WorkflowPhase };
      if (Array.isArray(parsed.signatures) && parsed.signatures.length > 0) {
        setSignatures((prev) => {
          // Merge — anything already auto-filled (auto_date) wins.
          const existingIds = new Set(prev.map((s) => s.field_id));
          const merged = [...prev];
          parsed.signatures!.forEach((s) => {
            if (!existingIds.has(s.field_id)) merged.push(s);
          });
          return merged;
        });
        // If we restored work, jump straight to signing.
        if (parsed.phase === 'signing' || parsed.signatures.length > 0) {
          setPhase('signing');
        }
      }
    } catch {
      // best-effort
    }
    // setSignatures/setPhase come from useState and are referentially stable,
    // so naming them here satisfies the deps rule without changing when this runs.
  }, [token, setSignatures, setPhase]);

  // ── Persist in-progress signatures to localStorage on every change ───
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(inProgressKey(token), JSON.stringify({ signatures, phase }));
    } catch {
      // quota / private mode — best-effort only
    }
  }, [token, signatures, phase]);
}
