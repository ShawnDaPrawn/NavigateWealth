/**
 * Suppliers — Constants
 */

const supplierBase = (supplierId: string) => `/suppliers/${supplierId}`;

export const ENDPOINTS = {
  SUPPLIERS: '/suppliers',
  SUPPLIER: supplierBase,
  BILLED_TO_OPTIONS: '/suppliers/billed-to-options',
  LOGO: (supplierId: string) => `${supplierBase(supplierId)}/logo`,
  LOGO_URL: (supplierId: string) => `${supplierBase(supplierId)}/logo/url`,
  EXAMPLE_INVOICE: (supplierId: string) => `${supplierBase(supplierId)}/example-invoice`,
  EXAMPLE_INVOICE_URL: (supplierId: string) => `${supplierBase(supplierId)}/example-invoice/url`,
  TEMPLATE_ANALYZE: (supplierId: string) => `${supplierBase(supplierId)}/template/analyze`,
  TEMPLATES: (supplierId: string) => `${supplierBase(supplierId)}/templates`,
  TEMPLATE: (supplierId: string, templateId: string) =>
    `${supplierBase(supplierId)}/templates/${templateId}`,
  TEMPLATE_ACTIVATE: (supplierId: string, templateId: string) =>
    `${supplierBase(supplierId)}/templates/${templateId}/activate`,
  SEQUENCE: (supplierId: string) => `${supplierBase(supplierId)}/sequence`,
  INVOICES: (supplierId: string) => `${supplierBase(supplierId)}/invoices`,
  INVOICE: (supplierId: string, invoiceId: string) =>
    `${supplierBase(supplierId)}/invoices/${invoiceId}`,
} as const;

// Upload constraints — mirrored server-side; the server is authoritative.
export {
  ALLOWED_FILE_ACCEPT,
  MAX_FILE_BYTES,
  VAT_TREATMENT_OPTIONS,
} from '../refund-clusters/constants';
export const LOGO_ACCEPT = '.jpg,.jpeg,.png';

/** Industry sectors typical of SA VAT-registered service suppliers. */
export const INDUSTRY_OPTIONS: string[] = [
  'Accounting & Auditing',
  'Agriculture',
  'Cleaning Services',
  'Construction',
  'Consulting & Professional Services',
  'Engineering',
  'Information Technology',
  'Legal Services',
  'Maintenance & Repairs',
  'Manufacturing',
  'Marketing & Advertising',
  'Property & Facilities',
  'Security Services',
  'Telecommunications',
  'Transport & Logistics',
  'Wholesale & Retail',
  'Other',
];
