/**
 * Split out of DocumentsChecklist.tsx so that file exports components only —
 * a module mixing component and non-component exports defeats React Fast
 * Refresh (react-refresh/only-export-components).
 *
 * The item shape stays with the component that renders it; only this pure
 * derivation moves.
 */
import type { DocumentItem } from './DocumentsChecklist';

/**
 * Derives document checklist items from profile data and policy/FNA state.
 * Pure function — no side effects.
 *
 * Guidelines §7.1 — pure utility for derived display state.
 */
export function deriveDocumentChecklist({
  hasIdNumber,
  hasAddress,
  hasBankDetails,
  hasPayslip,
  hasTaxNumber,
  hasIncome,
  policyCategoriesWithDocs,
  publishedFnaModules,
}: {
  hasIdNumber: boolean;
  hasAddress: boolean;
  hasBankDetails: boolean;
  hasPayslip: boolean;
  hasTaxNumber: boolean;
  hasIncome: boolean;
  /** Category IDs that have at least one policy on record */
  policyCategoriesWithDocs: string[];
  /** FNA module keys that have been published */
  publishedFnaModules: string[];
}): DocumentItem[] {
  const docs: DocumentItem[] = [];

  // ── FICA / KYC ──
  docs.push({
    id: 'fica-id',
    label: 'ID Document / Passport',
    category: 'fica',
    status: hasIdNumber ? 'available' : 'missing',
    detail: hasIdNumber ? 'ID number on file' : undefined,
  });
  docs.push({
    id: 'fica-address',
    label: 'Proof of Address',
    category: 'fica',
    status: hasAddress ? 'available' : 'missing',
    detail: hasAddress ? 'Residential address captured' : undefined,
  });
  docs.push({
    id: 'fica-bank',
    label: 'Bank Confirmation / Statement',
    category: 'fica',
    status: hasBankDetails ? 'available' : 'missing',
    detail: hasBankDetails ? 'Banking details on file' : undefined,
  });

  // ── Income Verification ──
  docs.push({
    id: 'income-payslip',
    label: 'Recent Payslip',
    category: 'income',
    status: hasPayslip || hasIncome ? 'available' : 'missing',
    detail: hasIncome ? 'Income recorded' : undefined,
  });
  docs.push({
    id: 'income-tax',
    label: 'Tax Reference (IRP5 / IT12)',
    category: 'income',
    status: hasTaxNumber ? 'available' : 'missing',
    detail: hasTaxNumber ? 'Tax number on file' : undefined,
  });

  // ── Policy Schedules ──
  const policyCategories = [
    { id: 'risk_planning', label: 'Risk Planning Policy Schedule' },
    { id: 'medical_aid', label: 'Medical Aid Membership Certificate' },
    { id: 'retirement_planning', label: 'Retirement Fund Statement' },
    { id: 'investments', label: 'Investment Portfolio Statement' },
    { id: 'employee_benefits', label: 'Employee Benefits Schedule' },
    { id: 'estate_planning', label: 'Estate Plan / Will' },
  ];

  policyCategories.forEach((pc) => {
    const hasDoc = policyCategoriesWithDocs.includes(pc.id);
    docs.push({
      id: `policy-${pc.id}`,
      label: pc.label,
      category: 'policies',
      status: hasDoc ? 'available' : 'missing',
      detail: hasDoc ? 'On record' : undefined,
    });
  });

  // ── FNA Records ──
  const fnaModules = [
    { key: 'risk', label: 'Risk Planning FNA' },
    { key: 'medical', label: 'Medical Aid FNA' },
    { key: 'retirement', label: 'Retirement Planning FNA' },
    { key: 'investment', label: 'Investment Planning FNA' },
    { key: 'estate', label: 'Estate Planning FNA' },
  ];

  fnaModules.forEach((fm) => {
    const isPublished = publishedFnaModules.includes(fm.key);
    docs.push({
      id: `fna-roa-${fm.key}`,
      label: fm.label,
      category: 'fna',
      status: isPublished ? 'available' : 'missing',
      detail: isPublished ? 'Published' : undefined,
    });
  });

  return docs;
}
