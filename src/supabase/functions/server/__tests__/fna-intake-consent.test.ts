import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FNA_INTAKE_CONSENT_TEXT as serverConsentText,
  FNA_INTAKE_CONSENT_VERSION,
} from '../fna-intake-types.ts';

describe('fna-intake consent compliance', () => {
  it('matches client-facing consent text in fna-intake-api.ts', () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), 'src/services/fna-intake-api.ts'),
      'utf8',
    );
    const match = clientSource.match(
      /export const FNA_INTAKE_CONSENT_TEXT =\s*\n?\s*'([^']+)'/,
    );
    expect(match?.[1]).toBe(serverConsentText);
  });

  it('is rendered in FNAIntakeConsentDialog', () => {
    const dialogSource = readFileSync(
      resolve(process.cwd(), 'src/components/client/fna-intake/FNAIntakeConsentDialog.tsx'),
      'utf8',
    );
    expect(dialogSource).toContain('FNA_INTAKE_CONSENT_TEXT');
  });

  it('has a stable consent version constant', () => {
    expect(FNA_INTAKE_CONSENT_VERSION).toMatch(/^2026-/);
  });
});
