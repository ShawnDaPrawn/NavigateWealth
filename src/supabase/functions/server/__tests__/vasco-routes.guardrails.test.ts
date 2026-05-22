import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Vasco public route guardrail wiring', () => {
  it('checks public guardrails before calling streaming chat', () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), 'src/supabase/functions/server/vasco-routes.ts'),
      'utf8',
    );

    const streamRouteStart = routeSource.indexOf("app.post('/chat/stream'");
    const guardrailCheck = routeSource.indexOf('evaluateVascoPublicGuardrails', streamRouteStart);
    const chatStreamCall = routeSource.indexOf('chatStream({', streamRouteStart);

    expect(streamRouteStart).toBeGreaterThan(-1);
    expect(guardrailCheck).toBeGreaterThan(streamRouteStart);
    expect(chatStreamCall).toBeGreaterThan(guardrailCheck);
  });

  it('passes a safety identifier into public OpenAI calls', () => {
    const serviceSource = readFileSync(
      resolve(process.cwd(), 'src/supabase/functions/server/vasco-service.ts'),
      'utf8',
    );

    expect(serviceSource).toContain('safety_identifier: request.safetyIdentifier');
  });
});
