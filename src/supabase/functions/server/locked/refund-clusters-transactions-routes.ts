/**
 * Refund Clusters — Transaction routes
 *
 * Per-entity VAT transaction ledger + tax-invoice attachments. Split out of
 * refund-clusters-routes.ts so neither route file is large enough to trip the
 * edge-function deploy bundler. Mounted by refund-clusters-routes.ts, so the
 * public paths are unchanged. Super-admin only and fully audited.
 */

import { Hono } from 'npm:hono';
import { requireSuperAdmin } from '../auth-mw.ts';
import { asyncHandler } from '../error.middleware.ts';
import { createModuleLogger } from '../stderr-logger.ts';
import { RefundClustersService, type TransactionInput } from './refund-clusters-service.ts';
import {
  BUCKET,
  audit,
  errStatus,
  getSupabase,
  validateUpload,
  ensureBucket,
} from './refund-clusters-shared.ts';

const app = new Hono();
const log = createModuleLogger('refund-clusters-transactions-routes');

// Every route in this module is super-admin only.
app.use('*', requireSuperAdmin);

app.get(
  '/:clusterId/entities/:entityId/transactions',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const transactions = await RefundClustersService.listTransactions(entityId);
    return c.json({ success: true, transactions });
  }),
);

app.post(
  '/:clusterId/entities/:entityId/transactions',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const body = (await c.req.json()) as TransactionInput;
    try {
      const transaction = await RefundClustersService.createTransaction(
        clusterId,
        entityId,
        body,
        c.get('userId') as string,
      );
      await audit(c, 'refund_transaction_created', `Transaction added (${transaction.direction})`, {
        entityType: 'refund_entity',
        entityId,
        metadata: {
          clusterId,
          transactionId: transaction.id,
          direction: transaction.direction,
          amount: transaction.amount,
          vatAmount: transaction.vatAmount,
        },
      });
      return c.json({ success: true, transaction }, 201);
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.put(
  '/:clusterId/entities/:entityId/transactions/:txnId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';
    const body = (await c.req.json()) as TransactionInput;
    try {
      const transaction = await RefundClustersService.updateTransaction(entityId, txnId, body);
      await audit(c, 'refund_transaction_updated', 'Transaction updated', {
        entityType: 'refund_entity',
        entityId,
        metadata: { clusterId, transactionId: txnId },
      });
      return c.json({ success: true, transaction });
    } catch (error) {
      return c.json({ error: (error as Error).message }, errStatus(error) as 400 | 404 | 500);
    }
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/transactions/:txnId',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const existing = await RefundClustersService.getTransaction(entityId, txnId);
    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    // Remove the invoice file first (if any) so metadata is only dropped once storage confirms.
    if (existing.invoice) {
      const { error } = await getSupabase()
        .storage.from(BUCKET)
        .remove([existing.invoice.storagePath]);
      if (error) {
        log.error('Failed to remove transaction invoice from storage', error);
        return c.json({ error: 'Failed to delete the stored invoice — please try again' }, 500);
      }
    }
    await RefundClustersService.deleteTransaction(entityId, txnId);
    await audit(c, 'refund_transaction_deleted', 'Transaction deleted', {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, transactionId: txnId },
    });
    return c.json({ success: true });
  }),
);

app.post(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice',
  asyncHandler(async (c) => {
    const clusterId = c.req.param('clusterId') ?? '';
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const existing = await RefundClustersService.getTransaction(entityId, txnId);
    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    const invalid = validateUpload(file);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const supabase = getSupabase();
    await ensureBucket(supabase);

    // Upload the replacement (always a unique path) and persist its metadata
    // BEFORE removing any prior invoice, so a failed upload never loses the
    // existing file. The old path is cleaned up only after the new one sticks.
    const oldPath = existing.invoice?.storagePath;
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${clusterId}/${entityId}/transactions/${txnId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      log.error('Transaction invoice upload failed', uploadError);
      return c.json({ error: uploadError.message }, 500);
    }

    const transaction = await RefundClustersService.attachTransactionInvoice(entityId, txnId, {
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: c.get('userId') as string,
    });

    if (oldPath && oldPath !== storagePath) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([oldPath]);
      // Non-fatal: the new invoice is already saved; a leftover old file is an
      // orphan, not data loss. Log it for later cleanup.
      if (removeError) log.error('Failed to remove replaced invoice (orphaned)', removeError);
    }

    await audit(c, 'refund_transaction_invoice_uploaded', 'Transaction invoice uploaded', {
      entityType: 'refund_entity',
      entityId,
      metadata: { clusterId, transactionId: txnId },
    });
    return c.json({ success: true, transaction }, 201);
  }),
);

app.get(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice/url',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const transaction = await RefundClustersService.getTransaction(entityId, txnId);
    if (!transaction?.invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(transaction.invoice.storagePath, 300);
    if (error || !data?.signedUrl) {
      log.error('Failed to create invoice signed URL', error);
      return c.json({ error: 'Failed to create invoice link' }, 500);
    }
    await audit(c, 'refund_transaction_invoice_viewed', 'Transaction invoice viewed', {
      entityType: 'refund_entity',
      entityId,
      metadata: { transactionId: txnId },
    });
    return c.json({ success: true, url: data.signedUrl, fileName: transaction.invoice.fileName });
  }),
);

app.delete(
  '/:clusterId/entities/:entityId/transactions/:txnId/invoice',
  asyncHandler(async (c) => {
    const entityId = c.req.param('entityId') ?? '';
    const txnId = c.req.param('txnId') ?? '';

    const transaction = await RefundClustersService.getTransaction(entityId, txnId);
    if (!transaction?.invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const { error } = await getSupabase()
      .storage.from(BUCKET)
      .remove([transaction.invoice.storagePath]);
    if (error) {
      log.error('Failed to remove transaction invoice from storage', error);
      return c.json({ error: 'Failed to delete the stored invoice — please try again' }, 500);
    }
    const updated = await RefundClustersService.removeTransactionInvoice(entityId, txnId);
    await audit(c, 'refund_transaction_invoice_deleted', 'Transaction invoice deleted', {
      severity: 'warning',
      entityType: 'refund_entity',
      entityId,
      metadata: { transactionId: txnId },
    });
    return c.json({ success: true, transaction: updated });
  }),
);

export default app;
