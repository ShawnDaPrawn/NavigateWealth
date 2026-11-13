import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSED_GROUPS_KEY, readClosedGroups, writeClosedGroups } from '../sidebarState';

describe('sidebarState', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with every group open', () => {
    expect(readClosedGroups()).toEqual([]);
  });

  it('remembers closed groups', () => {
    writeClosedGroups(['Work', 'Practice']);
    expect(readClosedGroups()).toEqual(['Work', 'Practice']);
  });

  it('ignores stored values that are not a list of names', () => {
    localStorage.setItem(CLOSED_GROUPS_KEY, '{"Work":true}');
    expect(readClosedGroups()).toEqual([]);
    localStorage.setItem(CLOSED_GROUPS_KEY, '["Work", 3, null]');
    expect(readClosedGroups()).toEqual(['Work']);
    localStorage.setItem(CLOSED_GROUPS_KEY, 'not json');
    expect(readClosedGroups()).toEqual([]);
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeClosedGroups(['Work'])).not.toThrow();
    expect(readClosedGroups()).toEqual([]);
  });
});
