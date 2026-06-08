import { describe, it, expect } from 'vitest';
import {
  ENDPOINTS,
  NOTE_COLOR_CONFIG,
  NOTE_COLORS,
  NOTE_SORT_OPTIONS,
  FILTER_PRESETS_STORAGE_KEY,
  PIN_ORDER_STORAGE_KEY,
  COLOUR_LABELS_STORAGE_KEY,
  NOTES_STALE_TIME,
  NOTES_DEBOUNCE_MS,
  MAX_RECORDING_DURATION_MS,
  RECORDING_TICK_MS,
} from '../constants';

describe('notes ENDPOINTS', () => {
  it('has static string endpoints for NOTES and TRANSCRIBE', () => {
    expect(typeof ENDPOINTS.NOTES).toBe('string');
    expect(typeof ENDPOINTS.TRANSCRIBE).toBe('string');
  });

  it('NOTE, CLIENT_NOTES, CONVERT_TO_TASK, SUMMARISE return URLs with the given id', () => {
    expect(ENDPOINTS.NOTE('note-1')).toContain('note-1');
    expect(ENDPOINTS.CLIENT_NOTES('client-1')).toContain('client-1');
    expect(ENDPOINTS.CONVERT_TO_TASK('note-2')).toContain('note-2');
    expect(ENDPOINTS.SUMMARISE('note-3')).toContain('note-3');
  });
});

describe('NOTE_COLOR_CONFIG', () => {
  it('covers default, yellow, green, blue, purple, pink, and orange colors', () => {
    expect(NOTE_COLOR_CONFIG.default).toBeDefined();
    expect(NOTE_COLOR_CONFIG.yellow).toBeDefined();
    expect(NOTE_COLOR_CONFIG.green).toBeDefined();
    expect(NOTE_COLOR_CONFIG.blue).toBeDefined();
    expect(NOTE_COLOR_CONFIG.purple).toBeDefined();
    expect(NOTE_COLOR_CONFIG.pink).toBeDefined();
    expect(NOTE_COLOR_CONFIG.orange).toBeDefined();
  });

  it('every color config has label, bg, border, accent, headerBg, and dot', () => {
    Object.values(NOTE_COLOR_CONFIG).forEach((cfg) => {
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.bg.length).toBeGreaterThan(0);
      expect(cfg.border.length).toBeGreaterThan(0);
      expect(cfg.accent.length).toBeGreaterThan(0);
      expect(cfg.headerBg.length).toBeGreaterThan(0);
      expect(cfg.dot.length).toBeGreaterThan(0);
    });
  });
});

describe('NOTE_COLORS', () => {
  it('is an array matching the keys of NOTE_COLOR_CONFIG', () => {
    expect(NOTE_COLORS.length).toBe(Object.keys(NOTE_COLOR_CONFIG).length);
    NOTE_COLORS.forEach((color) => {
      expect(NOTE_COLOR_CONFIG[color]).toBeDefined();
    });
  });
});

describe('NOTE_SORT_OPTIONS', () => {
  it('is a non-empty array with value and label fields', () => {
    expect(NOTE_SORT_OPTIONS.length).toBeGreaterThan(0);
    NOTE_SORT_OPTIONS.forEach((opt) => {
      expect(opt.value.length).toBeGreaterThan(0);
      expect(opt.label.length).toBeGreaterThan(0);
    });
  });

  it('contains updatedAt, createdAt, and title sort options', () => {
    const values = NOTE_SORT_OPTIONS.map((o) => o.value);
    expect(values).toContain('updatedAt');
    expect(values).toContain('createdAt');
    expect(values).toContain('title');
  });
});

describe('storage key constants', () => {
  it('FILTER_PRESETS_STORAGE_KEY, PIN_ORDER_STORAGE_KEY, COLOUR_LABELS_STORAGE_KEY are strings', () => {
    expect(typeof FILTER_PRESETS_STORAGE_KEY).toBe('string');
    expect(typeof PIN_ORDER_STORAGE_KEY).toBe('string');
    expect(typeof COLOUR_LABELS_STORAGE_KEY).toBe('string');
  });

  it('all storage keys are distinct', () => {
    const keys = [FILTER_PRESETS_STORAGE_KEY, PIN_ORDER_STORAGE_KEY, COLOUR_LABELS_STORAGE_KEY];
    expect(new Set(keys).size).toBe(3);
  });
});

describe('timing constants', () => {
  it('NOTES_STALE_TIME is a positive number', () => {
    expect(NOTES_STALE_TIME).toBeGreaterThan(0);
  });

  it('NOTES_DEBOUNCE_MS is a positive number', () => {
    expect(NOTES_DEBOUNCE_MS).toBeGreaterThan(0);
  });

  it('MAX_RECORDING_DURATION_MS is greater than RECORDING_TICK_MS', () => {
    expect(MAX_RECORDING_DURATION_MS).toBeGreaterThan(RECORDING_TICK_MS);
  });

  it('RECORDING_TICK_MS equals 1000 (one second)', () => {
    expect(RECORDING_TICK_MS).toBe(1000);
  });
});
