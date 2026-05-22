/**
 * External form template library (Phase 2) — upload, map fields, fill PDFs.
 */

import { Hono } from 'npm:hono';
import { PDFDocument } from 'npm:pdf-lib';
import * as kv from './kv_store.tsx';
import { authenticateUser } from './fna-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { FormTemplateField, FormTemplateRecord } from '../../../shared/form-prefill/types.ts';
import { resolveCanonicalValueForClient } from './form-prefill-resolver.ts';

const routes = new Hono();
const log = createModuleLogger('form-template-routes');

const TEMPLATE_PREFIX = 'form_template:';

function templateKey(id: string): string {
  return `${TEMPLATE_PREFIX}${id}`;
}

function templateListKey(): string {
  return `${TEMPLATE_PREFIX}list`;
}

async function extractPdfFields(base64Content: string): Promise<FormTemplateField[]> {
  try {
    const bytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fields = form.getFields();

    return fields.map((field, index) => ({
      id: `field_${index}`,
      name: field.getName(),
      label: field.getName().replace(/_/g, ' '),
      type: 'unknown' as const,
    }));
  } catch (error) {
    log.warn('PDF field extraction failed', error);
    return [];
  }
}

routes.get('/', async (c) => {
  await authenticateUser(c.req.header('Authorization'));
  const list = (await kv.get(templateListKey())) as string[] | null;
  const ids = list ?? [];
  const templates = await Promise.all(
    ids.map(async (id) => kv.get(templateKey(id))),
  );
  return c.json({ success: true, data: templates.filter(Boolean) });
});

routes.post('/', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const { name, description, fileName, mimeType, base64Content } = body ?? {};

    if (!name || !fileName || !base64Content) {
      return c.json({ success: false, error: 'name, fileName, and base64Content are required' }, 400);
    }

    const id = crypto.randomUUID();
    const fields =
      mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
        ? await extractPdfFields(base64Content)
        : [];

    const record: FormTemplateRecord = {
      id,
      name,
      description,
      fileName,
      mimeType: mimeType || 'application/pdf',
      storagePath: `${TEMPLATE_PREFIX}${id}:file`,
      status: fields.length > 0 ? 'draft' : 'draft',
      fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(templateKey(id), record);
    await kv.set(`${TEMPLATE_PREFIX}${id}:file`, { base64Content });
    const list = ((await kv.get(templateListKey())) as string[] | null) ?? [];
    if (!list.includes(id)) {
      list.push(id);
      await kv.set(templateListKey(), list);
    }

    return c.json({ success: true, data: record });
  } catch (error) {
    log.error('Template create failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Template create failed' },
      500,
    );
  }
});

routes.put('/:id/mappings', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const id = c.req.param('id');
    const body = await c.req.json();
    const { fields, status } = body ?? {};

    const existing = (await kv.get(templateKey(id))) as FormTemplateRecord | null;
    if (!existing) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const updated: FormTemplateRecord = {
      ...existing,
      fields: fields ?? existing.fields,
      status: status ?? (fields?.every((f: FormTemplateField) => f.canonicalKey) ? 'ready' : existing.status),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(templateKey(id), updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Template mapping update failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Mapping update failed' },
      500,
    );
  }
});

routes.post('/:id/fill', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const id = c.req.param('id');
    const body = await c.req.json();
    const { clientId } = body ?? {};

    if (!clientId) {
      return c.json({ success: false, error: 'clientId is required' }, 400);
    }

    const template = (await kv.get(templateKey(id))) as FormTemplateRecord | null;
    const fileRecord = (await kv.get(`${TEMPLATE_PREFIX}${id}:file`)) as { base64Content?: string } | null;

    if (!template || !fileRecord?.base64Content) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const bytes = Uint8Array.from(atob(fileRecord.base64Content), (ch) => ch.charCodeAt(0));
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
        const pdfField = form.getField(field.name);
        if ('setText' in pdfField && typeof pdfField.setText === 'function') {
          pdfField.setText(String(value));
          filledFields.push(field.name);
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

    return c.json({
      success: true,
      data: {
        filledBase64,
        filledFields,
        unresolvedFields,
        fileName: `filled-${template.fileName}`,
      },
    });
  } catch (error) {
    log.error('Template fill failed', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Template fill failed' },
      500,
    );
  }
});

export default routes;
