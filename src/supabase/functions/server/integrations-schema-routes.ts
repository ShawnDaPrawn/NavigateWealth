/**
 * Schema / Custom-key routes (Phase 5 Slice C decomposition).
 * ==========================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   GET  /schemas        — fetch schema for a category (with default fallback)
 *   GET  /schemas/batch  — all schemas merged with custom overrides in one call
 *   GET  /custom-keys    — custom key definitions for a category
 *   POST /schemas        — save / override a category schema
 *
 * @module server/integrations-schema-routes
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { DEFAULT_SCHEMAS } from './default-schemas.ts';
import { SaveSchemaInputSchema } from './integrations-validation.ts';
import type { KvSchema, SchemaField } from './integrations-types.ts';
import { autoGenerateCustomKeysForSchema } from './integrations-derive.ts';

const app = new Hono();
const log = createModuleLogger('integrations-schema');

// GET /schemas
app.get('/schemas', async (c) => {
  const categoryId = c.req.query('categoryId');
  if (!categoryId) return c.json({ error: 'Missing categoryId' }, 400);

  try {
    const key = `config:schema:${categoryId}`;
    let schema = await kv.get(key);

    if (!schema) {
      schema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
      log.info('Using default schema for category', { categoryId });
    }

    return c.json(schema || { fields: [] });
  } catch (e) {
    log.error('Error fetching schema, returning default:', e as Error, { categoryId });
    const defaultSchema = DEFAULT_SCHEMAS[categoryId] || { fields: [] };
    return c.json(defaultSchema);
  }
});

// GET /schemas/batch — returns all schemas in one call (defaults merged with custom overrides)
// Used by the client overview dashboard to avoid 13+ individual schema calls
app.get('/schemas/batch', async (c) => {
  try {
    // Fetch all custom schema overrides in one batch KV read
    const customSchemas = await kv.getByPrefix('config:schema:');
    const customMap: Record<string, unknown> = {};
    if (Array.isArray(customSchemas)) {
      for (const schema of customSchemas) {
        const s = schema as KvSchema;
        if (s?.categoryId && s?.fields) {
          customMap[s.categoryId] = s;
        }
      }
    }

    // Merge: custom overrides take precedence over defaults
    const allSchemas: Record<string, unknown> = {};
    for (const [catId, defaultSchema] of Object.entries(DEFAULT_SCHEMAS)) {
      allSchemas[catId] = customMap[catId] || defaultSchema;
    }
    // Include any custom schemas for categories not in defaults
    for (const [catId, schema] of Object.entries(customMap)) {
      if (!allSchemas[catId]) {
        allSchemas[catId] = schema;
      }
    }

    return c.json({ schemas: allSchemas });
  } catch (e) {
    log.error('Error fetching batch schemas, returning defaults:', e as Error);
    return c.json({ schemas: DEFAULT_SCHEMAS });
  }
});

// GET /custom-keys
app.get('/custom-keys', async (c) => {
  const categoryId = c.req.query('categoryId');

  if (!categoryId) {
    return c.json({ error: 'Missing categoryId' }, 400);
  }

  try {
    const customKeysKey = `config:custom_keys:${categoryId}`;
    const customKeys = (await kv.get(customKeysKey)) || [];

    return c.json({ customKeys });
  } catch (e) {
    log.error('Error fetching custom keys:', e);
    return c.json({ customKeys: [] });
  }
});

// POST /schemas
app.post('/schemas', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SaveSchemaInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { categoryId, fields } = parsed.data;

    const key = `config:schema:${categoryId}`;
    const schema = {
      categoryId,
      fields,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(key, schema);

    autoGenerateCustomKeysForSchema(categoryId, fields as unknown as SchemaField[]).catch((e) => {
      log.error('Background error generating custom keys:', e);
    });

    return c.json({ success: true, schema });
  } catch (e) {
    log.error('Error saving schema:', e);
    return c.json({ error: 'Failed to save schema' }, 500);
  }
});

export default app;
