/**
 * AI metering coverage — does every provider call sit behind a spend cap?
 * ======================================================================
 *
 * WHY A TEST AND NOT A COMMENT
 * ----------------------------
 * The first version of this work kept the answer in a comment in
 * `mount-modules.ts` listing the metered prefixes, and asserted in a PR
 * description that the list was auditable. It was not: it had already missed
 * `/policy-extraction/extract` and `/policy-extraction/bulk-reextract`, both
 * of which call OpenAI on an authenticated route, and the second of which does
 * it once per matching policy. A compromised account kept unbounded spend
 * through a route the inventory said did not exist.
 *
 * A list nobody recomputes is a list that is wrong. So this recomputes it: it
 * finds every module that reaches an AI provider and requires each one to
 * carry a guard — at route level, at prefix level, or with a written reason
 * for neither.
 *
 * WHAT IT CANNOT DO
 * -----------------
 * It is static analysis over source text, so it answers "does this module
 * mention a guard" rather than "is that guard on the route that spends". A
 * module could pass by guarding one endpoint and leaving a second unguarded.
 * That is a real limit and the reason the exemption list below carries
 * reasons rather than just names: the value is in a NEW provider-calling
 * module failing this test until someone has decided which of its routes cost
 * money.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every server source file, tests excluded. */
function serverSources(dir = SERVER_DIR, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      serverSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Does this file register an HTTP route?
 *
 * Requires a STRING PATH first argument, the same shape
 * `route-auth-granular.test.ts` uses. Without that constraint `kv.get('k')`,
 * `map.get(x)` and `store.delete(id)` all read as route registrations, and the
 * first run of this test duly reported twelve service modules — which have no
 * routes to guard — as unmetered offenders.
 */
function registersRoutes(src: string): boolean {
  return /\b\w+\.(get|post|put|patch|delete)\(\s*(['"`])(\/[^'"`]*)\2/.test(src);
}

/** Does this file talk to an AI provider directly? */
function callsProviderDirectly(src: string): boolean {
  return (
    /api\.openai\.com/.test(src) ||
    /\bOPENAI_(PRIMARY_MODEL|FALLBACK_MODEL)\b/.test(src) ||
    /\bcallOpenAI\w*\(/.test(src)
  );
}

/** Local `./x.ts` imports, as bare module basenames. */
function localImports(src: string): string[] {
  return [...src.matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => m[1].split('/').pop()!);
}

/**
 * A router "spends" if it calls a provider itself OR imports a module that
 * does. The second half is the important one and was missing from the first
 * version of this file, which found only five routers: most of them delegate
 * the actual call to a service (`ai-advisor.ts` -> `ai-advisor-chat.ts`,
 * `tax-agent-routes.ts` -> `tax-agent-service.ts`), so the router source never
 * mentions OpenAI at all and the analysis walked straight past it.
 *
 * One level of imports, not a full transitive closure: it is enough to reach
 * every router-to-service edge in this tree, and a deeper walk starts pulling
 * in `ai-model-config.ts` through unrelated re-exports and calling half the
 * server an AI route.
 */
function buildProviderModuleSet(files: string[]): Set<string> {
  const direct = new Set<string>();
  for (const file of files) {
    if (callsProviderDirectly(readFileSync(file, 'utf8'))) {
      direct.add(file.split('/').pop()!);
    }
  }
  return direct;
}

/**
 * Modules that call a provider from a route and deliberately carry no
 * `aiUsageLimit`. Each needs a reason, because "it looked fine" is how
 * policy-extraction went unmetered.
 */
const EXEMPT: Record<string, string> = {
  'integrations.tsx':
    'Mount-only parent. It reaches a provider solely by routing to ' +
    'integrations-policy-extraction-routes.ts, which carries the guards on its ' +
    'own spending endpoints. A guard here would double-charge every one of them ' +
    'and also meter the sibling routers mounted beside it, none of which spend.',
  'vasco-routes.ts':
    'Metered by vasco-guardrails.ts instead, and more tightly: per-visitor and ' +
    'per-IP daily caps, a burst window and an estimated-token budget. A second ' +
    'limiter over the top would double the counter writes and make the effective ' +
    'limit the harder of two numbers to reason about.',
};

/** Prefixes metered at mount level rather than per route. */
const PREFIX_METERED_MODULES = new Set(['publications-ai-routes.ts', 'transcription-routes.ts']);

describe('AI metering coverage', () => {
  const files = serverSources();
  const providerModuleSet = buildProviderModuleSet(files);

  const offenders: string[] = [];
  const providerModules: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!registersRoutes(src)) continue;

    const spends =
      callsProviderDirectly(src) ||
      localImports(src).some((imported) => providerModuleSet.has(imported));
    if (!spends) continue;

    const name = file.slice(SERVER_DIR.length + 1);
    providerModules.push(name);

    const base = name.split('/').pop()!;
    if (EXEMPT[base] || PREFIX_METERED_MODULES.has(base)) continue;
    // Either form counts: the middleware, or the direct call a router uses
    // when it authenticates inside the handler and has no verified user on the
    // context until then (will-chat, tax-agent).
    if (/\b(aiUsageLimit|chargeAiUsage)\s*\(/.test(src)) continue;

    offenders.push(name);
  }

  it('every provider-calling router is metered, exempt, or prefix-metered', () => {
    expect(
      offenders,
      `These modules call an AI provider from a route with no aiUsageLimit guard:\n  ` +
        `${offenders.join('\n  ')}\n\n` +
        `Add the guard to the endpoints that spend, or add the module to EXEMPT ` +
        `with a reason. Do NOT widen the detector to make this pass.`,
    ).toEqual([]);
  });

  it('finds a plausible number of provider-calling routers — the analysis still works', () => {
    // A regex that silently matched nothing would make the assertion above
    // vacuous, and this suite would pass forever while metering nothing.
    expect(providerModules.length).toBeGreaterThanOrEqual(10);
  });

  it('carries no stale exemption', () => {
    const present = new Set(serverSources().map((f) => f.split('/').pop()!));
    const stale = Object.keys(EXEMPT).filter((name) => !present.has(name));
    expect(stale, `EXEMPT names a module that no longer exists: ${stale.join(', ')}`).toEqual([]);
  });

  it('pins policy-extraction specifically — the omission that motivated this file', () => {
    const src = readFileSync(join(SERVER_DIR, 'integrations-policy-extraction-routes.ts'), 'utf8');
    expect(src).toMatch(/aiUsageLimit\(\{ surface: 'policy-extraction' \}\)/);
    // Both spending endpoints, not just the one that is easy to find.
    const guarded = src.match(/aiUsageLimit\(/g) ?? [];
    expect(guarded.length).toBeGreaterThanOrEqual(2);
  });
});
