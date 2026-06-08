import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGS, LANG_LABELS, SIGNER_DICTIONARY, normaliseLang, t } from '../i18n';

describe('esign-signer/i18n', () => {
  it('SUPPORTED_LANGS includes en, af, and zu', () => {
    expect(SUPPORTED_LANGS).toContain('en');
    expect(SUPPORTED_LANGS).toContain('af');
    expect(SUPPORTED_LANGS).toContain('zu');
  });

  it('LANG_LABELS has a display label for each supported language', () => {
    SUPPORTED_LANGS.forEach((lang) => {
      expect(typeof LANG_LABELS[lang]).toBe('string');
      expect(LANG_LABELS[lang].length).toBeGreaterThan(0);
    });
  });

  it('SIGNER_DICTIONARY has loading.title in all three languages', () => {
    const entry = SIGNER_DICTIONARY['loading.title'];
    expect(typeof entry.en).toBe('string');
    expect(typeof entry.af).toBe('string');
    expect(typeof entry.zu).toBe('string');
  });

  it('normaliseLang returns en for undefined', () => {
    expect(normaliseLang(undefined)).toBe('en');
    expect(normaliseLang(null)).toBe('en');
    expect(normaliseLang('')).toBe('en');
  });

  it('normaliseLang returns en for unknown language code', () => {
    expect(normaliseLang('fr')).toBe('en');
    expect(normaliseLang('es')).toBe('en');
  });

  it('normaliseLang returns af for Afrikaans input', () => {
    expect(normaliseLang('af')).toBe('af');
    expect(normaliseLang('AF')).toBe('af');
    expect(normaliseLang('afrikaans')).toBe('af');
  });

  it('normaliseLang returns zu for isiZulu input', () => {
    expect(normaliseLang('zu')).toBe('zu');
    expect(normaliseLang('ZU')).toBe('zu');
  });

  it('t returns English translation by default', () => {
    const result = t('loading.title');
    expect(result).toBe('Loading Document');
  });

  it('t returns Afrikaans translation when lang is af', () => {
    const result = t('loading.title', 'af');
    expect(result).not.toBe('Loading Document');
    expect(result.length).toBeGreaterThan(0);
  });

  it('t returns isiZulu translation when lang is zu', () => {
    const result = t('loading.title', 'zu');
    expect(result.length).toBeGreaterThan(0);
  });

  it('t interpolates vars into the template', () => {
    const result = t('footer.support', 'en', { email: 'support@example.com' });
    expect(result).toContain('support@example.com');
    expect(result).not.toContain('{email}');
  });

  it('t leaves unknown placeholders intact', () => {
    const result = t('footer.support', 'en', {});
    expect(result).toContain('{email}');
  });

  it('t returns template unchanged when vars is not provided', () => {
    const result = t('loading.title', 'en');
    expect(result).toBe('Loading Document');
  });
});
