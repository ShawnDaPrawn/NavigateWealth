import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const step1Source = readFileSync(join(dir, '..', 'Step1InformationGathering.tsx'), 'utf8');

function extractFunctionBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start);
}

describe('Step1InformationGathering prefill guard', () => {
  it('uses review flow for profile prefill and avoids clientKeys effects', () => {
    expect(step1Source).toContain('useFormPrefill');
    expect(step1Source).not.toMatch(/useEffect\s*\([\s\S]*?\[[^\]]*clientKeys[^\]]*\]/);
  });

  it('does not map hook clientKeys into cover fields outside recalculate handler', () => {
    const populateBlock = extractFunctionBody(step1Source, 'const populateFromInitialData');
    const recalculateBlock = extractFunctionBody(step1Source, 'const handleRecalculateTotals');

    expect(populateBlock.split('const handleRecalculateTotals')[0]).not.toContain('clientKeys');
    expect(recalculateBlock).toContain('getClientKeys');
    expect(recalculateBlock).toMatch(/keyToFieldMap[\s\S]*existingCoverLifePersonal/);
    expect(step1Source).toMatch(/hasClientKeys=\{!!clientKeys\?\.keys\?\.length\}/);
  });
});
