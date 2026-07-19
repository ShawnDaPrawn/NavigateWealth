/**
 * Suppliers — Query & Mutation Hooks
 *
 * §6 — Hooks are the only consumers of APIs.
 * §11.2 — React Query for all server state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supplierKeys } from '../queryKeys';
import { SuppliersAPI } from '../api';
import type { SupplierInput, SupplierInvoiceInput, SupplierInvoiceSequence } from '../types';
import type { InvoiceTemplateSpec } from '../templateSpec';

const STALE_TIME = 60 * 1000;

// ============================================================================
// Queries
// ============================================================================

export function useSuppliers() {
  return useQuery({
    queryKey: supplierKeys.lists(),
    queryFn: () => SuppliersAPI.listSuppliers(),
    staleTime: STALE_TIME,
  });
}

export function useSupplierDetail(supplierId: string | null) {
  return useQuery({
    queryKey: supplierKeys.detail(supplierId ?? ''),
    queryFn: () => SuppliersAPI.getSupplierDetail(supplierId!),
    enabled: !!supplierId,
    staleTime: STALE_TIME,
  });
}

export function useSupplierInvoices(supplierId: string | null) {
  return useQuery({
    queryKey: supplierKeys.invoices(supplierId ?? ''),
    queryFn: () => SuppliersAPI.listInvoices(supplierId!),
    enabled: !!supplierId,
    staleTime: STALE_TIME,
  });
}

/** Signed logo URL (5-minute expiry — kept fresh by a short stale time). */
export function useSupplierLogoUrl(supplierId: string | null, hasLogo: boolean) {
  return useQuery({
    queryKey: supplierKeys.logoUrl(supplierId ?? ''),
    queryFn: () => SuppliersAPI.getLogoUrl(supplierId!),
    enabled: !!supplierId && hasLogo,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });
}

export function useExampleInvoiceUrl(supplierId: string | null, hasExample: boolean) {
  return useQuery({
    queryKey: supplierKeys.exampleUrl(supplierId ?? ''),
    queryFn: () => SuppliersAPI.getExampleInvoiceUrl(supplierId!),
    enabled: !!supplierId && hasExample,
    staleTime: 4 * 60 * 1000,
    retry: 1,
  });
}

export function useBilledToOptions(enabled = true) {
  return useQuery({
    queryKey: supplierKeys.billedToOptions(),
    queryFn: () => SuppliersAPI.listBilledToOptions(),
    enabled,
    staleTime: STALE_TIME,
  });
}

// ============================================================================
// Supplier mutations
// ============================================================================

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInput) => SuppliersAPI.createSupplier(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      toast.success('Supplier created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create supplier', { description: error.message });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; patch: SupplierInput }) =>
      SuppliersAPI.updateSupplier(input.supplierId, input.patch),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success('Supplier updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update supplier', { description: error.message });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplierId: string) => SuppliersAPI.deleteSupplier(supplierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supplierKeys.all });
      toast.success('Supplier deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete supplier', { description: error.message });
    },
  });
}

// ============================================================================
// File mutations
// ============================================================================

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; file: File }) =>
      SuppliersAPI.uploadLogo(input.supplierId, input.file),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      qc.invalidateQueries({ queryKey: supplierKeys.logoUrl(variables.supplierId) });
      toast.success('Logo uploaded');
    },
    onError: (error: Error) => {
      toast.error('Failed to upload logo', { description: error.message });
    },
  });
}

export function useUploadExampleInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; file: File }) =>
      SuppliersAPI.uploadExampleInvoice(input.supplierId, input.file),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      qc.invalidateQueries({ queryKey: supplierKeys.exampleUrl(variables.supplierId) });
      toast.success('Example invoice uploaded');
    },
    onError: (error: Error) => {
      toast.error('Failed to upload example invoice', { description: error.message });
    },
  });
}

// ============================================================================
// Template mutations
// ============================================================================

/** Long-running AI call — never auto-retried so a slow analysis isn't doubled. */
export function useAnalyzeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (supplierId: string) => SuppliersAPI.analyzeTemplate(supplierId),
    onSuccess: (template, supplierId) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(supplierId) });
      toast.success(`Template v${template.version} created from the example invoice`);
    },
    onError: (error: Error) => {
      toast.error('AI analysis failed', { description: error.message });
    },
  });
}

export function useSaveTemplateSpec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      supplierId: string;
      baseTemplateId: string;
      spec: InvoiceTemplateSpec;
    }) => SuppliersAPI.saveTemplateSpec(input.supplierId, input.baseTemplateId, input.spec),
    onSuccess: (template, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success(`Template saved as v${template.version}`);
    },
    onError: (error: Error) => {
      toast.error('Failed to save template', { description: error.message });
    },
  });
}

export function useActivateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; templateId: string }) =>
      SuppliersAPI.activateTemplate(input.supplierId, input.templateId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success('Template activated');
    },
    onError: (error: Error) => {
      toast.error('Failed to activate template', { description: error.message });
    },
  });
}

// ============================================================================
// Sequence + invoice mutations
// ============================================================================

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; sequence: Partial<SupplierInvoiceSequence> }) =>
      SuppliersAPI.updateSequence(input.supplierId, input.sequence),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success('Invoice numbering updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update invoice numbering', { description: error.message });
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; invoice: SupplierInvoiceInput }) =>
      SuppliersAPI.createInvoice(input.supplierId, input.invoice),
    onSuccess: (invoice, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      qc.invalidateQueries({ queryKey: supplierKeys.invoices(variables.supplierId) });
      toast.success(
        invoice.ledgerTransactionId
          ? `Invoice ${invoice.invoiceNumber} created and recorded in the VAT ledger`
          : `Invoice ${invoice.invoiceNumber} created`,
      );
    },
    onError: (error: Error) => {
      toast.error('Failed to create invoice', { description: error.message });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      supplierId: string;
      invoiceId: string;
      patch: Partial<SupplierInvoiceInput>;
    }) => SuppliersAPI.updateInvoice(input.supplierId, input.invoiceId, input.patch),
    onSuccess: (invoice, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.invoices(variables.supplierId) });
      toast.success(`Invoice ${invoice.invoiceNumber} updated`);
    },
    onError: (error: Error) => {
      toast.error('Failed to update invoice', { description: error.message });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { supplierId: string; invoiceId: string }) =>
      SuppliersAPI.deleteInvoice(input.supplierId, input.invoiceId),
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: supplierKeys.lists() });
      qc.invalidateQueries({ queryKey: supplierKeys.invoices(variables.supplierId) });
      toast.success(
        result.ledgerTransactionId
          ? 'Invoice deleted. Its VAT ledger transaction was kept — remove it from the entity ledger if needed.'
          : 'Invoice deleted',
      );
    },
    onError: (error: Error) => {
      toast.error('Failed to delete invoice', { description: error.message });
    },
  });
}
