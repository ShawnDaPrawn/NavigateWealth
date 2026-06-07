import { describe, it, expect } from 'vitest';
import { FORM_STATUS_CONFIG, STARTER_TEMPLATES, VALIDATION_RULE_PRESETS } from '../constants';

describe('FORM_STATUS_CONFIG', () => {
  it('covers draft, published, and archived statuses', () => {
    expect(FORM_STATUS_CONFIG.draft).toBeDefined();
    expect(FORM_STATUS_CONFIG.published).toBeDefined();
    expect(FORM_STATUS_CONFIG.archived).toBeDefined();
  });

  it('every status has label, badgeClass, dotClass, and description', () => {
    Object.values(FORM_STATUS_CONFIG).forEach((cfg) => {
      expect(typeof cfg.label).toBe('string');
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.badgeClass.length).toBeGreaterThan(0);
      expect(cfg.dotClass.length).toBeGreaterThan(0);
      expect(cfg.description.length).toBeGreaterThan(0);
    });
  });

  it('published badge contains green, archived contains gray', () => {
    expect(FORM_STATUS_CONFIG.published.badgeClass).toContain('green');
    expect(FORM_STATUS_CONFIG.archived.badgeClass).toContain('gray');
  });
});

describe('STARTER_TEMPLATES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(STARTER_TEMPLATES)).toBe(true);
    expect(STARTER_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('every template has id, name, description, category, tags, and pageEstimate', () => {
    STARTER_TEMPLATES.forEach((t) => {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.category.length).toBeGreaterThan(0);
      expect(Array.isArray(t.tags)).toBe(true);
      expect(t.pageEstimate).toBeGreaterThan(0);
    });
  });

  it('contains blank, client_consent, kyc_compliance, fna_intake templates', () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('blank');
    expect(ids).toContain('client_consent');
    expect(ids).toContain('kyc_compliance');
    expect(ids).toContain('fna_intake');
  });

  it('blank template has empty blocks array', () => {
    const blank = STARTER_TEMPLATES.find((t) => t.id === 'blank');
    expect(blank?.blocks).toEqual([]);
  });

  it('client_consent template has multiple blocks', () => {
    const template = STARTER_TEMPLATES.find((t) => t.id === 'client_consent');
    expect(template?.blocks.length).toBeGreaterThan(0);
  });

  it('every non-empty template block has id and type', () => {
    STARTER_TEMPLATES.forEach((t) => {
      t.blocks.forEach((block) => {
        expect(block.id.length).toBeGreaterThan(0);
        expect(block.type.length).toBeGreaterThan(0);
      });
    });
  });

  it('contains record_of_advice template in Legal category', () => {
    const roa = STARTER_TEMPLATES.find((t) => t.id === 'record_of_advice');
    expect(roa).toBeDefined();
    expect(roa?.category).toBe('Legal');
  });
});

describe('VALIDATION_RULE_PRESETS', () => {
  it('is a non-empty object', () => {
    expect(Object.keys(VALIDATION_RULE_PRESETS).length).toBeGreaterThan(0);
  });

  it('sa_id preset has required and pattern rules', () => {
    const preset = VALIDATION_RULE_PRESETS.sa_id;
    expect(preset.label).toBeTruthy();
    const types = preset.rules.map((r) => r.type);
    expect(types).toContain('required');
    expect(types).toContain('pattern');
  });

  it('email preset has required and email rules', () => {
    const preset = VALIDATION_RULE_PRESETS.email;
    const types = preset.rules.map((r) => r.type);
    expect(types).toContain('required');
    expect(types).toContain('email');
  });

  it('percentage preset enforces 0-100 bounds', () => {
    const preset = VALIDATION_RULE_PRESETS.percentage;
    const minRule = preset.rules.find((r) => r.type === 'min_value');
    const maxRule = preset.rules.find((r) => r.type === 'max_value');
    expect(minRule?.value).toBe(0);
    expect(maxRule?.value).toBe(100);
  });

  it('every preset has a label and at least one rule with a message', () => {
    Object.values(VALIDATION_RULE_PRESETS).forEach((preset) => {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.rules.length).toBeGreaterThan(0);
      preset.rules.forEach((rule) => {
        expect(rule.message.length).toBeGreaterThan(0);
      });
    });
  });
});
