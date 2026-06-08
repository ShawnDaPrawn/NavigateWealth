import { describe, it, expect } from 'vitest';
import { deepSanitize } from '../sanitization';

describe('deepSanitize', () => {
  it('returns null and undefined unchanged', () => {
    expect(deepSanitize(null)).toBeNull();
    expect(deepSanitize(undefined)).toBeUndefined();
  });

  it('passes through objects with short strings', () => {
    const obj = { name: 'Alice', email: 'alice@example.com' };
    expect(deepSanitize(obj)).toEqual(obj);
  });

  it('removes strings longer than 5000 chars', () => {
    const longStr = 'a'.repeat(5001);
    const obj = { data: longStr, name: 'Bob' };
    const result = deepSanitize(obj);
    expect(result.name).toBe('Bob');
    expect(result.data).toBeUndefined();
  });

  it('removes data: URI strings', () => {
    const obj = { image: 'data:image/png;base64,abc123', name: 'Photo' };
    const result = deepSanitize(obj);
    expect(result.name).toBe('Photo');
    expect(result.image).toBeUndefined();
  });

  it('removes data: URIs even in allowed URL keys', () => {
    const obj = { url: 'data:image/png;base64,abc123', path: 'data:text/plain;base64,hello' };
    const result = deepSanitize(obj);
    expect(result.url).toBeUndefined();
    expect(result.path).toBeUndefined();
  });

  it('keeps short URLs in allowed keys', () => {
    const obj = {
      url: 'https://example.com/image.jpg',
      href: '/relative/path',
      path: '/some/file',
    };
    const result = deepSanitize(obj);
    expect(result.url).toBe('https://example.com/image.jpg');
    expect(result.href).toBe('/relative/path');
    expect(result.path).toBe('/some/file');
  });

  it('strips long strings from deeply nested objects', () => {
    const longStr = 'x'.repeat(5001);
    const obj = { level1: { level2: { value: longStr, label: 'ok' } } };
    const result = deepSanitize(obj);
    expect(result.level1.level2.label).toBe('ok');
    expect(result.level1.level2.value).toBeUndefined();
  });

  it('passes through numbers and booleans', () => {
    const obj = { count: 42, flag: true, amount: 3.14 };
    expect(deepSanitize(obj)).toEqual(obj);
  });

  it('handles arrays', () => {
    const arr = [{ name: 'Alice' }, { image: 'data:image/png;base64,x' }];
    const result = deepSanitize(arr);
    expect(result[0].name).toBe('Alice');
    expect(result[1].image).toBeUndefined();
  });

  it('passes primitives through', () => {
    expect(deepSanitize(42)).toBe(42);
    expect(deepSanitize(true)).toBe(true);
    expect(deepSanitize('hello')).toBe('hello');
  });
});
