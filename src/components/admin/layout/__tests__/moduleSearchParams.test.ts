import { describe, expect, it } from 'vitest';
import { moduleSearchParams } from '../moduleSearchParams';

describe('moduleSearchParams', () => {
  it('keeps only the module, so a sidebar click opens its default view', () => {
    expect(moduleSearchParams('clients').toString()).toBe('module=clients');
  });

  it('opens the dashboard on a bare /admin', () => {
    expect(moduleSearchParams('dashboard').toString()).toBe('');
  });

  it('cannot smuggle a client deep link inside the module name', () => {
    const params = moduleSearchParams('clients&clientId=c-aaron');
    expect(params.get('clientId')).toBeNull();
    expect(params.get('module')).toBe('clients&clientId=c-aaron');
  });
});
