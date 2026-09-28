import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Client keys reach an FNA's Step 1 only through the shared review prefill.
 *
 * Risk and Medical each used to read the client keys themselves for their
 * "sync existing cover" buttons, with their own key-to-field maps (Medical
 * even read the policies directly). Those maps drifted from the registry and
 * applied values without review. Both buttons now go through
 * useFormPrefill().refreshFromPolicies like every other FNA.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const modulesDir = join(dir, '..', '..', '..');
const step1Sources = {
  risk: readFileSync(join(dir, '..', 'Step1InformationGathering.tsx'), 'utf8'),
  medical: readFileSync(
    join(modulesDir, 'medical-fna', 'components', 'Step1InputForm.tsx'),
    'utf8',
  ),
};

describe.each(Object.entries(step1Sources))('%s Step 1 client keys', (_name, source) => {
  it('takes client keys through the shared review prefill', () => {
    expect(source).toContain('useFormPrefill');
    expect(source).toContain('refreshFromPolicies');
  });

  it('does not read client keys or policies itself', () => {
    expect(source).not.toMatch(/useClientKeys|useClientProductKeys|getClientKeys|clientKeysApi/);
    expect(source).not.toMatch(/\/integrations\/policies/);
    expect(source).not.toMatch(/keyToFieldMap/);
  });
});
