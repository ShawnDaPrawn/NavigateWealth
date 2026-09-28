/**
 * Integrity checks on the exported token CSS: every `var(--uui-*)` must point
 * at a token that is defined, every light-mode colour must have a dark-mode
 * value, and the counts must match what the Figma file holds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const files = {
  primitives: read('../tokens/primitives.css'),
  semantic: read('../tokens/semantic.css'),
  scales: read('../tokens/scales.css'),
  effects: read('../tokens/effects.css'),
  typography: read('../tokens/typography.css'),
  paletteV8: read('../tokens/palette-v8.css'),
  components: read('../components/components.css'),
  avatar: read('../components/avatar.css'),
  tooltip: read('../components/tooltip.css'),
  tag: read('../components/tag.css'),
  progress: read('../components/progress.css'),
  buttonGroup: read('../components/button-group.css'),
};

const defined = (css: string) =>
  new Set([...css.matchAll(/(--uui-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const referenced = (css: string) =>
  new Set([...css.matchAll(/var\((--uui-[a-z0-9-]+)\)/g)].map((m) => m[1]));

describe('Untitled UI tokens', () => {
  const all = new Set(Object.values(files).flatMap((css) => [...defined(css)]));

  it('defines every token it references', () => {
    const missing = Object.entries(files).flatMap(([name, css]) =>
      [...referenced(css)].filter((ref) => !all.has(ref)).map((ref) => `${name}: ${ref}`),
    );
    expect(missing).toEqual([]);
  });

  it('exports the 375 colour primitives from the Figma file', () => {
    expect([...defined(files.primitives)].filter((t) => t.startsWith('--uui-color-'))).toHaveLength(
      375,
    );
  });

  it('gives every semantic colour both a light and a dark value', () => {
    const [light, dark] = files.semantic.split(/\.uui-dark,/);
    const lightTokens = [...defined(light)].sort();
    const darkTokens = [...defined(dark)].sort();
    // 303 in the Figma collection plus the orphaned text-brand-secondary-hover.
    expect(lightTokens).toHaveLength(304);
    expect(darkTokens).toEqual(lightTokens);
  });

  it('exports the 300 colours of the v8.0 palette (28 families)', () => {
    expect(defined(files.paletteV8).size).toBe(300);
  });

  it('exports all 44 text styles', () => {
    expect(files.typography.match(/^\.uui-text-[a-z0-9-]+ \{/gm)).toHaveLength(44);
  });
});
