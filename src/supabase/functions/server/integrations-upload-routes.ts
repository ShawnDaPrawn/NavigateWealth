/**
 * Upload / History / Sync-run routes (Phase 5 Slice B decomposition).
 * ====================================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST /upload                     — ingest a spreadsheet; preview or commit
 *   GET  /history                    — paginated upload history
 *   GET  /sync-runs/:runId           — fetch a staged sync run
 *   POST /sync-runs/:runId/publish   — publish (or partial-publish) a sync run
 *
 * @module server/integrations-upload-routes
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAdmin } from './auth-mw.ts';
import type { KvProvider } from './integrations-types.ts';
import type {
  IntegrationConfig,
  UploadHistory,
  IntegrationSyncRun,
} from './integrations-core-types.ts';
import {
  getDefaultIntegrationSettings,
  normaliseSettings,
  fieldBindingsToMapping,
  normaliseIntegrationConfig,
} from './integrations-config-utils.ts';
import { getSchemaForCategory } from './integrations-field-utils.ts';
import { portalArtifactsMatchCategory } from './integrations-portal-guards.ts';
import { getSyncRunScopeError } from './integrations-portal-flow.ts';
import {
  getTemplateFieldBindings,
  buildSyncRun,
  publishSyncRun,
} from './integrations-sync-engine.ts';
import {
  MAX_INTEGRATION_UPLOAD_BYTES,
  isTemplateMetadataColumn,
  readSpreadsheetUpload,
} from './integrations-spreadsheet.ts';

const app = new Hono();
const log = createModuleLogger('integrations-upload');

const isUploadedFile = (value: unknown): value is File =>
  value instanceof File ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).name === 'string' &&
    typeof (value as File).size === 'number');

// POST /upload
app.post('/upload', requireAdmin, async (c) => {
  try {
    // Wrap parseBody in try/catch — Hono's parseBody calls formData.forEach()
    // internally, which throws if the body cannot be parsed as FormData
    // (e.g. missing/malformed Content-Type boundary, already-consumed stream).
    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch (parseErr: unknown) {
      log.error('Failed to parse multipart form data:', parseErr);
      return c.json(
        {
          error: 'Invalid form data. Ensure the request uses multipart/form-data encoding.',
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        },
        400,
      );
    }

    const file = body['file'];
    const providerId = body['providerId'] as string;
    const categoryId = body['categoryId'] as string;
    const mode = (body['mode'] as string) || 'preview';

    if (!isUploadedFile(file)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    if (!providerId || !categoryId) {
      return c.json({ error: 'Missing context (provider/category)' }, 400);
    }

    const provider = (await kv.get(`provider:${providerId}`)) as KvProvider | null;
    if (!provider) {
      return c.json({ error: 'Invalid provider ID' }, 400);
    }

    const configKey = `config:mapping:${providerId}:${categoryId}`;
    const storedConfig = (await kv.get(configKey)) as IntegrationConfig | null;

    if (!storedConfig && mode === 'commit') {
      return c.json(
        { error: 'No mapping configuration found. Please configure mappings first.' },
        400,
      );
    }

    const schema = await getSchemaForCategory(categoryId);
    const config = normaliseIntegrationConfig(
      storedConfig
        ? {
            ...storedConfig,
            providerId,
            categoryId,
          }
        : {
            providerId,
            categoryId,
            fieldMapping: {},
            fieldBindings: [],
            settings: getDefaultIntegrationSettings(),
          },
      schema.fields || [],
    );

    const templateBindings = getTemplateFieldBindings(config, schema.fields || []);
    const fieldMapping = fieldBindingsToMapping(templateBindings, config.fieldMapping || {});
    const settings = normaliseSettings(config.settings);

    if (file.size > MAX_INTEGRATION_UPLOAD_BYTES) {
      return c.json(
        { error: 'Spreadsheet is too large. Please upload a file smaller than 5 MB.' },
        400,
      );
    }

    const buffer = await file.arrayBuffer();
    let spreadsheetRows: ReturnType<typeof readSpreadsheetUpload>;
    try {
      spreadsheetRows = readSpreadsheetUpload(buffer);
    } catch (spreadsheetErr) {
      return c.json({ error: getErrMsg(spreadsheetErr) }, 400);
    }
    const { headers, rawRows, previewRows } = spreadsheetRows;

    if (!headers || headers.length === 0) {
      return c.json({ error: 'File has no headers in the first row' }, 400);
    }

    const visibleHeaders = headers.filter((header) => !isTemplateMetadataColumn(header));
    if (visibleHeaders.length === 0) {
      return c.json({ error: 'File does not contain any mapped spreadsheet columns' }, 400);
    }

    if (rawRows.length === 0) {
      return c.json({ error: 'File does not contain any policy rows to stage' }, 400);
    }

    const mappedColumns: string[] = [];
    const unmappedColumns: string[] = [];
    const validationErrors: string[] = [];

    visibleHeaders.forEach((header) => {
      if (fieldMapping[header]) {
        mappedColumns.push(header);
      } else {
        unmappedColumns.push(header);
      }
    });

    if (!settings.ignoreUnmatched && unmappedColumns.length > 0) {
      validationErrors.push(`Unmapped columns detected: ${unmappedColumns.join(', ')}`);
    }

    if (settings.strictMode && unmappedColumns.length > 0 && !settings.ignoreUnmatched) {
      return c.json(
        {
          success: false,
          error: 'Strict Mode Violation: Unmapped columns found.',
          preview: {
            totalRows: rawRows.length,
            mappedColumns,
            unmappedColumns,
            validationErrors,
          },
        },
        400,
      );
    }

    if (mode === 'preview') {
      return c.json({
        success: true,
        preview: {
          totalRows: rawRows.length,
          mappedColumns,
          unmappedColumns,
          validationErrors,
          sampleData: previewRows.slice(0, 5),
        },
      });
    }

    if (mode === 'commit') {
      const syncRun = await buildSyncRun({
        provider,
        providerId,
        categoryId,
        fileName: file.name,
        rawRows,
        fieldMapping,
        fieldBindings: templateBindings,
        settings,
        ignoreBlankValues: true,
      });

      const finalRun = settings.autoPublish
        ? await publishSyncRun(syncRun, { autoOnly: true })
        : syncRun;

      const runKey = `sync-run:${finalRun.id}`;
      await kv.set(runKey, finalRun);

      const historyEntry: UploadHistory = {
        id: crypto.randomUUID(),
        providerId,
        categoryId,
        fileName: file.name,
        status: finalRun.status === 'failed' ? 'failed' : 'success',
        rowCount: finalRun.summary.totalRows,
        errorCount:
          finalRun.summary.invalidRows +
          finalRun.summary.duplicateRows +
          finalRun.summary.unmatchedRows,
        uploadedAt: new Date().toISOString(),
        errors: validationErrors,
        runId: finalRun.id,
        publishedRows: finalRun.summary.publishedRows,
      };

      // `historyEntry.id` is in the key because `Date.now()` is only
      // millisecond-resolution and `kv.set` upserts. The reader below
      // prefix-scans `history:{providerId}:{categoryId}` and sorts by
      // `uploadedAt`, not by the key, so this is backward compatible.
      const historyKey = `history:${providerId}:${categoryId}:${Date.now()}:${historyEntry.id}`;
      await kv.set(historyKey, historyEntry);

      return c.json({
        success: true,
        result: {
          insertedRows: finalRun.summary.publishedRows,
          stagedRows: finalRun.summary.totalRows,
          historyId: historyEntry.id,
          runId: finalRun.id,
          autoPublished: settings.autoPublish,
          stagedRun: finalRun,
        },
      });
    }

    return c.json({ error: 'Invalid mode' }, 400);
  } catch (e) {
    log.error('Upload error:', e);
    return c.json({ error: 'Internal server error during upload', details: getErrMsg(e) }, 500);
  }
});

// GET /history
app.get('/history', requireAdmin, async (c) => {
  const providerId = c.req.query('providerId');
  const categoryId = c.req.query('categoryId');

  if (!providerId || !categoryId) {
    return c.json({ error: 'Missing providerId or categoryId' }, 400);
  }

  try {
    const prefix = `history:${providerId}:${categoryId}`;
    const historyItems = await kv.getByPrefix(prefix);

    const sorted = ((historyItems || []) as UploadHistory[]).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    return c.json(sorted);
  } catch (e) {
    log.error('History fetch error:', e);
    return c.json([]);
  }
});

// GET /sync-runs/:runId
app.get('/sync-runs/:runId', requireAdmin, async (c) => {
  try {
    const runId = c.req.param('runId')!;
    const run = (await kv.get(`sync-run:${runId}`)) as IntegrationSyncRun | null;
    if (!run) {
      return c.json({ error: 'Sync run not found' }, 404);
    }
    return c.json({ success: true, run });
  } catch (e) {
    log.error('Sync run fetch error:', e);
    return c.json({ error: 'Failed to fetch sync run' }, 500);
  }
});

// POST /sync-runs/:runId/publish
app.post('/sync-runs/:runId/publish', requireAdmin, async (c) => {
  try {
    const runId = c.req.param('runId')!;
    const body = await c.req.json().catch(() => ({}));
    const rowIds = Array.isArray(body?.rowIds)
      ? body.rowIds.filter((id: unknown) => typeof id === 'string')
      : undefined;

    const run = (await kv.get(`sync-run:${runId}`)) as IntegrationSyncRun | null;
    if (!run) {
      return c.json({ error: 'Sync run not found' }, 404);
    }
    const scopeError = getSyncRunScopeError(run, body?.providerId, body?.categoryId);
    if (scopeError) {
      return c.json({ error: scopeError }, 409);
    }
    if (
      body?.categoryId &&
      !portalArtifactsMatchCategory(String(body.categoryId), { stagedRun: run })
    ) {
      return c.json(
        {
          error:
            'This staged portal extraction contains retirement annuity data and cannot be published from an investments category.',
        },
        409,
      );
    }

    const publishedRun = await publishSyncRun(run, { rowIds });
    await kv.set(`sync-run:${publishedRun.id}`, publishedRun);

    return c.json({
      success: true,
      run: publishedRun,
      summary: publishedRun.summary,
    });
  } catch (e) {
    log.error('Sync run publish error:', e);
    return c.json({ error: `Failed to publish sync run: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
