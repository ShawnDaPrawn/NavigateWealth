import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../Sidebar', () => ({ Sidebar: () => null }));
vi.mock('../GlobalSearch', () => ({ GlobalSearch: () => <input aria-label="search" /> }));
vi.mock('../../hooks/usePendingCounts', () => ({ usePendingCounts: () => ({}) }));

import { ADMIN_THEME_CLASS, AdminLayout } from '../../AdminLayout';
import { Button } from '../../../ui/button';

const readRepoFile = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf8');

/**
 * The admin wears the website's Navigator design through one <html> class
 * (src/styles/admin-navigator.css). These pin the two things that keep it
 * contained: the class only exists while the admin is mounted, and every rule
 * in the sheet hangs off it, so the client portal and public site are never
 * restyled.
 */
describe('admin Navigator theme', () => {
  it('puts the theme class on <html> while the admin is mounted, and takes it off after', () => {
    const root = document.documentElement;
    expect(root.classList.contains(ADMIN_THEME_CLASS)).toBe(false);

    const { unmount } = render(
      <AdminLayout activeModule="notes" onModuleChange={vi.fn()}>
        <p>notes</p>
      </AdminLayout>,
    );
    expect(root.classList.contains(ADMIN_THEME_CLASS)).toBe(true);

    unmount();
    expect(root.classList.contains(ADMIN_THEME_CLASS)).toBe(false);
  });

  it('scopes every rule in the admin sheet to the theme class', () => {
    const css = readRepoFile('src/styles/admin-navigator.css')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@font-face\s*\{[^}]*\}/g, '');
    const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
    expect(selectors.length).toBeGreaterThan(20);
    for (const selector of selectors) {
      for (const part of selector.split(/,(?![^(]*\))/)) {
        expect(part.trim(), selector).toMatch(
          new RegExp(`^(:where\\()?html\\.${ADMIN_THEME_CLASS}\\b`),
        );
      }
    }
  });

  it('is loaded with the admin, not the public bundle', () => {
    expect(readRepoFile('src/styles/globals.css')).not.toMatch(/@import[^;]*admin-navigator/);
    expect(readRepoFile('src/index.css')).not.toMatch(/@import[^;]*admin-navigator/);
    expect(readRepoFile('src/components/admin/AdminLayout.tsx')).toContain(
      "import '../../styles/admin-navigator.css'",
    );
  });

  it('gives client documents previewed in the admin their own look back', () => {
    // Exported from the same DOM, so the admin palette and fonts must not reach them.
    const css = readRepoFile('src/styles/admin-navigator.css')
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')');
    for (const root of ['[data-pdf-export-root]', '.pdf-preview-container', '.pdf-page']) {
      expect(css).toContain(root);
    }
    expect(css).toMatch(
      /:where\(html\.nw-admin-theme\) :where\([^)]*\.letter-page\) \{[^}]*--color-gray-100: oklch/,
    );
    expect(css).toMatch(/html\.nw-admin-theme :is\(h1, h2\):not\(:is\([^)]*\.letter-page\) \*\)/);
  });

  it('lets a colour a screen sets on a table cell, heading or card title win', () => {
    // A red withdrawal or a green gain in a results table must stay red or green.
    const css = readRepoFile('src/styles/admin-navigator.css')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ');
    const cell = css.match(/\[data-slot='table-cell'\][^{]*\{([^}]*)\}/);
    expect(cell?.[1]).toBeDefined();
    expect(cell?.[1]).not.toMatch(/(^|;)\s*color:/);
    // The heading's colour only while its own default class is there; the
    // title's under the utilities layer.
    expect(css).toMatch(
      /\[data-slot='table-head'\]\.text-foreground[^{]*\{ color: var\(--nw-muted\)/,
    );
    expect(css).toMatch(/@layer components \{ html\.nw-admin-theme \[data-slot='card-title'\]/);
  });

  it('keeps the field focus rule as specific as the resting edge rule it must beat', () => {
    // The resting edge rule carries the client-document exclusion, which adds
    // specificity; the focus rule must carry it too, or a focused field keeps
    // its resting edge instead of turning violet (caught in a browser check).
    const css = readRepoFile('src/styles/admin-navigator.css')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')');
    const focus = css.match(
      /:focus-visible:not\(\[aria-invalid='true'\]\)([^{]*)\{ border-color: var\(--nw-violet\)/,
    );
    expect(focus?.[1]).toContain('.letter-page) *)');
  });

  it('remaps the colour scales the admin is built from', () => {
    const css = readRepoFile('src/styles/admin-navigator.css');
    // Warm neutrals and navy ink, one violet, the website's status colours.
    expect(css).toMatch(/--color-gray-100:\s*#f6f4ef/);
    expect(css).toMatch(/--color-gray-900:\s*#0d1626/);
    expect(css).toMatch(/--color-purple-600:\s*#6d28d9/);
    expect(css).toMatch(/--color-purple-700:\s*#5b21b6/);
    expect(css).toMatch(/--color-red-600:\s*#b91c1c/);
    expect(css).toMatch(/--color-green-600:\s*#15803d/);
  });

  it("marks each Button with its variant, which the theme's button rules read", () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(save.getAttribute('data-variant')).toBe('default');
    expect(cancel.getAttribute('data-variant')).toBe('outline');
    expect(cancel.getAttribute('data-size')).toBe('sm');
    // The outline rule only applies while the component's own default classes
    // are still there, so a colour a screen passes in is never overridden.
    expect(cancel.className).toContain('border-border');
    expect(cancel.className).toContain('hover:bg-accent');
  });
});
