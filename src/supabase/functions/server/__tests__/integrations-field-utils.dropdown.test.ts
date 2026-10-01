import { describe, expect, it } from 'vitest';
import { coerceFieldValue } from '../integrations-field-utils.ts';
import type { SchemaField } from '../integrations-types.ts';

const parties: SchemaField = {
  id: 'ret_post_fixed_parties',
  name: 'Parties',
  type: 'dropdown',
  options: ['Single Life', 'Joint Life'],
};

const benefit: SchemaField = {
  id: 'eb_3',
  name: 'Benefit Type',
  type: 'dropdown',
  options: ['Group Life', 'Group Disability', 'Group Income Protection', 'Funeral Cover'],
};

describe('coerceFieldValue — dropdown options', () => {
  it('resolves a case-insensitive exact option', () => {
    expect(coerceFieldValue(benefit, 'group life')).toEqual({ value: 'Group Life' });
    expect(coerceFieldValue(parties, 'joint life')).toEqual({ value: 'Joint Life' });
  });

  it('resolves a longer label that contains exactly one option', () => {
    expect(coerceFieldValue(benefit, 'Group Life Cover')).toEqual({ value: 'Group Life' });
  });

  it('does not rewrite a joint-life annuity when the value is only "Life"', () => {
    const result = coerceFieldValue(parties, 'Life');
    expect(result.value).toBe('Life');
    expect(result.error).toMatch(/Parties must be one of/);
  });

  it('does not treat a dash or the word Fund as the first option', () => {
    for (const raw of ['-', '—', 'Fund', '***']) {
      const result = coerceFieldValue(benefit, raw);
      expect(result.value).toBe(raw);
      expect(result.error).toMatch(/Benefit Type must be one of/);
    }
  });
});
