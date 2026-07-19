/**
 * Suppliers — React Query key factory.
 *
 * Deliberately local to the locked module (NOT in utils/queryKeys.ts):
 * the Locked module is a standalone unit that must stay deletable without
 * touching shared registries. See ../README.md.
 */

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (supplierId: string) => [...supplierKeys.details(), supplierId] as const,
  invoices: (supplierId: string) => [...supplierKeys.all, 'invoices', supplierId] as const,
  logoUrl: (supplierId: string) => [...supplierKeys.all, 'logo-url', supplierId] as const,
  exampleUrl: (supplierId: string) => [...supplierKeys.all, 'example-url', supplierId] as const,
  billedToOptions: () => [...supplierKeys.all, 'billed-to-options'] as const,
} as const;
