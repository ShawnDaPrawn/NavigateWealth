/**
 * Suppliers Service
 *
 * Storage layer for the Locked → Suppliers feature: a global directory of the
 * VAT-registered providers/contractors that issue invoices to the refund
 * cluster entities (sources of input-tax deductions). Each supplier carries a
 * profile (with logo), a versioned invoice template extracted from an example
 * invoice, and the functional invoices generated in that template.
 *
 * Security model:
 *   - All access is super-admin only (enforced at the route layer).
 *   - Every mutation is recorded via AdminAuditService at the route layer.
 *
 * KV layout:
 *   suppliers:supplier:{supplierId}               → SupplierRecord
 *   suppliers:template:{supplierId}:{templateId}  → SupplierTemplateRecord
 *   suppliers:invoice:{supplierId}:{invoiceId}    → SupplierInvoiceRecord
 *   suppliers:seq:{supplierId}                    → SupplierInvoiceSequence
 *
 * Invoice numbering uses a read-increment-write on the sequence row. KV has no
 * atomic increment; the single-operator usage of the locked module makes a
 * race acceptable, and createInvoice re-checks the number against existing
 * invoices before persisting so a collision surfaces as a 409 rather than a
 * silent duplicate.
 *
 * @module server/suppliers-service
 */

import * as kv from '../kv_store.tsx';
import { createModuleLogger } from '../stderr-logger.ts';
import { RefundClustersService } from './refund-clusters-service.ts';
import type { InvoiceTemplateSpec } from './supplier-template-spec.ts';
import { normalizeTemplateSpec } from './supplier-template-spec.ts';

const log = createModuleLogger('suppliers');

// ============================================================================
// Types
// ============================================================================

export type VatTreatment = 'standard' | 'zero_rated' | 'exempt';

export interface SupplierFileMeta {
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  /** Industry sector (dropdown value; free string for forward-compat). */
  industry: string;
  /** Seeds the VAT treatment on new invoice line items. */
  defaultVatTreatment: VatTreatment;
  registeredAddress: string;
  billingInfo: string;
  contactNumber: string;
  logo?: SupplierFileMeta;
  exampleInvoice?: SupplierFileMeta;
  /** Template used for new invoices. Unset until a template is activated. */
  activeTemplateId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SupplierInput {
  name?: string;
  registrationNumber?: string;
  vatNumber?: string;
  industry?: string;
  defaultVatTreatment?: VatTreatment;
  registeredAddress?: string;
  billingInfo?: string;
  contactNumber?: string;
  archived?: boolean;
}

export type TemplateSource = 'ai' | 'manual';

export interface TemplateAiMeta {
  model: string;
  /** Model's own 0-1 estimate of how faithfully the spec matches the example. */
  confidence: number;
  /** Free-text: layout aspects the constrained spec could not capture. */
  notes: string;
  analyzedAt: string;
  exampleStoragePath: string;
}

export interface SupplierTemplateRecord {
  id: string;
  supplierId: string;
  /** Monotonic per supplier; re-analysis and manual edits create new versions. */
  version: number;
  source: TemplateSource;
  spec: InvoiceTemplateSpec;
  aiMeta?: TemplateAiMeta;
  createdAt: string;
  createdBy: string;
}

export type InvoiceBilledTo =
  | {
      kind: 'cluster_entity';
      clusterId: string;
      entityId: string;
      /** Denormalized at creation so deleting the entity never breaks the invoice. */
      snapshot: { name: string; vatNumber?: string; address?: string };
    }
  | { kind: 'freeform'; name: string; vatNumber?: string; address?: string };

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  /** VAT-exclusive unit price. */
  unitPrice: number;
  vatTreatment: VatTreatment;
}

export interface InvoiceTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export type InvoiceStatus = 'draft' | 'issued';

export interface SupplierInvoiceRecord {
  id: string;
  supplierId: string;
  /** Pinned at creation so old invoices keep rendering identically. */
  templateId: string;
  invoiceNumber: string;
  /** ISO yyyy-mm-dd. */
  invoiceDate: string;
  dueDate: string;
  billedTo: InvoiceBilledTo;
  lineItems: InvoiceLineItem[];
  /** Computed server-side; stored for audit. */
  totals: InvoiceTotals;
  notes: string;
  status: InvoiceStatus;
  /** Set when the invoice was auto-recorded as an input-VAT ledger expense. */
  ledgerTransactionId?: string;
  /** Client-generated submission id; makes creation idempotent across retries. */
  clientRequestId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface InvoiceInput {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  clientRequestId?: string;
  billedTo?: unknown;
  lineItems?: unknown;
  notes?: string;
  status?: InvoiceStatus;
}

export interface SupplierInvoiceSequence {
  prefix: string;
  nextNumber: number;
  padding: number;
}

// ============================================================================
// KV keys
// ============================================================================

const SUPPLIER_PREFIX = 'suppliers:supplier:';
const TEMPLATE_PREFIX = 'suppliers:template:';
const INVOICE_PREFIX = 'suppliers:invoice:';
const SEQ_PREFIX = 'suppliers:seq:';

const supplierKey = (supplierId: string) => `${SUPPLIER_PREFIX}${supplierId}`;
const templateKey = (supplierId: string, templateId: string) =>
  `${TEMPLATE_PREFIX}${supplierId}:${templateId}`;
const invoiceKey = (supplierId: string, invoiceId: string) =>
  `${INVOICE_PREFIX}${supplierId}:${invoiceId}`;
const seqKey = (supplierId: string) => `${SEQ_PREFIX}${supplierId}`;

const newId = () => crypto.randomUUID();

// ============================================================================
// Helpers
// ============================================================================

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const VAT_RATE = 0.15;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Strictly parse a VAT treatment — an unrecognized value is rejected. */
function parseTreatment(value: unknown): VatTreatment {
  if (value === 'standard' || value === 'zero_rated' || value === 'exempt') return value;
  throw Object.assign(new Error('Invalid VAT treatment'), { status: 400 });
}

function toPositiveNumber(value: unknown, label: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw Object.assign(new Error(`${label} must be a non-negative number`), { status: 400 });
  }
  return n;
}

/** ISO yyyy-mm-dd or today when blank; anything else is rejected. */
function parseIsoDate(value: unknown, label: string): string {
  const s = str(value);
  if (!s) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw Object.assign(new Error(`${label} must be an ISO date (yyyy-mm-dd)`), { status: 400 });
  }
  return s;
}

function parseLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw Object.assign(new Error('At least one line item is required'), { status: 400 });
  }
  return value.map((raw, index) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const description = str(row.description);
    if (!description) {
      throw Object.assign(new Error(`Line ${index + 1}: description is required`), { status: 400 });
    }
    const quantity = toPositiveNumber(row.quantity ?? 1, `Line ${index + 1}: quantity`);
    if (quantity === 0) {
      throw Object.assign(new Error(`Line ${index + 1}: quantity must be greater than zero`), {
        status: 400,
      });
    }
    return {
      description,
      quantity,
      unitPrice: round2(toPositiveNumber(row.unitPrice ?? 0, `Line ${index + 1}: unit price`)),
      vatTreatment: parseTreatment(row.vatTreatment ?? 'standard'),
    };
  });
}

/** Line-item math over VAT-exclusive unit prices (mirrors frontend invoiceMath.ts). */
export function computeInvoiceTotals(lineItems: InvoiceLineItem[]): InvoiceTotals {
  let subtotal = 0;
  let vatAmount = 0;
  for (const line of lineItems) {
    const net = round2(line.quantity * line.unitPrice);
    subtotal += net;
    if (line.vatTreatment === 'standard') vatAmount += round2(net * VAT_RATE);
  }
  subtotal = round2(subtotal);
  vatAmount = round2(vatAmount);
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
}

/** The treatment covering the largest share of the subtotal (for the ledger row). */
export function dominantTreatment(lineItems: InvoiceLineItem[]): VatTreatment {
  const totals = new Map<VatTreatment, number>();
  for (const line of lineItems) {
    const net = round2(line.quantity * line.unitPrice);
    totals.set(line.vatTreatment, (totals.get(line.vatTreatment) ?? 0) + net);
  }
  let best: VatTreatment = 'standard';
  let bestNet = -1;
  for (const [treatment, net] of totals) {
    if (net > bestNet) {
      best = treatment;
      bestNet = net;
    }
  }
  return best;
}

async function parseBilledTo(value: unknown): Promise<InvoiceBilledTo> {
  const raw = (value ?? {}) as Record<string, unknown>;
  if (raw.kind === 'cluster_entity') {
    const clusterId = str(raw.clusterId);
    const entityId = str(raw.entityId);
    if (!clusterId || !entityId) {
      throw Object.assign(new Error('billedTo requires clusterId and entityId'), { status: 400 });
    }
    const entity = await RefundClustersService.getEntityRaw(clusterId, entityId);
    if (!entity) {
      throw Object.assign(new Error('Billed-to entity not found'), { status: 404 });
    }
    return {
      kind: 'cluster_entity',
      clusterId,
      entityId,
      snapshot: {
        name: entityDisplayName(entity),
        address: entityAddress(entity) || undefined,
      },
    };
  }
  if (raw.kind === 'freeform') {
    const name = str(raw.name);
    if (!name) {
      throw Object.assign(new Error('billedTo name is required'), { status: 400 });
    }
    return {
      kind: 'freeform',
      name,
      vatNumber: str(raw.vatNumber) || undefined,
      address: str(raw.address) || undefined,
    };
  }
  throw Object.assign(new Error("billedTo.kind must be 'cluster_entity' or 'freeform'"), {
    status: 400,
  });
}

/** Display name for a refund entity (company vs sole proprietor). */
// deno-lint-ignore no-explicit-any
function entityDisplayName(entity: any): string {
  if (entity.entityType === 'company') {
    return (
      str(entity.businessDetails?.tradingName) ||
      str(entity.businessDetails?.companyName) ||
      'Company'
    );
  }
  const first = str(entity.personalDetails?.name);
  const last = str(entity.personalDetails?.surname);
  return [first, last].filter(Boolean).join(' ') || 'Sole proprietor';
}

// deno-lint-ignore no-explicit-any
function entityAddress(entity: any): string {
  if (entity.entityType === 'company') {
    return (
      str(entity.businessDetails?.registeredAddress) ||
      str(entity.businessDetails?.physicalBusinessAddress)
    );
  }
  return str(entity.personalDetails?.physicalAddress);
}

function formatInvoiceNumber(seq: SupplierInvoiceSequence): string {
  return `${seq.prefix}${String(seq.nextNumber).padStart(seq.padding, '0')}`;
}

const DEFAULT_SEQUENCE: SupplierInvoiceSequence = { prefix: 'INV-', nextNumber: 1, padding: 4 };

// ============================================================================
// Service
// ============================================================================

export const SuppliersService = {
  // --- Suppliers -------------------------------------------------------

  async listSuppliers(): Promise<
    Array<SupplierRecord & { invoiceCount: number; hasActiveTemplate: boolean }>
  > {
    const suppliers = (await kv.getByPrefix(SUPPLIER_PREFIX)) as SupplierRecord[];
    const invoices = (await kv.getByPrefix(INVOICE_PREFIX)) as SupplierInvoiceRecord[];
    const counts = new Map<string, number>();
    for (const invoice of invoices) {
      counts.set(invoice.supplierId, (counts.get(invoice.supplierId) ?? 0) + 1);
    }
    return suppliers
      .filter((s) => s && s.id)
      .map((s) => ({
        ...s,
        invoiceCount: counts.get(s.id) ?? 0,
        hasActiveTemplate: Boolean(s.activeTemplateId),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getSupplier(supplierId: string): Promise<SupplierRecord | null> {
    return ((await kv.get(supplierKey(supplierId))) as SupplierRecord | undefined) ?? null;
  },

  async requireSupplier(supplierId: string): Promise<SupplierRecord> {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier) throw Object.assign(new Error('Supplier not found'), { status: 404 });
    return supplier;
  },

  async createSupplier(input: SupplierInput, createdBy: string): Promise<SupplierRecord> {
    const name = str(input.name);
    if (!name) throw Object.assign(new Error('Supplier name is required'), { status: 400 });
    const now = new Date().toISOString();
    const record: SupplierRecord = {
      id: newId(),
      name,
      registrationNumber: str(input.registrationNumber),
      vatNumber: str(input.vatNumber),
      industry: str(input.industry),
      defaultVatTreatment: parseTreatment(input.defaultVatTreatment ?? 'standard'),
      registeredAddress: str(input.registeredAddress),
      billingInfo: str(input.billingInfo),
      contactNumber: str(input.contactNumber),
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
    await kv.set(supplierKey(record.id), record);
    return record;
  },

  async updateSupplier(supplierId: string, input: SupplierInput): Promise<SupplierRecord> {
    const existing = await this.requireSupplier(supplierId);
    const next: SupplierRecord = {
      ...existing,
      name: input.name !== undefined ? str(input.name) || existing.name : existing.name,
      registrationNumber:
        input.registrationNumber !== undefined
          ? str(input.registrationNumber)
          : existing.registrationNumber,
      vatNumber: input.vatNumber !== undefined ? str(input.vatNumber) : existing.vatNumber,
      industry: input.industry !== undefined ? str(input.industry) : existing.industry,
      defaultVatTreatment:
        input.defaultVatTreatment !== undefined
          ? parseTreatment(input.defaultVatTreatment)
          : existing.defaultVatTreatment,
      registeredAddress:
        input.registeredAddress !== undefined
          ? str(input.registeredAddress)
          : existing.registeredAddress,
      billingInfo: input.billingInfo !== undefined ? str(input.billingInfo) : existing.billingInfo,
      contactNumber:
        input.contactNumber !== undefined ? str(input.contactNumber) : existing.contactNumber,
      archived: input.archived !== undefined ? Boolean(input.archived) : existing.archived,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(supplierKey(supplierId), next);
    return next;
  },

  /**
   * Deletes the supplier and all dependent KV rows. Returns every storage path
   * that belonged to the supplier so the route can clear the bucket FIRST —
   * callers must remove storage before invoking this (mirrors refund-clusters).
   */
  async collectStoragePaths(supplierId: string): Promise<string[]> {
    const supplier = await this.requireSupplier(supplierId);
    return [supplier.logo?.storagePath, supplier.exampleInvoice?.storagePath].filter(
      (p): p is string => Boolean(p),
    );
  },

  async deleteSupplier(supplierId: string): Promise<{ invoicesDeleted: number }> {
    await this.requireSupplier(supplierId);
    const templates = await this.listTemplates(supplierId);
    const invoices = await this.listInvoices(supplierId);
    await kv.mdel([
      supplierKey(supplierId),
      seqKey(supplierId),
      ...templates.map((t) => templateKey(supplierId, t.id)),
      ...invoices.map((i) => invoiceKey(supplierId, i.id)),
    ]);
    return { invoicesDeleted: invoices.length };
  },

  async setLogo(supplierId: string, meta: SupplierFileMeta): Promise<SupplierRecord> {
    const existing = await this.requireSupplier(supplierId);
    const next = { ...existing, logo: meta, updatedAt: new Date().toISOString() };
    await kv.set(supplierKey(supplierId), next);
    return next;
  },

  async setExampleInvoice(supplierId: string, meta: SupplierFileMeta): Promise<SupplierRecord> {
    const existing = await this.requireSupplier(supplierId);
    const next = { ...existing, exampleInvoice: meta, updatedAt: new Date().toISOString() };
    await kv.set(supplierKey(supplierId), next);
    return next;
  },

  // --- Templates -------------------------------------------------------

  async listTemplates(supplierId: string): Promise<SupplierTemplateRecord[]> {
    const rows = (await kv.getByPrefix(
      `${TEMPLATE_PREFIX}${supplierId}:`,
    )) as SupplierTemplateRecord[];
    return rows.filter((t) => t && t.id).sort((a, b) => b.version - a.version);
  },

  async getTemplate(
    supplierId: string,
    templateId: string,
  ): Promise<SupplierTemplateRecord | null> {
    return (
      ((await kv.get(templateKey(supplierId, templateId))) as SupplierTemplateRecord | undefined) ??
      null
    );
  },

  /**
   * Persists a new template version (never overwrites). The first template for
   * a supplier is auto-activated so invoicing works immediately.
   */
  async createTemplate(
    supplierId: string,
    source: TemplateSource,
    spec: InvoiceTemplateSpec,
    createdBy: string,
    aiMeta?: TemplateAiMeta,
  ): Promise<SupplierTemplateRecord> {
    const supplier = await this.requireSupplier(supplierId);
    const versions = await this.listTemplates(supplierId);
    const record: SupplierTemplateRecord = {
      id: newId(),
      supplierId,
      version: (versions[0]?.version ?? 0) + 1,
      source,
      spec: normalizeTemplateSpec(spec),
      aiMeta,
      createdAt: new Date().toISOString(),
      createdBy,
    };
    await kv.set(templateKey(supplierId, record.id), record);
    if (!supplier.activeTemplateId) {
      await kv.set(supplierKey(supplierId), {
        ...supplier,
        activeTemplateId: record.id,
        updatedAt: record.createdAt,
      });
    }
    return record;
  },

  async activateTemplate(supplierId: string, templateId: string): Promise<SupplierRecord> {
    const supplier = await this.requireSupplier(supplierId);
    const template = await this.getTemplate(supplierId, templateId);
    if (!template) throw Object.assign(new Error('Template not found'), { status: 404 });
    const next = {
      ...supplier,
      activeTemplateId: templateId,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(supplierKey(supplierId), next);
    return next;
  },

  // --- Invoice sequence ------------------------------------------------

  async getSequence(supplierId: string): Promise<SupplierInvoiceSequence> {
    const stored = (await kv.get(seqKey(supplierId))) as SupplierInvoiceSequence | undefined;
    return stored ?? { ...DEFAULT_SEQUENCE };
  },

  async updateSequence(
    supplierId: string,
    input: Partial<SupplierInvoiceSequence>,
  ): Promise<SupplierInvoiceSequence> {
    await this.requireSupplier(supplierId);
    const existing = await this.getSequence(supplierId);
    const next: SupplierInvoiceSequence = {
      prefix: input.prefix !== undefined ? String(input.prefix) : existing.prefix,
      nextNumber:
        input.nextNumber !== undefined
          ? Math.max(1, Math.floor(toPositiveNumber(input.nextNumber, 'nextNumber')))
          : existing.nextNumber,
      padding:
        input.padding !== undefined
          ? Math.min(10, Math.max(1, Math.floor(toPositiveNumber(input.padding, 'padding'))))
          : existing.padding,
    };
    await kv.set(seqKey(supplierId), next);
    return next;
  },

  // --- Invoices --------------------------------------------------------

  async listInvoices(supplierId: string): Promise<SupplierInvoiceRecord[]> {
    const rows = (await kv.getByPrefix(
      `${INVOICE_PREFIX}${supplierId}:`,
    )) as SupplierInvoiceRecord[];
    return rows
      .filter((i) => i && i.id)
      .sort(
        (a, b) =>
          b.invoiceDate.localeCompare(a.invoiceDate) || b.createdAt.localeCompare(a.createdAt),
      );
  },

  async getInvoice(supplierId: string, invoiceId: string): Promise<SupplierInvoiceRecord | null> {
    return (
      ((await kv.get(invoiceKey(supplierId, invoiceId))) as SupplierInvoiceRecord | undefined) ??
      null
    );
  },

  /**
   * Creates an invoice in the supplier's active template. When
   * `recordInLedger` is set and the invoice is billed to a cluster entity, the
   * matching input-VAT expense transaction is written to that entity's
   * refund-clusters ledger and linked via `ledgerTransactionId`.
   */
  async createInvoice(
    supplierId: string,
    input: InvoiceInput,
    createdBy: string,
    recordInLedger: boolean,
  ): Promise<SupplierInvoiceRecord> {
    const supplier = await this.requireSupplier(supplierId);
    if (!supplier.activeTemplateId) {
      throw Object.assign(new Error('Set an invoice template before creating invoices'), {
        status: 400,
      });
    }

    const lineItems = parseLineItems(input.lineItems);
    const billedTo = await parseBilledTo(input.billedTo);
    const totals = computeInvoiceTotals(lineItems);
    const invoiceDate = parseIsoDate(input.invoiceDate, 'invoiceDate');
    const dueDate = parseIsoDate(input.dueDate ?? invoiceDate, 'dueDate');

    const existing = await this.listInvoices(supplierId);

    // Idempotency: the API client retries transient POST failures, so a
    // committed-but-lost response would re-run this method. The client sends a
    // per-submission id; if an invoice already carries it, return that invoice
    // instead of creating a duplicate (and a duplicate ledger expense).
    const clientRequestId = str(input.clientRequestId);
    if (clientRequestId) {
      const already = existing.find((i) => i.clientRequestId === clientRequestId);
      if (already) return already;
    }

    // Resolve the invoice number: explicit override, else the sequence.
    const override = str(input.invoiceNumber);
    const seq = await this.getSequence(supplierId);
    const invoiceNumber = override || formatInvoiceNumber(seq);
    if (existing.some((i) => i.invoiceNumber === invoiceNumber)) {
      throw Object.assign(new Error(`Invoice number ${invoiceNumber} is already in use`), {
        status: 409,
      });
    }

    const now = new Date().toISOString();
    const record: SupplierInvoiceRecord = {
      id: newId(),
      supplierId,
      templateId: supplier.activeTemplateId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      billedTo,
      lineItems,
      totals,
      notes: str(input.notes),
      status: input.status === 'issued' ? 'issued' : 'draft',
      clientRequestId: clientRequestId || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    if (recordInLedger && billedTo.kind === 'cluster_entity' && totals.total > 0) {
      const transaction = await RefundClustersService.createTransaction(
        billedTo.clusterId,
        billedTo.entityId,
        {
          date: invoiceDate,
          description: `Invoice ${invoiceNumber} — ${supplier.name}`,
          direction: 'expense',
          vatTreatment: dominantTreatment(lineItems),
          // Ledger amounts are VAT-inclusive; pass the computed VAT explicitly
          // since mixed line treatments make a derived figure wrong.
          amount: totals.total,
          vatAmount: totals.vatAmount,
        },
        createdBy,
      );
      record.ledgerTransactionId = transaction.id;

      try {
        await kv.set(invoiceKey(supplierId, record.id), record);
      } catch (error) {
        // Compensate: never leave an input-VAT expense with no invoice behind
        // it. If the cleanup itself fails, log the orphan for manual removal.
        try {
          await RefundClustersService.deleteTransaction(billedTo.entityId, transaction.id);
        } catch (cleanupError) {
          log.error('Failed to roll back orphaned ledger transaction', {
            entityId: billedTo.entityId,
            transactionId: transaction.id,
            error: cleanupError,
          });
        }
        throw error;
      }
    } else {
      await kv.set(invoiceKey(supplierId, record.id), record);
    }

    // Advance the sequence after a successful write — also when an explicit
    // override consumed exactly the number the sequence would have issued,
    // otherwise the next auto-assigned invoice collides with it.
    if (!override || override === formatInvoiceNumber(seq)) {
      await kv.set(seqKey(supplierId), { ...seq, nextNumber: seq.nextNumber + 1 });
    }
    return record;
  },

  /**
   * Updates invoice fields and recomputes totals. The billed-to target and any
   * linked ledger transaction are intentionally immutable — delete and
   * recreate the invoice to rebill it.
   */
  async updateInvoice(
    supplierId: string,
    invoiceId: string,
    input: InvoiceInput,
  ): Promise<SupplierInvoiceRecord> {
    const existing = await this.getInvoice(supplierId, invoiceId);
    if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });

    const lineItems =
      input.lineItems !== undefined ? parseLineItems(input.lineItems) : existing.lineItems;
    const invoiceNumber =
      input.invoiceNumber !== undefined
        ? str(input.invoiceNumber) || existing.invoiceNumber
        : existing.invoiceNumber;
    if (invoiceNumber !== existing.invoiceNumber) {
      const all = await this.listInvoices(supplierId);
      if (all.some((i) => i.id !== invoiceId && i.invoiceNumber === invoiceNumber)) {
        throw Object.assign(new Error(`Invoice number ${invoiceNumber} is already in use`), {
          status: 409,
        });
      }
    }

    const next: SupplierInvoiceRecord = {
      ...existing,
      invoiceNumber,
      invoiceDate:
        input.invoiceDate !== undefined
          ? parseIsoDate(input.invoiceDate, 'invoiceDate')
          : existing.invoiceDate,
      dueDate:
        input.dueDate !== undefined ? parseIsoDate(input.dueDate, 'dueDate') : existing.dueDate,
      lineItems,
      totals: computeInvoiceTotals(lineItems),
      notes: input.notes !== undefined ? str(input.notes) : existing.notes,
      status:
        input.status === 'issued' || input.status === 'draft' ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(invoiceKey(supplierId, invoiceId), next);
    return next;
  },

  async deleteInvoice(supplierId: string, invoiceId: string): Promise<SupplierInvoiceRecord> {
    const existing = await this.getInvoice(supplierId, invoiceId);
    if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    await kv.del(invoiceKey(supplierId, invoiceId));
    return existing;
  },

  // --- Billed-to options ----------------------------------------------

  /** Flattened refund-cluster entities for the invoice billed-to selector. */
  async listBilledToOptions(): Promise<
    Array<{
      clusterId: string;
      clusterName: string;
      entityId: string;
      name: string;
      address?: string;
    }>
  > {
    const clusters = await RefundClustersService.listClusters();
    const options: Array<{
      clusterId: string;
      clusterName: string;
      entityId: string;
      name: string;
      address?: string;
    }> = [];
    for (const cluster of clusters) {
      if (cluster.archived) continue;
      const entities = await RefundClustersService.listEntities(cluster.id);
      for (const entity of entities) {
        options.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          entityId: entity.id,
          name: entityDisplayName(entity),
          address: entityAddress(entity) || undefined,
        });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  },
};
