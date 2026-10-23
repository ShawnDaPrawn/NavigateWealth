import { describe, expect, it } from 'vitest';
import { moduleSearchParams } from '../moduleSearchParams';

describe('moduleSearchParams', () => {
  it('keeps only the module, so a sidebar click opens its default view', () => {
    expect(moduleSearchParams('clients').toString()).toBe('module=clients');
  });

  it('opens the dashboard on a bare /admin', () => {
    expect(moduleSearchParams('dashboard').toString()).toBe('');
  });
});
