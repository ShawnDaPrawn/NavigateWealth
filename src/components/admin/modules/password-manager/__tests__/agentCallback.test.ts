import { describe, expect, it } from 'vitest';
import { KNOWN_CALLBACKS, callbackReady } from '../agentCallbacks';

describe('agent callback addresses', () => {
  it('fills in Claude’s shared callback and nothing for ChatGPT, whose apps each have their own', () => {
    // Pre-filling ChatGPT's old shared address made every ChatGPT sign-in fail
    // on 2026-11-26 ("asked to return to https://chatgpt.com/connector/oauth/…").
    expect(KNOWN_CALLBACKS.claude).toBe('https://claude.ai/api/mcp/auth_callback');
    expect(KNOWN_CALLBACKS.chatgpt).toBe('');
  });

  it('will not create a ChatGPT connection until a chatgpt.com callback is pasted', () => {
    expect(callbackReady('chatgpt', '')).toBe(false);
    expect(callbackReady('chatgpt', 'https://claude.ai/api/mcp/auth_callback')).toBe(false);
    expect(callbackReady('chatgpt', ' https://chatgpt.com/connector/oauth/RrijQLbULQfr ')).toBe(
      true,
    );
  });

  it('leaves Claude and other tools free, where an empty address means a bearer token', () => {
    expect(callbackReady('claude', KNOWN_CALLBACKS.claude)).toBe(true);
    expect(callbackReady('other', '')).toBe(true);
  });
});
