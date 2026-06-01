/**
 * Pure helpers extracted from PrepareFormStudio.tsx (Phase 6 god-file split).
 *
 * Dependency-free logic — no React, no hooks, no component state — lifted out
 * verbatim so it can be unit-tested and the 2k-line studio component shrinks
 * toward its rendering/orchestration responsibility. Tested in
 * prepareFormStudioUtils.test.ts.
 */

import type { EsignEnvelope, EsignField } from '../types';

/**
 * Is the event target an editable element? Keyboard shortcuts must NOT fire
 * while the user is typing in a real input, so the global key handler bails
 * when the focused element is editable.
 */
export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Build EsignFields from autodetect candidates for a target signer, skipping
 * any candidate that near-duplicates an existing field (same page + type,
 * within 1.5px). Pure given its inputs (modulo the generated id/timestamp).
 */
export function createFieldsFromCandidates(
  candidateList: NonNullable<EsignEnvelope['field_candidates']>,
  targetSignerId: string,
  existingFields: EsignField[],
  envelopeId: string,
): EsignField[] {
  const now = new Date().toISOString();
  const newFields: EsignField[] = [];
  for (const cand of candidateList) {
    const dupe = existingFields.some(
      (f) =>
        f.page === cand.page &&
        f.type === cand.type &&
        Math.abs(f.x - cand.x) < 1.5 &&
        Math.abs(f.y - cand.y) < 1.5,
    );
    if (dupe) continue;
    newFields.push({
      id: `field-${Date.now()}-${newFields.length}-${Math.random().toString(36).slice(2, 6)}`,
      envelope_id: envelopeId,
      signer_id: targetSignerId,
      type: cand.type,
      page: cand.page,
      x: cand.x,
      y: cand.y,
      width: cand.width,
      height: cand.height,
      required: cand.required,
      metadata: { ...(cand.metadata ?? {}), source: cand.source, label: cand.label },
      created_at: now,
      updated_at: now,
    });
  }
  return newFields;
}

/**
 * Replicate seed fields onto every OTHER page (1..pageCount), preserving
 * geometry + metadata, skipping any near-duplicate already on the target page
 * (same signer + type within 0.5%) so repeated clicks don't carpet-bomb the
 * document. Pure given its inputs (modulo the generated id/timestamp).
 */
export function buildPageReplicas(
  seeds: EsignField[],
  existingFields: EsignField[],
  pageCount: number,
): EsignField[] {
  const now = new Date().toISOString();
  const replicas: EsignField[] = [];
  for (const seed of seeds) {
    for (let p = 1; p <= pageCount; p++) {
      if (p === seed.page) continue;
      const dupe = existingFields.some(
        (f) =>
          f.page === p &&
          f.signer_id === seed.signer_id &&
          f.type === seed.type &&
          Math.abs(f.x - seed.x) < 0.5 &&
          Math.abs(f.y - seed.y) < 0.5,
      );
      if (dupe) continue;
      replicas.push({
        ...seed,
        id: `field-${Date.now()}-${p}-${Math.random().toString(36).slice(2, 8)}`,
        page: p,
        created_at: now,
        updated_at: now,
      });
    }
  }
  return replicas;
}
