/**
 * Suppliers — Client Types
 *
 * Mirrors the server shapes in
 * src/supabase/functions/server/locked/suppliers-service.ts.
 */

import type { InvoiceTemplateSpec } from './templateSpec';
import type { VatTreatment } from '../refund-clusters/types';

export type { VatTreatment };

export interface SupplierFileMeta {
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  registrationNumber: string;
  vatNumber: string;
  industry: string;
  defaultVatTreatment: VatTreatment;
  registeredAddress: string;
  billingInfo: string;
  contactNumber: string;
  logo?: SupplierFileMeta;
  exampleInvoice?: SupplierFileMeta;
  activeTemplateId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** List-endpoint enrichments. */
  invoiceCount?: number;
  hasActiveTemplate?: boolean;
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

export interface SupplierTemplate {
  id: string;
  supplierId: string;
  version: number;
  source: TemplateSource;
  spec: InvoiceTemplateSpec;
  aiMeta?: {
    model: string;
    confidence: number;
    notes: string;
    analyzedAt: string;
    exampleStoragePath: string;
  };
  createdAt: string;
  createdBy: string;
}

export type InvoiceBilledTo =
  | {
      kind: 'cluster_entity';
      clusterId: string;
      entityId: string;
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

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  templateId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  billedTo: InvoiceBilledTo;
  lineItems: InvoiceLineItem[];
  totals: InvoiceTotals;
  notes: string;
  status: InvoiceStatus;
  ledgerTransactionId?: string;
  /** Client-generated submission id; makes creation idempotent across retries. */
  clientRequestId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SupplierInvoiceInput {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  billedTo:
    | { kind: 'cluster_entity'; clusterId: string; entityId: string }
    | { kind: 'freeform'; name: string; vatNumber?: string; address?: string };
  lineItems: InvoiceLineItem[];
  notes?: string;
  status?: InvoiceStatus;
  recordInLedger?: boolean;
  /** Client-generated submission id; makes creation idempotent across retries. */
  clientRequestId?: string;
}

export interface SupplierInvoiceSequence {
  prefix: string;
  nextNumber: number;
  padding: number;
}

export interface BilledToOption {
  clusterId: string;
  clusterName: string;
  entityId: string;
  name: string;
  address?: string;
}

/** Everything the InvoicePreview renderer needs about one invoice. */
export interface InvoicePreviewData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  reference?: string;
  billedToName: string;
  billedToVatNumber?: string;
  billedToAddress?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

export interface SupplierDetailResponse {
  supplier: Supplier;
  templates: SupplierTemplate[];
  sequence: SupplierInvoiceSequence;
}
