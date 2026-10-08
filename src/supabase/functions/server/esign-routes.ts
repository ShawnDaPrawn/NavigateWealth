/**
 * E-Signature API Routes (KV Store Version)
 * RESTful API endpoints for e-signature functionality
 */

import { Hono } from 'npm:hono';
import meRoutes from './esign-me-routes.ts';
import opsRoutes from './esign-ops-routes.ts';
import webhooksRoutes from './esign-webhooks-routes.ts';
import apiKeysRoutes from './esign-api-keys-routes.ts';
import templatesRoutes from './esign-templates-routes.ts';
import consentRoutes from './esign-consent-routes.ts';
import v1Routes from './esign-v1-routes.ts';
import firmAdminRoutes from './esign-firm-admin-routes.ts';
import campaignsRoutes from './esign-campaigns-routes.ts';
import diagnosticsRoutes from './esign-diagnostics-routes.ts';
import fieldsRoutes from './esign-fields-routes.ts';
import documentsRoutes from './esign-documents-routes.ts';
import envelopesRoutes from './esign-envelopes-routes.ts';
import signerRoutes from './esign-signer-routes.ts';
import senderRoutes from './esign-sender-routes.ts';
import { startExpirySweepScheduler } from './esign-scheduler.ts';

// Initialize Hono router. This file is a thin composition root: every route
// group lives in its own esign-<group>-routes.ts sub-app and is mounted below.
const esignRoutes = new Hono();

// Root handlers
esignRoutes.get('/', (c) => c.json({ service: 'esign', status: 'active' }));
esignRoutes.get('', (c) => c.json({ service: 'esign', status: 'active' }));

// --- /me/* sender self-service routes (extracted to esign-me-routes.ts) ---
esignRoutes.route('/', meRoutes);

// --- ops/sweeps routes: /diagnostics/sms, /maintenance/*, /cron/* (esign-ops-routes.ts) ---
esignRoutes.route('/', opsRoutes);

// --- /webhooks/* firm-scoped event subscriptions (esign-webhooks-routes.ts) ---
esignRoutes.route('/', webhooksRoutes);

// --- /api-keys/* programmatic-access key management (esign-api-keys-routes.ts) ---
esignRoutes.route('/', apiKeysRoutes);

// --- /templates/* reusable envelope templates (esign-templates-routes.ts) ---
esignRoutes.route('/', templatesRoutes);

// --- /consent/* consent document registry (esign-consent-routes.ts) ---
esignRoutes.route('/', consentRoutes);

// --- /v1/* public REST API (API-key auth) (esign-v1-routes.ts) ---
esignRoutes.route('/', v1Routes);

// --- retention / branding / metrics / recovery-bin (esign-firm-admin-routes.ts) ---
esignRoutes.route('/', firmAdminRoutes);

// --- campaigns / documents-upload / packets + packet-runs (esign-campaigns-routes.ts) ---
esignRoutes.route('/', campaignsRoutes);

// --- diagnostics / ops sweeps: stuck-alert, audit-search, synthetic-probe (esign-diagnostics-routes.ts) ---
esignRoutes.route('/', diagnosticsRoutes);

// --- /envelopes/:id/fields signature-field CRUD (esign-fields-routes.ts) ---
esignRoutes.route('/', fieldsRoutes);

// --- /envelopes/:id documents + manifest + materialize + invites (esign-documents-routes.ts) ---
esignRoutes.route('/', documentsRoutes);

// --- envelope CRUD + draft: verify-hash, list/delete/upload, get, draft-* (esign-envelopes-routes.ts) ---
esignRoutes.route('/', envelopesRoutes);

// --- signer token-flow: sign-by-token, validate, OTP, submit, reject, ... (esign-signer-routes.ts) ---
esignRoutes.route('/', signerRoutes);

// --- sender envelope-actions + KBA: clients, sender-OTP, sign, audit, recall, ... (esign-sender-routes.ts) ---
esignRoutes.route('/', senderRoutes);

// Start the background expiry sweep scheduler on first module load.
// Safe to call multiple times — internally deduped.
startExpirySweepScheduler();

// ==================== HELPER FUNCTIONS ====================

// ==================== API ROUTES ====================

/**
 * GET /health
 * Health check endpoint
 */
esignRoutes.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'esign',
    timestamp: new Date().toISOString(),
  });
});

export default esignRoutes;
