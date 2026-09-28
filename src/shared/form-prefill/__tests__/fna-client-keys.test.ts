/**
 * The FNA wizards read the client through one set of client keys.
 *
 * These tests stop the registry drifting back into per-wizard vocabularies:
 * a client fact the analyses share has exactly one canonical key and one label,
 * and every analysis reads the core facts.
 */
import { describe, expect, it } from 'vitest';
import { FNA_CLIENT_KEYS, FORM_FIELD_REGISTRY } from '../form-field-registry';
import type { FormFieldMapping, FormPrefillId } from '../types';

const FNA_FORMS = Object.keys(FORM_FIELD_REGISTRY) as FormPrefillId[];
const allMappings: [FormPrefillId, FormFieldMapping][] = FNA_FORMS.flatMap((formId) =>
  FORM_FIELD_REGISTRY[formId].map((m): [FormPrefillId, FormFieldMapping] => [formId, m]),
);

describe('FNA client keys', () => {
  it('covers all six analyses', () => {
    expect(FNA_FORMS.sort()).toEqual(
      [
        'estate-fna-step1',
        'investment-ina-step1',
        'medical-fna-step1',
        'retirement-fna-step1',
        'risk-fna-step1',
        'tax-fna-step1',
      ].sort(),
    );
  });

  it('declares each shared client key once', () => {
    const keys = Object.values(FNA_CLIENT_KEYS).map((k) => k.canonicalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives a canonical key the same label and group wherever it is used', () => {
    const seen = new Map<string, { label: string; group?: string; formId: string }>();
    for (const [formId, mapping] of allMappings) {
      const first = seen.get(mapping.canonicalKey);
      if (!first) {
        seen.set(mapping.canonicalKey, { label: mapping.label, group: mapping.group, formId });
        continue;
      }
      expect(
        { label: mapping.label, group: mapping.group },
        `${mapping.canonicalKey} in ${formId} vs ${first.formId}`,
      ).toEqual({ label: first.label, group: first.group });
    }
  });

  it('routes every key used by more than one analysis through FNA_CLIENT_KEYS', () => {
    const shared = new Set<string>(Object.values(FNA_CLIENT_KEYS).map((k) => k.canonicalKey));
    const formsByKey = new Map<string, Set<string>>();
    for (const [formId, mapping] of allMappings) {
      const forms = formsByKey.get(mapping.canonicalKey) ?? new Set<string>();
      forms.add(formId);
      formsByKey.set(mapping.canonicalKey, forms);
    }
    const reusedButNotShared = [...formsByKey.entries()]
      .filter(([key, forms]) => forms.size > 1 && !shared.has(key))
      .map(([key]) => key);
    expect(reusedButNotShared).toEqual([]);
  });

  it('reads the client’s age in every analysis', () => {
    for (const formId of FNA_FORMS) {
      expect(
        FORM_FIELD_REGISTRY[formId].some(
          (m) => m.canonicalKey === FNA_CLIENT_KEYS.age.canonicalKey,
        ),
        formId,
      ).toBe(true);
    }
  });

  it('maps a form field at most once', () => {
    for (const formId of FNA_FORMS) {
      const fields = FORM_FIELD_REGISTRY[formId].map((m) => m.formField);
      expect(new Set(fields).size, formId).toBe(fields.length);
    }
  });
});
