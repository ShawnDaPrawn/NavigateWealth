import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS } from '../constants';

describe('retirement-fna/constants', () => {
  it('WIZARD_STEPS has 4 steps', () => {
    expect(WIZARD_STEPS.length).toBe(4);
  });

  it('WIZARD_STEPS steps are numbered 1–4', () => {
    WIZARD_STEPS.forEach((s, i) => {
      expect(s.step).toBe(i + 1);
    });
  });

  it('each wizard step has a title and description', () => {
    WIZARD_STEPS.forEach((s) => {
      expect(typeof s.title).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
    });
  });

  it('first step is information gathering', () => {
    expect(WIZARD_STEPS[0].title).toMatch(/information/i);
  });

  it('last step is finalise and publish', () => {
    expect(WIZARD_STEPS[3].title).toMatch(/finalise/i);
  });
});
