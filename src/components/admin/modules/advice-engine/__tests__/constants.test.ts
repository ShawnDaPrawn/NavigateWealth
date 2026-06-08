import { describe, expect, it } from 'vitest';
import { ENDPOINTS } from '../constants';

describe('advice-engine/constants', () => {
  it('ENDPOINTS has AI_STATUS and AI_CHAT paths', () => {
    expect(ENDPOINTS.AI_STATUS).toBe('/ai-intelligence/status');
    expect(ENDPOINTS.AI_CHAT).toBe('/ai-intelligence/chat');
  });

  it('ENDPOINTS has ROA paths', () => {
    expect(ENDPOINTS.ROA_DRAFT).toBeDefined();
    expect(ENDPOINTS.ROA_MODULES).toBeDefined();
    expect(ENDPOINTS.ROA_MODULE_CONTRACTS).toBeDefined();
  });

  it('ENDPOINTS has CLIENT_DETAILS and PERSONNEL_LIST', () => {
    expect(ENDPOINTS.CLIENT_DETAILS).toBe('/clients');
    expect(ENDPOINTS.PERSONNEL_LIST).toBe('/personnel/list');
  });

  it('all endpoint values start with /', () => {
    Object.values(ENDPOINTS).forEach((path) => {
      expect(path).toMatch(/^\//);
    });
  });
});
