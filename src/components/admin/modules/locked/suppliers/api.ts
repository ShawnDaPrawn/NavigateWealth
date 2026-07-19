/**
 * Suppliers — API Layer
 *
 * §5.1 — Data boundary; only layer that touches the server.
 * All routes are super-admin only and audited server-side.
 */

import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import { ENDPOINTS } from './constants';
import type {
  BilledToOption,
  Supplier,
  SupplierDetailResponse,
  SupplierInput,
  SupplierInvoice,
  SupplierInvoiceInput,
  SupplierInvoiceSequence,
  SupplierTemplate,
} from './types';
import type { InvoiceTemplateSpec } from './templateSpec';

function rethrow(error: unknown, context: string): never {
  logger.error(`[SuppliersAPI] ${context} failed`, error);
  throw error instanceof Error ? error : new Error('An unknown error occurred');
}

export const SuppliersAPI = {
  async listSuppliers(): Promise<Supplier[]> {
    try {
      const data = await api.get<{ suppliers: Supplier[] }>(ENDPOINTS.SUPPLIERS);
      return data?.suppliers ?? [];
    } catch (error) {
      rethrow(error, 'listSuppliers');
    }
  },

  async createSupplier(input: SupplierInput): Promise<Supplier> {
    try {
      const data = await api.post<{ supplier: Supplier }>(ENDPOINTS.SUPPLIERS, input);
      return data.supplier;
    } catch (error) {
      rethrow(error, 'createSupplier');
    }
  },

  async getSupplierDetail(supplierId: string): Promise<SupplierDetailResponse> {
    try {
      const data = await api.get<SupplierDetailResponse>(ENDPOINTS.SUPPLIER(supplierId));
      return {
        supplier: data.supplier,
        templates: data.templates ?? [],
        sequence: data.sequence,
      };
    } catch (error) {
      rethrow(error, 'getSupplierDetail');
    }
  },

  async updateSupplier(supplierId: string, patch: SupplierInput): Promise<Supplier> {
    try {
      const data = await api.put<{ supplier: Supplier }>(ENDPOINTS.SUPPLIER(supplierId), patch);
      return data.supplier;
    } catch (error) {
      rethrow(error, 'updateSupplier');
    }
  },

  async deleteSupplier(supplierId: string): Promise<void> {
    try {
      await api.delete(ENDPOINTS.SUPPLIER(supplierId));
    } catch (error) {
      rethrow(error, 'deleteSupplier');
    }
  },

  // --- Files -----------------------------------------------------------

  async uploadLogo(supplierId: string, file: File): Promise<Supplier> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<{ supplier: Supplier }>(ENDPOINTS.LOGO(supplierId), formData);
      return data.supplier;
    } catch (error) {
      rethrow(error, 'uploadLogo');
    }
  },

  async getLogoUrl(supplierId: string): Promise<string> {
    try {
      const data = await api.get<{ url: string }>(ENDPOINTS.LOGO_URL(supplierId));
      return data.url;
    } catch (error) {
      rethrow(error, 'getLogoUrl');
    }
  },

  async uploadExampleInvoice(supplierId: string, file: File): Promise<Supplier> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post<{ supplier: Supplier }>(
        ENDPOINTS.EXAMPLE_INVOICE(supplierId),
        formData,
      );
      return data.supplier;
    } catch (error) {
      rethrow(error, 'uploadExampleInvoice');
    }
  },

  async getExampleInvoiceUrl(
    supplierId: string,
  ): Promise<{ url: string; fileName: string; contentType: string }> {
    try {
      const data = await api.get<{ url: string; fileName: string; contentType: string }>(
        ENDPOINTS.EXAMPLE_INVOICE_URL(supplierId),
      );
      return data;
    } catch (error) {
      rethrow(error, 'getExampleInvoiceUrl');
    }
  },

  // --- Templates -------------------------------------------------------

  /** Long-running: sends the stored example invoice to the AI analyzer. */
  async analyzeTemplate(supplierId: string): Promise<SupplierTemplate> {
    try {
      const data = await api.post<{ template: SupplierTemplate }>(
        ENDPOINTS.TEMPLATE_ANALYZE(supplierId),
      );
      return data.template;
    } catch (error) {
      rethrow(error, 'analyzeTemplate');
    }
  },

  /** Manual template created from scratch (no base version). */
  async createManualTemplate(
    supplierId: string,
    spec: InvoiceTemplateSpec,
  ): Promise<SupplierTemplate> {
    try {
      const data = await api.post<{ template: SupplierTemplate }>(ENDPOINTS.TEMPLATES(supplierId), {
        spec,
      });
      return data.template;
    } catch (error) {
      rethrow(error, 'createManualTemplate');
    }
  },

  /** Manual spec edit — the server persists it as a NEW template version. */
  async saveTemplateSpec(
    supplierId: string,
    baseTemplateId: string,
    spec: InvoiceTemplateSpec,
  ): Promise<SupplierTemplate> {
    try {
      const data = await api.put<{ template: SupplierTemplate }>(
        ENDPOINTS.TEMPLATE(supplierId, baseTemplateId),
        { spec },
      );
      return data.template;
    } catch (error) {
      rethrow(error, 'saveTemplateSpec');
    }
  },

  async activateTemplate(supplierId: string, templateId: string): Promise<Supplier> {
    try {
      const data = await api.post<{ supplier: Supplier }>(
        ENDPOINTS.TEMPLATE_ACTIVATE(supplierId, templateId),
      );
      return data.supplier;
    } catch (error) {
      rethrow(error, 'activateTemplate');
    }
  },

  // --- Sequence --------------------------------------------------------

  async updateSequence(
    supplierId: string,
    input: Partial<SupplierInvoiceSequence>,
  ): Promise<SupplierInvoiceSequence> {
    try {
      const data = await api.put<{ sequence: SupplierInvoiceSequence }>(
        ENDPOINTS.SEQUENCE(supplierId),
        input,
      );
      return data.sequence;
    } catch (error) {
      rethrow(error, 'updateSequence');
    }
  },

  // --- Invoices --------------------------------------------------------

  async listInvoices(supplierId: string): Promise<SupplierInvoice[]> {
    try {
      const data = await api.get<{ invoices: SupplierInvoice[] }>(ENDPOINTS.INVOICES(supplierId));
      return data?.invoices ?? [];
    } catch (error) {
      rethrow(error, 'listInvoices');
    }
  },

  async createInvoice(supplierId: string, input: SupplierInvoiceInput): Promise<SupplierInvoice> {
    try {
      const data = await api.post<{ invoice: SupplierInvoice }>(
        ENDPOINTS.INVOICES(supplierId),
        input,
      );
      return data.invoice;
    } catch (error) {
      rethrow(error, 'createInvoice');
    }
  },

  async updateInvoice(
    supplierId: string,
    invoiceId: string,
    input: Partial<SupplierInvoiceInput>,
  ): Promise<SupplierInvoice> {
    try {
      const data = await api.put<{ invoice: SupplierInvoice }>(
        ENDPOINTS.INVOICE(supplierId, invoiceId),
        input,
      );
      return data.invoice;
    } catch (error) {
      rethrow(error, 'updateInvoice');
    }
  },

  async deleteInvoice(
    supplierId: string,
    invoiceId: string,
  ): Promise<{ ledgerTransactionId: string | null }> {
    try {
      const data = await api.delete<{ ledgerTransactionId: string | null }>(
        ENDPOINTS.INVOICE(supplierId, invoiceId),
      );
      return { ledgerTransactionId: data?.ledgerTransactionId ?? null };
    } catch (error) {
      rethrow(error, 'deleteInvoice');
    }
  },

  // --- Billed-to options ----------------------------------------------

  async listBilledToOptions(): Promise<BilledToOption[]> {
    try {
      const data = await api.get<{ options: BilledToOption[] }>(ENDPOINTS.BILLED_TO_OPTIONS);
      return data?.options ?? [];
    } catch (error) {
      rethrow(error, 'listBilledToOptions');
    }
  },
};
