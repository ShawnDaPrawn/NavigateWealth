import { providerOrigins } from './broker-ops-origins.ts';
import { z } from 'npm:zod@4.6.5';
import {
  selectorFields,
  type Provider,
  type Selectors,
} from '../../../shared/broker-operations.ts';
export const provider = z.enum(['allan-gray', 'brightrock', 'capital-legacy']);
export function allowedUrl(value: string, key: Provider, login = false) {
  try {
    const u = new URL(value);
    const p = providerOrigins[key];
    return (
      !u.username &&
      !u.password &&
      [p.loginOrigin, ...(login ? [] : p.portalOrigins)].some((origin) => origin === u.origin)
    );
  } catch {
    return false;
  }
}
export const profile = z
  .object({
    provider,
    brokerage: z.string().trim().max(200),
    purpose: z.string().trim().max(200),
    homeUrl: z.string().url().max(2048),
    expectedIdentity: z.string().trim().min(1).max(160),
    mfaPrompt: z.string().trim().max(250),
    brokers: z
      .array(
        z.object({
          brokerId: z.uuid(),
          code: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .regex(/[a-z0-9]/i, 'Broker codes must contain a letter or digit'),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((p, ctx) => {
    if (!allowedUrl(p.homeUrl, p.provider))
      ctx.addIssue({
        code: 'custom',
        message: 'Select a home URL on the reviewed provider domain',
        path: ['homeUrl'],
      });
    if (
      new Set(p.brokers.map((b) => b.brokerId)).size !== p.brokers.length ||
      new Set(p.brokers.map((b) => b.code)).size !== p.brokers.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use a distinct broker and provider code for each link',
        path: ['brokers'],
      });
  });
export const workflowInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    provider,
    kind: z.enum(['test_login', 'monthly_statement']),
    selectors: z.object(
      Object.fromEntries(selectorFields.map((key) => [key, z.string().trim().max(400)])) as Record<
        keyof Selectors,
        z.ZodString
      >,
    ),
  })
  .superRefine((w, ctx) => {
    const required =
      w.kind === 'test_login'
        ? (['username', 'password', 'submit', 'identity', 'brokerCode'] as const)
        : selectorFields.filter((key) => key !== 'brokerSelect');
    for (const k of required)
      if (!w.selectors[k])
        ctx.addIssue({ code: 'custom', path: ['selectors', k], message: 'Selector required' });
  });
export const jobInput = z
  .object({
    requestId: z.uuid(),
    accountId: z.uuid(),
    brokerIds: z.array(z.uuid()).min(1).max(12),
    workflowId: z.uuid(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
  })
  .strict();
