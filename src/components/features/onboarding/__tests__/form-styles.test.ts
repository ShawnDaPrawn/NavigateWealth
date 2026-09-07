import { describe, expect, it } from 'vitest';
import {
  INPUT_CLASS,
  SELECT_TRIGGER_CLASS,
  TEXTAREA_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_CLASS,
  SECTION_CONTAINER_SPACED_CLASS,
  REQUIRED,
} from '../form-styles';

describe('onboarding/form-styles', () => {
  it('INPUT_CLASS is a non-empty string', () => {
    expect(typeof INPUT_CLASS).toBe('string');
    expect(INPUT_CLASS.length).toBeGreaterThan(0);
  });

  it('SELECT_TRIGGER_CLASS matches input height class', () => {
    expect(SELECT_TRIGGER_CLASS).toContain('h-11');
  });

  it('TEXTAREA_CLASS includes border and background styling', () => {
    expect(typeof TEXTAREA_CLASS).toBe('string');
    expect(TEXTAREA_CLASS).toContain('border');
  });

  it('LABEL_CLASS has text sizing', () => {
    expect(LABEL_CLASS).toContain('text-sm');
  });

  it('SECTION_CONTAINER_CLASS has bg-white and rounded', () => {
    expect(SECTION_CONTAINER_CLASS).toContain('bg-white');
    expect(SECTION_CONTAINER_CLASS).toContain('rounded');
  });

  it('SECTION_CONTAINER_SPACED_CLASS extends SECTION_CONTAINER_CLASS', () => {
    expect(SECTION_CONTAINER_SPACED_CLASS).toContain('bg-white');
    expect(SECTION_CONTAINER_SPACED_CLASS).toContain('space-y');
  });

  it('REQUIRED is a non-empty string', () => {
    expect(typeof REQUIRED).toBe('string');
    expect(REQUIRED.trim().length).toBeGreaterThan(0);
  });
});
