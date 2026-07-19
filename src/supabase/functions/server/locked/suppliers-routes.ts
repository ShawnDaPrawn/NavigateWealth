/**
 * Suppliers Routes
 *
 * Locked → Suppliers. A global directory of VAT-registered providers /
 * contractors that invoice the refund-cluster entities, each with a versioned
 * AI-extracted invoice template and generated invoices. Lives inside the
 * locked workspace, so every route requires SUPER ADMIN access and every
 * mutation is written to the admin audit trail.
 *
 * Static routes are registered before parameterised routes (§14.2).
 */

import { Hono, type Context } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import { AdminAuditService } from '../admin-audit-service.ts';
import { SuppliersService, type InvoiceInput, type SupplierInput } from './suppliers-service.ts';
import { downloadFileAsBase64, openAiInvoiceTemplateAnalyzer } from './supplier-template-ai.ts';
import { normalizeTemplateSpec } from './supplier-template-spec.ts';

const app = new Hono();
const log = createModuleLogger('suppliers-routes');

const BUCKET = 'make-91ed8379-suppliers';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Every route in this module is super-admin only.
app.use('*', requireSuperAdmin);

function audit(
  c: Context,
  action: string,
  summary: string,
  options: {
    severity?: 'info' | 'warning' | 'critical';
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'security',
    action,
    summary,
    severity: options.severity ?? 'info',
    entityType: options.entityType ?? 'supplier',
    entityId: options.entityId,
    metadata: options.metadata,
  });
}

function errStatus(error: unknown): number {
  const status = (error as { status?: number })?.status;
  return typeof status === 'number' ? status : 500;
}

/** Validates an uploaded file. `imageOnly` restricts to JPEG/PNG (logos). */
function validateUpload(file: File, imageOnly = false): string | null {
  if (file.size > MAX_FILE_BYTES) return 'File exceeds the 10MB limit';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimes = imageOnly ? IMAGE_MIME_TYPES : ALLOWED_MIME_TYPES;
  const exts = imageOnly ? IMAGE_EXTENSIONS : ALLOWED_EXTENSIONS;
  if (!mimes.includes(file.type) || !exts.includes(ext)) {
    return imageOnly
      ? 'Only JPEG and PNG files are allowed'
      : 'Only PDF, JPEG and PNG files are allowed';
  }
  return null;
}

/** Lazily creates the private bucket on first upload. */
async function ensureBucket(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  }
}

/**
 * Uploads a supplier file (logo or example invoice) and returns its metadata.
 * The previous file at `oldPath` is removed only after the new upload sticks.
 */
async function uploadSupplierFile(
  c: Context,
  supplierId: string,
  kind: 'logo' | 'examples',
  imageOnly: boolean,
): Promise<
  | {
      ok: true;
      meta: {
        fileName: string;
        storagePath: string;
        contentType: string;
        sizeBytes: number;
        uploadedAt: string;
      };
    }
  | { ok: false; error: string; status: 400 | 500 }
> {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!file || !(file instanceof File)) {
    return { ok: false, error: 'No file uploaded', status: 400 };
  }
  const invalid = validateUpload(file, imageOnly);
  if (invalid) return { ok: false, error: invalid, status: 400 };

  const supabase = getSupabase();
  await ensureBucket(supabase);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${supplierId}/${kind}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    log.error('Supplier file upload failed', uploadError);
    return { ok: false, error: uploadError.message, status: 500 };
  }
  return {
    ok: true,
    meta: {
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    },
  };
}

async function signedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    log.error('Failed to create signed URL', error);
    return null;
  }
  return data.signedUrl;
}

// ============================================================================
// Static routes
// ============================================================================

app.get(
  '/',
  asyncHandler(async (c) => {
    const suppliers = await SuppliersService.listSuppliers();
    return c.json({ success: true, suppliers });
  }),
);

app.post(
  '/',
  asyncHandler(async (c) => {
    const body = (await c.req.json()) as SupplierInput;
    try {
      const supplier = await SuppliersService.createSupplier(body, c.get('userId') as string);
      await audit(c, 'supplier_created', 'Supplier created', { entityId: supplier.id });
      return c.json({ success: true, supplier }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 500);
    }
  }),
);

/** Flattened refund-cluster entities for the invoice billed-to selector. */
app.get(
  '/billed-to-options',
  asyncHandler(async (c) => {
    const options = await SuppliersService.listBilledToOptions();
    return c.json({ success: true, options });
  }),
);

// ============================================================================
// Supplier CRUD
// ============================================================================

app.get(
  '/:supplierId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const supplier = await SuppliersService.getSupplier(supplierId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    const [templates, sequence] = await Promise.all([
      SuppliersService.listTemplates(supplierId),
      SuppliersService.getSequence(supplierId),
    ]);
    return c.json({ success: true, supplier, templates, sequence });
  }),
);

app.put(
  '/:supplierId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const body = (await c.req.json()) as SupplierInput;
    try {
      const supplier = await SuppliersService.updateSupplier(supplierId, body);
      const action =
        body?.archived === true
          ? 'supplier_archived'
          : body?.archived === false
            ? 'supplier_unarchived'
            : 'supplier_updated';
      await audit(c, action, 'Supplier updated', { entityId: supplierId });
      return c.json({ success: true, supplier });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.delete(
  '/:supplierId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    try {
      // Remove stored files BEFORE the metadata: if storage fails we keep the
      // records (and their paths) so the deletion can be retried.
      const paths = await SuppliersService.collectStoragePaths(supplierId);
      if (paths.length > 0) {
        const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
        if (error) {
          log.error('Failed to remove supplier files from storage', error);
          return c.json({ error: 'Failed to remove stored files — supplier not deleted' }, 500);
        }
      }
      const { invoicesDeleted } = await SuppliersService.deleteSupplier(supplierId);
      await audit(c, 'supplier_deleted', 'Supplier deleted', {
        severity: 'warning',
        entityId: supplierId,
        metadata: { invoicesDeleted },
      });
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

// ============================================================================
// Logo + example invoice files
// ============================================================================

app.post(
  '/:supplierId/logo',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const existing = await SuppliersService.getSupplier(supplierId);
    if (!existing) return c.json({ error: 'Supplier not found' }, 404);

    const result = await uploadSupplierFile(c, supplierId, 'logo', true);
    if (!result.ok) return c.json({ error: result.error }, result.status);

    const oldPath = existing.logo?.storagePath;
    const supplier = await SuppliersService.setLogo(supplierId, result.meta);
    if (oldPath && oldPath !== result.meta.storagePath) {
      const { error } = await getSupabase().storage.from(BUCKET).remove([oldPath]);
      // Non-fatal: the new logo is saved; a leftover old file is an orphan.
      if (error) log.error('Failed to remove replaced logo (orphaned)', error);
    }
    await audit(c, 'supplier_logo_uploaded', 'Supplier logo uploaded', { entityId: supplierId });
    return c.json({ success: true, supplier }, 201);
  }),
);

app.get(
  '/:supplierId/logo/url',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const supplier = await SuppliersService.getSupplier(supplierId);
    if (!supplier?.logo) return c.json({ error: 'Logo not found' }, 404);
    const url = await signedUrl(supplier.logo.storagePath);
    if (!url) return c.json({ error: 'Failed to create logo link' }, 500);
    return c.json({ success: true, url, fileName: supplier.logo.fileName });
  }),
);

app.post(
  '/:supplierId/example-invoice',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const existing = await SuppliersService.getSupplier(supplierId);
    if (!existing) return c.json({ error: 'Supplier not found' }, 404);

    const result = await uploadSupplierFile(c, supplierId, 'examples', false);
    if (!result.ok) return c.json({ error: result.error }, result.status);

    const oldPath = existing.exampleInvoice?.storagePath;
    const supplier = await SuppliersService.setExampleInvoice(supplierId, result.meta);
    if (oldPath && oldPath !== result.meta.storagePath) {
      const { error } = await getSupabase().storage.from(BUCKET).remove([oldPath]);
      if (error) log.error('Failed to remove replaced example invoice (orphaned)', error);
    }
    await audit(c, 'supplier_example_invoice_uploaded', 'Supplier example invoice uploaded', {
      entityId: supplierId,
    });
    return c.json({ success: true, supplier }, 201);
  }),
);

app.get(
  '/:supplierId/example-invoice/url',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const supplier = await SuppliersService.getSupplier(supplierId);
    if (!supplier?.exampleInvoice) return c.json({ error: 'Example invoice not found' }, 404);
    const url = await signedUrl(supplier.exampleInvoice.storagePath);
    if (!url) return c.json({ error: 'Failed to create example invoice link' }, 500);
    return c.json({
      success: true,
      url,
      fileName: supplier.exampleInvoice.fileName,
      contentType: supplier.exampleInvoice.contentType,
    });
  }),
);

// ============================================================================
// Templates
// ============================================================================

/**
 * POST /:supplierId/template/analyze
 *
 * Sends the stored example invoice (base64) to the AI analyzer and persists
 * the extracted spec as a NEW template version. The example invoice content
 * leaves the platform for the configured AI provider (OpenAI) — noted in the
 * locked module README.
 */
app.post(
  '/:supplierId/template/analyze',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const supplier = await SuppliersService.getSupplier(supplierId);
    if (!supplier) return c.json({ error: 'Supplier not found' }, 404);
    if (!supplier.exampleInvoice) {
      return c.json({ error: 'Upload an example invoice before analyzing' }, 400);
    }

    try {
      const fileBase64 = await downloadFileAsBase64(BUCKET, supplier.exampleInvoice.storagePath);
      const analysis = await openAiInvoiceTemplateAnalyzer.analyze({
        fileBase64,
        fileName: supplier.exampleInvoice.fileName,
        contentType: supplier.exampleInvoice.contentType,
        supplier,
      });
      const template = await SuppliersService.createTemplate(
        supplierId,
        'ai',
        analysis.spec,
        c.get('userId') as string,
        {
          model: analysis.model,
          confidence: analysis.confidence,
          notes: analysis.notes,
          analyzedAt: new Date().toISOString(),
          exampleStoragePath: supplier.exampleInvoice.storagePath,
        },
      );
      await audit(c, 'supplier_template_analyzed', 'Supplier invoice template analyzed', {
        entityId: supplierId,
        metadata: {
          templateId: template.id,
          version: template.version,
          model: analysis.model,
          confidence: analysis.confidence,
        },
      });
      return c.json({ success: true, template }, 201);
    } catch (error) {
      log.error('Template analysis failed', error);
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 500 | 502);
    }
  }),
);

app.get(
  '/:supplierId/templates',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const templates = await SuppliersService.listTemplates(supplierId);
    return c.json({ success: true, templates });
  }),
);

/** Manual template created from scratch (no AI analysis / no base version). */
app.post(
  '/:supplierId/templates',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const body = await c.req.json();
    try {
      const template = await SuppliersService.createTemplate(
        supplierId,
        'manual',
        normalizeTemplateSpec(body?.spec),
        c.get('userId') as string,
      );
      await audit(c, 'supplier_template_created', 'Supplier invoice template created manually', {
        entityId: supplierId,
        metadata: { templateId: template.id, version: template.version },
      });
      return c.json({ success: true, template }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

/** Manual spec edit — persists as a NEW version with source 'manual'. */
app.put(
  '/:supplierId/templates/:templateId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const templateId = c.req.param('templateId') ?? '';
    const body = await c.req.json();
    try {
      const base = await SuppliersService.getTemplate(supplierId, templateId);
      if (!base) return c.json({ error: 'Template not found' }, 404);
      const template = await SuppliersService.createTemplate(
        supplierId,
        'manual',
        normalizeTemplateSpec(body?.spec),
        c.get('userId') as string,
      );
      await audit(c, 'supplier_template_edited', 'Supplier invoice template edited', {
        entityId: supplierId,
        metadata: {
          baseTemplateId: templateId,
          templateId: template.id,
          version: template.version,
        },
      });
      return c.json({ success: true, template }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.post(
  '/:supplierId/templates/:templateId/activate',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const templateId = c.req.param('templateId') ?? '';
    try {
      const supplier = await SuppliersService.activateTemplate(supplierId, templateId);
      await audit(c, 'supplier_template_activated', 'Supplier invoice template activated', {
        entityId: supplierId,
        metadata: { templateId },
      });
      return c.json({ success: true, supplier });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

// ============================================================================
// Invoice sequence
// ============================================================================

app.put(
  '/:supplierId/sequence',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const body = await c.req.json();
    try {
      const sequence = await SuppliersService.updateSequence(supplierId, {
        prefix: body?.prefix,
        nextNumber: body?.nextNumber,
        padding: body?.padding,
      });
      await audit(c, 'supplier_sequence_updated', 'Supplier invoice sequence updated', {
        entityId: supplierId,
        metadata: { ...sequence },
      });
      return c.json({ success: true, sequence });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

// ============================================================================
// Invoices
// ============================================================================

app.get(
  '/:supplierId/invoices',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const invoices = await SuppliersService.listInvoices(supplierId);
    return c.json({ success: true, invoices });
  }),
);

app.post(
  '/:supplierId/invoices',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const body = await c.req.json();
    try {
      const invoice = await SuppliersService.createInvoice(
        supplierId,
        body as InvoiceInput,
        c.get('userId') as string,
        body?.recordInLedger !== false,
      );
      await audit(c, 'supplier_invoice_created', `Invoice ${invoice.invoiceNumber} created`, {
        entityId: supplierId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.totals.total,
          vatAmount: invoice.totals.vatAmount,
          ledgerTransactionId: invoice.ledgerTransactionId,
        },
      });
      return c.json({ success: true, invoice }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 409 | 500);
    }
  }),
);

app.put(
  '/:supplierId/invoices/:invoiceId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const invoiceId = c.req.param('invoiceId') ?? '';
    const body = (await c.req.json()) as InvoiceInput;
    try {
      const invoice = await SuppliersService.updateInvoice(supplierId, invoiceId, body);
      await audit(c, 'supplier_invoice_updated', `Invoice ${invoice.invoiceNumber} updated`, {
        entityId: supplierId,
        metadata: { invoiceId, total: invoice.totals.total },
      });
      return c.json({ success: true, invoice });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 409 | 500);
    }
  }),
);

app.delete(
  '/:supplierId/invoices/:invoiceId',
  asyncHandler(async (c) => {
    const supplierId = c.req.param('supplierId') ?? '';
    const invoiceId = c.req.param('invoiceId') ?? '';
    try {
      const deleted = await SuppliersService.deleteInvoice(supplierId, invoiceId);
      await audit(c, 'supplier_invoice_deleted', `Invoice ${deleted.invoiceNumber} deleted`, {
        severity: 'warning',
        entityId: supplierId,
        metadata: { invoiceId, ledgerTransactionId: deleted.ledgerTransactionId },
      });
      // The linked ledger transaction (if any) is left in place — it remains a
      // valid ledger record; the client surfaces it for separate removal.
      return c.json({ success: true, ledgerTransactionId: deleted.ledgerTransactionId ?? null });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 404 | 500);
    }
  }),
);

export default app;
