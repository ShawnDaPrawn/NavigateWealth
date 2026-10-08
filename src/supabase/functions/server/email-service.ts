/**
 * Email Service — re-export aggregator (Phase 5c).
 * ============================================================================
 *
 * The SendGrid transport + template engine live in email-core.ts; the domain
 * send* helpers are split across email-senders-{esign,onboarding,misc}.ts. This
 * thin barrel re-exports them all so the email-service.ts proxy keeps the same
 * surface for every importer.
 */
export * from './email-core.ts';
export * from './email-senders-esign.ts';
export * from './email-senders-onboarding.ts';
export * from './email-senders-misc.ts';
