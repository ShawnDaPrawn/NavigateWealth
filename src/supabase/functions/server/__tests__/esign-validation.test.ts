/**
 * The studio places a field with `value: null` and the stored row round-trips
 * that null. UpdateFieldsSchema used to reject it, so Save fields answered
 * 400 "Validation failed".
 */
import { describe, expect, it } from 'vitest';
import { UpdateFieldsSchema } from '../esign-validation.ts';

describe('UpdateFieldsSchema', () => {
  const placed = {
    type: 'date' as const,
    page: 2,
    x: 10.282,
    y: 22.835,
    width: 90,
    height: 24,
    required: true,
  };

  it('accepts a placed field whose value is null', () => {
    const parsed = UpdateFieldsSchema.safeParse({ fields: [{ ...placed, value: null }] });
    expect(parsed.success).toBe(true);
  });

  it('accepts a field with no value and a field with a string value', () => {
    const parsed = UpdateFieldsSchema.safeParse({
      fields: [placed, { ...placed, type: 'text', value: 'signed' }],
    });
    expect(parsed.success).toBe(true);
  });
});
