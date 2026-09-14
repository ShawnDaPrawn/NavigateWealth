/**
 * What leaving the send-for-signature wizard would cost.
 *
 * Until the user reaches the field studio, nothing in the wizard exists on the
 * server: the documents are `File` objects in memory and the recipients are a
 * local array. Closing the flow therefore used to throw all of it away without
 * a word — the exact thing that makes someone redo ten minutes of work.
 *
 * Pure, so the rule can be unit-tested and both entry points share one answer.
 */

export interface WizardExitState {
  files: unknown[];
  title: string;
  message: string;
  signers: unknown[];
  /** True once an envelope exists on the server for this wizard session. */
  hasDraftEnvelope: boolean;
}

/**
 * True when leaving now would lose something the user typed, picked or
 * changed. A draft envelope that already exists still counts: the recipients
 * edited since it was created have not been written back yet.
 */
export function hasUnsavedWizardWork(state: WizardExitState): boolean {
  return (
    state.files.length > 0 ||
    state.title.trim().length > 0 ||
    state.message.trim().length > 0 ||
    state.signers.length > 0 ||
    state.hasDraftEnvelope
  );
}

/**
 * Whether "Save as draft" can actually produce something resumable. An
 * envelope needs at least one document — either files staged in the wizard or
 * a draft already created (including the template path, which materialises its
 * own documents server-side).
 */
export function canSaveWizardDraft(
  state: WizardExitState,
  options?: { templateHasDocuments?: boolean },
): boolean {
  return state.files.length > 0 || state.hasDraftEnvelope || !!options?.templateHasDocuments;
}
