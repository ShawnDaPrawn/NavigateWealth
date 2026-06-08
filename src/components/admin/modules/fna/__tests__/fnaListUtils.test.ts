/**
 * Tests for normalizeFnaListResponse — pure response normalizer.
 */

import { describe, expect, it } from 'vitest';
import { normalizeFnaListResponse } from '../fnaListUtils';

interface FNA {
  id: string;
}

describe('normalizeFnaListResponse', () => {
  it('returns array directly when result is already an array', () => {
    const arr = [{ id: '1' }, { id: '2' }];
    expect(normalizeFnaListResponse<FNA>(arr)).toEqual(arr);
  });

  it('returns empty array when result is empty array', () => {
    expect(normalizeFnaListResponse<FNA>([])).toEqual([]);
  });

  it('returns data when response has success=true and data array', () => {
    const result = { success: true, data: [{ id: '1' }] };
    expect(normalizeFnaListResponse<FNA>(result)).toEqual([{ id: '1' }]);
  });

  it('returns data when response has data array without success flag', () => {
    const result = { data: [{ id: '2' }] };
    expect(normalizeFnaListResponse<FNA>(result)).toEqual([{ id: '2' }]);
  });

  it('throws when response has no recognized shape', () => {
    expect(() => normalizeFnaListResponse<FNA>({ error: 'not found' })).toThrow('not found');
  });

  it('throws default message when error field is absent', () => {
    expect(() => normalizeFnaListResponse<FNA>({})).toThrow('Failed to load FNAs');
  });

  it('success=false with data array still returns data (data-only path)', () => {
    const result = { success: false, data: [{ id: '3' }] };
    expect(normalizeFnaListResponse<FNA>(result)).toEqual([{ id: '3' }]);
  });
});
