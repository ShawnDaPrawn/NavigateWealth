import { describe, expect, it } from 'vitest';
import { FnaIntakeSaveDraftSchema } from '@/shared/fna-intake/schemas/intake-payload';

describe('FnaIntakeSaveDraftSchema', () => {
  it('accepts reasonable intake payloads', () => {
    const parsed = FnaIntakeSaveDraftSchema.safeParse({
      inputs: { currentAge: 45, grossMonthlyIncome: 50000 },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects oversized payloads', () => {
    const huge: Record<string, number> = {};
    for (let i = 0; i < 201; i++) huge[`field${i}`] = i;
    const parsed = FnaIntakeSaveDraftSchema.safeParse({ inputs: huge });
    expect(parsed.success).toBe(false);
  });
});
