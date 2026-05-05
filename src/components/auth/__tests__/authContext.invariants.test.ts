/**
 * Structural regression tests for AuthContext — cheap guards against reintroducing
 * parallel getSession bootstrap or dropping the session-hint hydration path.
 *
 * @module components/auth/__tests__/authContext.invariants.test
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const authContextSrc = readFileSync(join(dir, '..', 'AuthContext.tsx'), 'utf8');

describe('AuthContext structural invariants', () => {
  it('does not reintroduce SESSION_BOOTSTRAP or session_bootstrap_timeout (parallel getSession races)', () => {
    expect(authContextSrc).not.toMatch(/SESSION_BOOTSTRAP/);
    expect(authContextSrc).not.toContain('session_bootstrap_timeout');
  });

  it('hydrates profile with supabase session user passed into loadUserProfile', () => {
    expect(authContextSrc).toContain('opts?.supabaseUser');
    expect(authContextSrc).toMatch(/loadUserProfile\s*\(\s*authUser\.id\s*,\s*authUser\.email\s*,\s*opts\?\.supabaseUser\s*\)/);
  });

  it('documents single-pipeline auth via onAuthStateChange only', () => {
    expect(authContextSrc).toContain('parallel getSession() bootstrap was removed');
    expect(authContextSrc).toContain('onAuthStateChange');
  });
});
