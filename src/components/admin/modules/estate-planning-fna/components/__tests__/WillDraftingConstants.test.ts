import { describe, expect, it } from 'vitest';
import {
  MARITAL_STATUS_LABELS,
  TREATMENT_LABELS,
  TREATMENT_OPTION_LABELS,
} from '../WillDraftingConstants';

describe('WillDraftingConstants', () => {
  it('MARITAL_STATUS_LABELS has entries for common marital statuses', () => {
    expect(MARITAL_STATUS_LABELS.single).toBe('Single');
    expect(MARITAL_STATUS_LABELS.married_cop).toBeTruthy();
    expect(MARITAL_STATUS_LABELS.divorced).toBe('Divorced');
  });

  it('TREATMENT_LABELS maps treatment codes to descriptions', () => {
    expect(TREATMENT_LABELS.ventilator).toBeTruthy();
    expect(TREATMENT_LABELS.cpr).toBeTruthy();
    expect(TREATMENT_LABELS.dialysis).toBeTruthy();
  });

  it('TREATMENT_OPTION_LABELS has accept, refuse, and limited', () => {
    expect(TREATMENT_OPTION_LABELS.accept).toBe('Accept');
    expect(TREATMENT_OPTION_LABELS.refuse).toBe('Refuse');
    expect(TREATMENT_OPTION_LABELS.limited).toBeTruthy();
  });
});
