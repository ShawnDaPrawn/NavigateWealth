/**
 * External form template library (Phase 2) — upload, map fields, fill PDFs.
 */

import { Hono } from 'npm:hono';
import { PDFDocument } from 'npm:pdf-lib';
import * as kv from './kv_store.tsx';
import { authenticateUser, isFnaUnauthorized } from './fna-auth.ts';
import { FnaIntakeError } from './fna-intake-errors.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { FormTemplateField, FormTemplateRecord } from '../../../shared/form-prefill/types.ts';
import { autoMapTemplateFields } from '../../../shared/form-prefill/template-field-mapping.ts';
import { resolveCanonicalValueForClient, resolveTemplatePrefill } from './form-prefill-resolver.ts';
import { assertPrefillClientAccess, requirePrefillUser } from './form-prefill-auth.ts';
import {
  assertPrefillResolveRateLimit,
  assertTemplateUploadRateLimit,
} from './form-prefill-rate-limit.ts';
import {
  attachFilledPdfToClientDocuments,
  loadTemplatePdfBytes,
  storeTemplatePdfBytes,
} from './form-template-document.ts';

const routes = new Hono();
const log = createModuleLogger('form-template-routes');

const TEMPLATE_PREFIX = 'form_template:';

function templateKey(id: string): string {
  return `${TEMPLATE_PREFIX}${id}`;
}

function templateListKey(): string {
  return `${TEMPLATE_PREFIX}list`;
}

function handleRouteError(
  c: { json: (body: unknown, status?: number) => Response },
  error: unknown,
) {
  if (isFnaUnauthorized(error)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  if (error instanceof FnaIntakeError) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: error.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  log.error('Form template route error', error);
  return c.json(
    { success: false, error: error instanceof Error ? error.message : 'Request failed' },
    500,
  );
}

async function extractPdfFields(base64Content: string): Promise<FormTemplateField[]> {
  try {
    const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fields = form.getFields();

    const extractedFields = fields.map((field, index) => ({
      id: `field_${index}`,
      name: field.getName(),
      label: field.getName().replace(/[_\-.]+/g, ' '),
      type: 'unknown' as const,
    }));

    return autoMapTemplateFields(extractedFields).fields;
  } catch (error) {
    log.warn('PDF field extraction failed', { error: String(error) });
    return [];
  }
}

routes.get('/', async (c) => {
  try {
    requirePrefillUser(await authenticateUser(c.req.header('Authorization')));
    const list = (await kv.get(templateListKey())) as string[] | null;
    const ids = list ?? [];
    const templates = await Promise.all(ids.map(async (id) => kv.get(templateKey(id))));
    return c.json({ success: true, data: templates.filter(Boolean) });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.post('/', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);
    await assertTemplateUploadRateLimit(user.id);

    const body = await c.req.json();
    const { name, description, fileName, mimeType, base64Content } = body ?? {};

    if (!name || !fileName || !base64Content) {
      return c.json(
        { success: false, error: 'name, fileName, and base64Content are required' },
        400,
      );
    }

    const id = crypto.randomUUID();
    const fields =
      mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
        ? await extractPdfFields(base64Content)
        : [];

    const pdfBytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    const storagePath = await storeTemplatePdfBytes(id, fileName, pdfBytes);

    const record: FormTemplateRecord = {
      id,
      name,
      description,
      fileName,
      mimeType: mimeType || 'application/pdf',
      storagePath,
      status: fields.length > 0 && fields.every((field) => field.canonicalKey) ? 'ready' : 'draft',
      fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(templateKey(id), record);
    const list = ((await kv.get(templateListKey())) as string[] | null) ?? [];
    if (!list.includes(id)) {
      list.push(id);
      await kv.set(templateListKey(), list);
    }

    return c.json({ success: true, data: record });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.put('/:id/mappings', async (c) => {
  try {
    requirePrefillUser(await authenticateUser(c.req.header('Authorization')));
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const { fields, status } = body ?? {};

    const existing = (await kv.get(templateKey(id))) as FormTemplateRecord | null;
    if (!existing) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const updated: FormTemplateRecord = {
      ...existing,
      fields: fields ?? existing.fields,
      status:
        status ??
        (fields
          ? fields.every((f: FormTemplateField) => f.canonicalKey)
            ? 'ready'
            : 'draft'
          : existing.status),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(templateKey(id), updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

routes.post('/:id/preview', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);
    await assertPrefillResolveRateLimit(user.id);

    const id = c.req.param('id')!;
    const body = await c.req.json();
    const { clientId } = body ?? {};

    if (!clientId) {
      return c.json({ success: false, error: 'clientId is required' }, 400);
    }

    assertPrefillClientAccess(user, clientId);

    const template = (await kv.get(templateKey(id))) as FormTemplateRecord | null;
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const preview = await resolveTemplatePrefill(clientId, id, template.fields);
    return c.json({ success: true, data: preview });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

function setPdfFieldValue(
  form: ReturnType<typeof PDFDocument.prototype.getForm>,
  fieldName: string,
  rawValue: unknown,
): boolean {
  const value = rawValue ?? '';
  const truthy =
    value === true ||
    value === 1 ||
    String(value).toLowerCase() === 'true' ||
    String(value).toLowerCase() === 'yes';

  try {
    const textField = form.getTextField(fieldName);
    textField.setText(String(value));
    return true;
  } catch {
    // not a text field
  }

  try {
    const checkBox = form.getCheckBox(fieldName);
    if (truthy) checkBox.check();
    else checkBox.uncheck();
    return true;
  } catch {
    // not a checkbox
  }

  try {
    const radioGroup = form.getRadioGroup(fieldName);
    radioGroup.select(String(value));
    return true;
  } catch {
    // not a radio group
  }

  try {
    const dropdown = form.getDropdown(fieldName);
    dropdown.select(String(value));
    return true;
  } catch {
    return false;
  }
}

routes.post('/:id/fill', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    requirePrefillUser(user);
    await assertPrefillResolveRateLimit(user.id);

    const id = c.req.param('id')!;
    const body = await c.req.json();
    const { clientId, attachToDocuments } = body ?? {};

    if (!clientId) {
      return c.json({ success: false, error: 'clientId is required' }, 400);
    }

    assertPrefillClientAccess(user, clientId);

    const template = (await kv.get(templateKey(id))) as FormTemplateRecord | null;

    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    let bytes: Uint8Array | null = await loadTemplatePdfBytes(id, template.storagePath);
    const allowKvFallback = Deno.env.get('FORM_TEMPLATE_ALLOW_KV_FALLBACK') !== 'false';
    if (!bytes && allowKvFallback) {
      const fileRecord = (await kv.get(`${TEMPLATE_PREFIX}${id}:file`)) as {
        base64Content?: string;
      } | null;
      if (fileRecord?.base64Content) {
        bytes = Uint8Array.from(atob(fileRecord.base64Content), (ch) => ch.charCodeAt(0));
      }
    }
    if (!bytes) {
      return c.json({ success: false, error: 'Template file not found' }, 404);
    }

    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();

    const filledFields: string[] = [];
    const unresolvedFields: string[] = [];

    for (const field of template.fields) {
      if (!field.canonicalKey) {
        unresolvedFields.push(field.name);
        continue;
      }

      const resolved = await resolveCanonicalValueForClient(clientId, field.canonicalKey);
      const value = resolved?.value ?? '';

      try {
        if (setPdfFieldValue(form, field.name, value)) {
          filledFields.push(field.name);
        } else {
          unresolvedFields.push(field.name);
        }
      } catch {
        unresolvedFields.push(field.name);
      }
    }

    const filledBytes = await pdf.save();
    let binary = '';
    for (let i = 0; i < filledBytes.length; i++) {
      binary += String.fromCharCode(filledBytes[i]);
    }
    const filledBase64 = btoa(binary);
    const outputFileName = `filled-${template.fileName}`;

    let attachedDocument: { documentId: string; filePath: string } | undefined;
    if (attachToDocuments) {
      attachedDocument = await attachFilledPdfToClientDocuments({
        clientId,
        uploadedBy: user.id,
        fileName: outputFileName,
        pdfBytes: filledBytes,
        templateName: template.name,
      });
    }

    return c.json({
      success: true,
      data: {
        filledBase64,
        filledFields,
        unresolvedFields,
        fileName: outputFileName,
        attachedDocument,
      },
    });
  } catch (error) {
    return handleRouteError(c, error);
  }
});

export default routes;
