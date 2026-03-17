/**
 * Client Application Routes
 * Navigate Wealth Admin Server
 *
 * Thin dispatcher for client-facing application lifecycle endpoints.
 * Handles both self-service (client) and admin "on behalf of" flows.
 *
 * Route prefix: /applications (mounted in mount-modules.ts)
 *
 * Per SS4.2: routes parse input, call service, return responses.
 * Per SS14.2: static paths registered before /:id.
 *
 * Endpoints:
 *   POST  /save-progress       — Bulk save (backward compat with useOnboarding)
 *   POST  /submit              — Submit application for review
 *   POST  /step/:step          — Save a single step (per-step persistence)
 *   GET   /step/:applicationId/:step — Load a single step's data
 *   GET   /steps/:applicationId      — Load all steps
 *   GET   /:userId             — Get application by user ID
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { clientApplicationsService } from './client-applications-service.ts';
import { createModuleLogger } from './stderr-logger.ts';

const app = new Hono();
const log = createModuleLogger('client-applications-routes');

// ── POST /applications/save-progress ──────────────────────────────────────────
// Backward-compatible bulk save for the existing useOnboarding hook.
// Accepts { userId, applicationData } and persists all fields at once.
// Also handles text/plain content-type from navigator.sendBeacon (which cannot
// set application/json without triggering a CORS preflight that sendBeacon
// cannot handle — see WORKAROUND below).
app.post('/save-progress', async (c) => {
  try {
    // WORKAROUND: navigator.sendBeacon cannot do CORS preflights, so the
    // frontend sends with Content-Type: text/plain to avoid preflight.
    // We parse the body as JSON regardless of content-type.
    // Proper fix: use fetch with keepalive:true everywhere (modern browsers).
    // Searchable tag: // WORKAROUND: sendBeacon-text-plain
    let body: Record<string, unknown>;
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('text/plain')) {
      const raw = await c.req.text();
      body = JSON.parse(raw);
    } else {
      body = await c.req.json();
    }
    const { userId, applicationData } = body;

    if (!userId || !applicationData) {
      return c.json({ error: 'userId and applicationData are required' }, 400);
    }

    // Get or create the application for this user (upsert pattern).
    // Previously this returned 404 if no application existed, which meant
    // every auto-save silently failed for self-service clients because
    // the AccountTypeSelectionPage never created the KV record.
    const application = await clientApplicationsService.getOrCreate(userId);
    const applicationId = application.id as string;
    await clientApplicationsService.saveProgress(applicationId, applicationData, userId);

    return c.json({ success: true, data: { applicationId } });
  } catch (error: unknown) {
    log.error('save-progress error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to save progress',
    }, 500);
  }
});

// ── POST /applications/submit ─────────────────────────────────────────────────
// Submit a completed application for review.
app.post('/submit', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, applicationData } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Find the application for this user
    const application = await clientApplicationsService.getByUserId(userId);
    if (!application) {
      return c.json({ error: 'No application found for this user' }, 404);
    }

    const applicationId = application.id as string;

    // First save the final data
    if (applicationData) {
      await clientApplicationsService.saveProgress(applicationId, applicationData, userId);
    }

    // Then submit
    const result = await clientApplicationsService.submit(applicationId, {
      type: 'client',
      userId,
      timestamp: new Date().toISOString(),
    });

    return c.json({ success: true, data: result.application });
  } catch (error: unknown) {
    log.error('submit error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to submit application',
    }, 500);
  }
});

// ── POST /applications/step/:step ─────────────────────────────────────────────
// Save a single step's form data with per-step KV persistence.
// Body: { applicationId, data, completedBy: { type, userId } }
app.post('/step/:step', async (c) => {
  try {
    const stepParam = c.req.param('step');
    const step = parseInt(stepParam, 10);
    const body = await c.req.json();
    const { applicationId, data, completedBy } = body;

    if (!applicationId || !data || !completedBy) {
      return c.json({ error: 'applicationId, data, and completedBy are required' }, 400);
    }

    if (isNaN(step) || step < 1 || step > 5) {
      return c.json({ error: 'Step must be 1-5' }, 400);
    }

    const result = await clientApplicationsService.saveStep(
      applicationId,
      step,
      data,
      {
        ...completedBy,
        timestamp: new Date().toISOString(),
      },
    );

    return c.json({ success: true, data: result });
  } catch (error: unknown) {
    log.error('save step error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to save step',
    }, 500);
  }
});

// ── GET /applications/step/:applicationId/:step ───────────────────────────────
// Load a single step's saved data.
app.get('/step/:applicationId/:step', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 5) {
      return c.json({ error: 'Step must be 1-5' }, 400);
    }

    const stepData = await clientApplicationsService.getStep(applicationId, step);
    return c.json({ success: true, data: stepData });
  } catch (error: unknown) {
    log.error('get step error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to load step',
    }, 500);
  }
});

// ── GET /applications/steps/:applicationId ────────────────────────────────────
// Load all steps for resume or admin review.
app.get('/steps/:applicationId', async (c) => {
  try {
    const applicationId = c.req.param('applicationId');
    const steps = await clientApplicationsService.getAllSteps(applicationId);
    return c.json({ success: true, data: steps });
  } catch (error: unknown) {
    log.error('get all steps error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to load steps',
    }, 500);
  }
});

// ── GET /applications/:userId ─────────────────────────────────────────────────
// Get application metadata by user ID (backward-compatible with applicationService.ts).
app.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const application = await clientApplicationsService.getByUserId(userId);

    if (!application) {
      return c.json({ success: true, data: null });
    }

    return c.json({ success: true, data: application });
  } catch (error: unknown) {
    log.error('get application error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to load application',
    }, 500);
  }
});

export default app;