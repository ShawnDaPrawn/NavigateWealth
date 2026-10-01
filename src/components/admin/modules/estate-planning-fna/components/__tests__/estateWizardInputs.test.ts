import { describe, expect, it } from 'vitest';
import {
  buildDefaultEstateInputs,
  findEstateStep1Problem,
  mergePrefillIntoEstateInputs,
} from '../estateWizardInputs';

describe('findEstateStep1Problem', () => {
  it('stops on the family tab until the client has a name and an age', () => {
    const blank = buildDefaultEstateInputs();
    expect(findEstateStep1Problem(blank)).toEqual({
      tab: 'family',
      message: 'Please provide the client’s full name',
    });

    const unnamed = buildDefaultEstateInputs();
    unnamed.familyInfo.fullName = '   ';
    unnamed.familyInfo.age = 58;
    expect(findEstateStep1Problem(unnamed)?.message).toBe('Please provide the client’s full name');

    const ageless = buildDefaultEstateInputs();
    ageless.familyInfo.fullName = 'Sam Client';
    expect(findEstateStep1Problem(ageless)).toEqual({
      tab: 'family',
      message: 'Please provide the client’s age',
    });
  });

  it('accepts a named client with a positive age', () => {
    const inputs = buildDefaultEstateInputs();
    inputs.familyInfo.fullName = 'Sam Client';
    inputs.familyInfo.age = 58;
    expect(findEstateStep1Problem(inputs)).toBeNull();
  });
});

describe('mergePrefillIntoEstateInputs', () => {
  it('applies a dotted family field without wiping the rest of the family record', () => {
    const base = buildDefaultEstateInputs();
    base.familyInfo.fullName = 'Sam Client';
    base.familyInfo.maritalStatus = 'married_cop';

    const merged = mergePrefillIntoEstateInputs(base, {
      'familyInfo.age': 58,
      'familyInfo.spouseName': null,
      unknownField: 'ignore me',
    });

    expect(merged.familyInfo).toMatchObject({
      fullName: 'Sam Client',
      age: 58,
      maritalStatus: 'married_cop',
    });
    expect(merged.familyInfo.spouseName).toBeUndefined();
    expect(merged).not.toHaveProperty('unknownField');
    expect(base.familyInfo.age).toBe(0);
  });

  it('writes a top-level field the estate record already has', () => {
    const merged = mergePrefillIntoEstateInputs(buildDefaultEstateInputs(), {
      planningNotes: 'Review the will before year end',
    });
    expect(merged.planningNotes).toBe('Review the will before year end');
    expect(merged.willInfo.executorNominated).toBe('unknown');
  });
});
