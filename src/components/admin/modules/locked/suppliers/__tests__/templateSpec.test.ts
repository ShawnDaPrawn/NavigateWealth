/**
 * Tests for the invoice template spec normalizer — the gatekeeper that turns
 * an untrusted (AI-produced or hand-edited) spec into a renderable one.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_SPEC, normalizeTemplateSpec } from '../templateSpec';

describe('normalizeTemplateSpec', () => {
  it('returns the defaults for empty input', () => {
    expect(normalizeTemplateSpec(undefined)).toEqual(DEFAULT_TEMPLATE_SPEC);
    expect(normalizeTemplateSpec(null)).toEqual(DEFAULT_TEMPLATE_SPEC);
    expect(normalizeTemplateSpec({})).toEqual(DEFAULT_TEMPLATE_SPEC);
  });

  it('round-trips a valid spec unchanged', () => {
    const spec = normalizeTemplateSpec({
      ...DEFAULT_TEMPLATE_SPEC,
      palette: { ...DEFAULT_TEMPLATE_SPEC.palette, primary: '#aa00ff' },
      header: { ...DEFAULT_TEMPLATE_SPEC.header, title: 'BELASTINGFAKTUUR' },
    });
    expect(spec.palette.primary).toBe('#aa00ff');
    expect(spec.header.title).toBe('BELASTINGFAKTUUR');
    expect(normalizeTemplateSpec(spec)).toEqual(spec);
  });

  it('falls back on malformed hex colours', () => {
    const spec = normalizeTemplateSpec({
      palette: { primary: 'red', accent: '#zzz', headerText: '#12345', bodyText: 12 },
    });
    expect(spec.palette.primary).toBe(DEFAULT_TEMPLATE_SPEC.palette.primary);
    expect(spec.palette.accent).toBe(DEFAULT_TEMPLATE_SPEC.palette.accent);
    expect(spec.palette.headerText).toBe(DEFAULT_TEMPLATE_SPEC.palette.headerText);
    expect(spec.palette.bodyText).toBe(DEFAULT_TEMPLATE_SPEC.palette.bodyText);
  });

  it('lowercases and trims valid hex colours', () => {
    const spec = normalizeTemplateSpec({ palette: { primary: ' #AABBCC ' } });
    expect(spec.palette.primary).toBe('#aabbcc');
  });

  it('falls back on unknown enum values', () => {
    const spec = normalizeTemplateSpec({
      page: { margins: 'gigantic' },
      logo: { position: 'bottom-left' },
      lineTable: { style: 'fancy', headerStyle: 'neon' },
      formats: { currency: '$1,234.56', dateFormat: 'MM-dd-yy' },
    });
    expect(spec.page.margins).toBe('normal');
    expect(spec.logo.position).toBe('top-left');
    expect(spec.lineTable.style).toBe('lined');
    expect(spec.lineTable.headerStyle).toBe('filled');
    expect(spec.formats.currency).toBe('R1 234,56');
    expect(spec.formats.dateFormat).toBe('yyyy/MM/dd');
  });

  it('clamps out-of-range numbers', () => {
    const spec = normalizeTemplateSpec({
      typography: { baseSizePt: 40 },
      logo: { heightPx: 4 },
    });
    expect(spec.typography.baseSizePt).toBe(14);
    expect(spec.logo.heightPx).toBe(24);
  });

  it('restores essential meta fields and drops unknown/duplicate ones', () => {
    const spec = normalizeTemplateSpec({
      metaBox: {
        fields: [
          { key: 'dueDate', label: 'Payable By' },
          { key: 'dueDate', label: 'Duplicate' },
          { key: 'nonsense', label: 'Nope' },
        ],
      },
    });
    const keys = spec.metaBox.fields.map((f) => f.key);
    expect(keys).toContain('invoiceNumber');
    expect(keys).toContain('invoiceDate');
    expect(keys.filter((k) => k === 'dueDate')).toHaveLength(1);
    expect(keys).not.toContain('nonsense');
    expect(spec.metaBox.fields.find((f) => f.key === 'dueDate')?.label).toBe('Payable By');
  });

  it('guarantees description and lineTotal columns', () => {
    const spec = normalizeTemplateSpec({
      lineTable: { columns: [{ key: 'quantity', label: 'Qty', align: 'right' }] },
    });
    const keys = spec.lineTable.columns.map((c) => c.key);
    expect(keys[0]).toBe('description');
    expect(keys).toContain('lineTotal');
  });

  it('truncates over-long free text', () => {
    const spec = normalizeTemplateSpec({ header: { title: 'X'.repeat(500) } });
    expect(spec.header.title).toHaveLength(60);
  });
});
