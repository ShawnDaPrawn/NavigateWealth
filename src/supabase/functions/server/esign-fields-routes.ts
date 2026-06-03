/**
 * esign /envelopes/:id/fields routes — signature-field CRUD (Phase 5).
 * ====================================================================
 *
 * Extracted verbatim from esign-routes.tsx: replace-all (PUT) / list (GET) /
 * patch-one / delete-one of an envelope's signature fields during form
 * preparation. Mounted via `esignRoutes.route('/', fieldsRoutes)`. Depends on
 * shared esign services + esign-route-helpers (getRequestMetadata); no local
 * route helpers. Behaviour-preserving; guarded by the route contract suite
 * (the fields-group contracts landed ahead of this cut).
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { UpdateFieldsSchema } from './esign-validation.ts';
import { getRequestMetadata } from './esign-route-helpers.ts';
import { getEnvelopeDetails, logAuditEvent } from './esign-services.ts';

const log = createModuleLogger('esign-fields-routes');

const fieldsRoutes = new Hono();

fieldsRoutes.put('/envelopes/:envelopeId/fields', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');

    const body = await c.req.json();
    const parsed = UpdateFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { fields } = parsed.data;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get existing field IDs to clean up
    const fieldsListKey = EsignKeys.envelopeFields(envelopeId);
    const existingFieldIds = await kv.get(fieldsListKey);

    // If existingFieldIds is an array of strings (correct format), delete those fields
    if (Array.isArray(existingFieldIds)) {
      for (const item of existingFieldIds) {
        if (typeof item === 'string') {
          await kv.del(EsignKeys.field(item));
        }
      }
    }

    // Prepare new fields
    const newFieldIds: string[] = [];
    const fieldsToReturn: FieldRecord[] = [];

    for (const field of fields) {
      const fieldId = field.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const fieldData = {
        id: fieldId,
        envelope_id: envelopeId,
        type: field.type,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required !== undefined ? field.required : true,
        signer_id: field.signer_id,
        value: field.value || null,
        metadata: field.metadata || {},
        created_at: field.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await kv.set(EsignKeys.field(fieldId), fieldData);
      newFieldIds.push(fieldId);
      fieldsToReturn.push(fieldData);
    }

    // Save list of IDs
    await kv.set(fieldsListKey, newFieldIds);

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'fields_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: { fieldCount: newFieldIds.length },
    });

    return c.json({
      success: true,
      fields: fieldsToReturn,
      count: fieldsToReturn.length,
    });
  } catch (error: unknown) {
    log.error('❌ Update fields error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update fields' },
      status,
    );
  }
});

/**
 * GET /envelopes/:envelopeId/fields
 * Get all fields for an envelope
 */
fieldsRoutes.get('/envelopes/:envelopeId/fields', async (c) => {
  try {
    // Authenticate
    const _ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Return the hydrated fields from the envelope details
    return c.json({
      fields: envelope.fields || [],
      count: (envelope.fields || []).length,
    });
  } catch (error: unknown) {
    log.error('❌ Get fields error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      status,
    );
  }
});

/**
 * PATCH /envelopes/:envelopeId/fields/:fieldId
 * Update a single field (for real-time position updates)
 */
fieldsRoutes.patch('/envelopes/:envelopeId/fields/:fieldId', async (c) => {
  try {
    // Authenticate
    const _ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId');
    const fieldId = c.req.param('fieldId');

    const body = await c.req.json();
    const updates = body;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Retrieve current fields list (IDs or Objects)
    const kvKey = EsignKeys.envelopeFields(envelopeId);
    const fieldsList = (await kv.get(kvKey)) || [];

    // Check if we are dealing with a list of IDs or Objects
    const isIdList =
      Array.isArray(fieldsList) && fieldsList.length > 0 && typeof fieldsList[0] === 'string';

    if (isIdList) {
      // New format: List of IDs
      // Check if ID is in list
      if (!fieldsList.includes(fieldId)) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Get the individual field object
      const fieldKey = EsignKeys.field(fieldId);
      const field = await kv.get(fieldKey);

      if (!field) {
        return c.json({ error: 'Field data not found' }, 404);
      }

      // Update the field object
      const updatedField = {
        ...field,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Save updated object
      await kv.set(fieldKey, updatedField);

      return c.json({
        success: true,
        field: updatedField,
      });
    } else {
      // Legacy format: List of Objects
      const fieldIndex = fieldsList.findIndex((f: FieldRecord) => f.id === fieldId);

      if (fieldIndex === -1) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Update the field
      fieldsList[fieldIndex] = {
        ...fieldsList[fieldIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Save back to KV store
      await kv.set(kvKey, fieldsList);

      return c.json({
        success: true,
        field: fieldsList[fieldIndex],
      });
    }
  } catch (error: unknown) {
    log.error('❌ Update field error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update field' },
      status,
    );
  }
});

/**
 * DELETE /envelopes/:envelopeId/fields/:fieldId
 * Delete a single field
 */
fieldsRoutes.delete('/envelopes/:envelopeId/fields/:fieldId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId');
    const fieldId = c.req.param('fieldId');

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Retrieve current fields list
    const kvKey = EsignKeys.envelopeFields(envelopeId);
    const fieldsList = (await kv.get(kvKey)) || [];

    // Check format
    const isIdList =
      Array.isArray(fieldsList) && fieldsList.some((item: unknown) => typeof item === 'string');

    if (isIdList) {
      // Filter out the deleted ID
      const updatedIds = fieldsList.filter(
        (id: unknown) => id !== fieldId && typeof id === 'string',
      );

      if (fieldsList.length === updatedIds.length) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Update list
      await kv.set(kvKey, updatedIds);

      // Delete individual object
      await kv.del(EsignKeys.field(fieldId));
    } else {
      // Legacy: Filter objects
      const updatedFields = fieldsList.filter((f: FieldRecord) => f.id !== fieldId);

      if (fieldsList.length === updatedFields.length) {
        return c.json({ error: 'Field not found' }, 404);
      }

      // Save back to KV store
      await kv.set(kvKey, updatedFields);
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'field_deleted',
      ip,
      userAgent,
      email: user.email,
      metadata: { fieldId },
    });

    return c.json({
      success: true,
      deletedFieldId: fieldId,
    });
  } catch (error: unknown) {
    log.error('❌ Delete field error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to delete field' },
      status,
    );
  }
});

export default fieldsRoutes;
