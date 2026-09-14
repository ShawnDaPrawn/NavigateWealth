/**
 * Leaving the wizard used to bin everything staged in it without a word. This
 * rule decides whether the exit gate appears at all, so a false negative here
 * is the silent data loss coming straight back.
 */
import { describe, expect, it } from 'vitest';

import { canSaveWizardDraft, hasUnsavedWizardWork } from '../wizardExitState';

const empty = {
  files: [] as unknown[],
  title: '',
  message: '',
  signers: [] as unknown[],
  hasDraftEnvelope: false,
};

describe('hasUnsavedWizardWork', () => {
  it('is false for a wizard nobody has touched', () => {
    expect(hasUnsavedWizardWork(empty)).toBe(false);
  });

  it('is false when the title is only whitespace', () => {
    expect(hasUnsavedWizardWork({ ...empty, title: '   ' })).toBe(false);
  });

  it.each([
    ['a staged document', { files: [{}] }],
    ['a typed title', { title: 'Mandate' }],
    ['a typed message', { message: 'Please sign' }],
    ['an added recipient', { signers: [{}] }],
    ['an envelope already created', { hasDraftEnvelope: true }],
  ])('is true with %s', (_label, patch) => {
    expect(hasUnsavedWizardWork({ ...empty, ...patch })).toBe(true);
  });
});

describe('canSaveWizardDraft', () => {
  it('needs a document: a title and recipients alone cannot make a resumable draft', () => {
    expect(canSaveWizardDraft({ ...empty, title: 'Mandate', signers: [{}] })).toBe(false);
  });

  it('is true once a file is staged, or an envelope already exists', () => {
    expect(canSaveWizardDraft({ ...empty, files: [{}] })).toBe(true);
    expect(canSaveWizardDraft({ ...empty, hasDraftEnvelope: true })).toBe(true);
  });

  it('is true for a template whose documents live server-side', () => {
    expect(canSaveWizardDraft(empty, { templateHasDocuments: true })).toBe(true);
  });
});
