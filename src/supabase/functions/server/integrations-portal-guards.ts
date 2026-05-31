/**
 * Portal automation — request guards & category eligibility (Phase 5 decomposition).
 * =================================================================================
 *
 * Extracted verbatim from integrations.tsx. Worker-secret auth guard
 * (requirePortalWorker + helpers) and the category classification/eligibility
 * rules (which product categories support portal automation, retirement-annuity
 * marker detection, row category inference, artifact category matching). Pure +
 * Deno.env only; no kv, no staying-helper calls. Behaviour-preserving move.
 *
 * NOTE: kept out of Prettier (.prettierignore) — providerPortalGolden asserts on
 * the exact text of several signatures here; reflow would break those anchors.
 */
import type { IntegrationSyncRun } from './integrations-core-types.ts';
import type { PortalJobPolicyItem } from './integrations-portal-types.ts';

export function getWorkerSecret(): string {
  return String(Deno.env.get('NW_PORTAL_WORKER_SECRET') || Deno.env.get('PORTAL_WORKER_SECRET') || '').trim();
}

export function isPortalWorkerRequest(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const expected = getWorkerSecret();
  if (!expected) return false;
  const headerSecret = String(c.req.header('X-Portal-Worker-Secret') || '').trim();
  const authHeader = String(c.req.header('Authorization') || '');
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  return headerSecret === expected || bearerSecret === expected;
}

export function requirePortalWorker(c: { json: (body: unknown, status?: number) => Response; req: { header: (name: string) => string | undefined } }): Response | null {
  if (!getWorkerSecret()) {
    return c.json({ error: 'Portal worker secret is not configured on Supabase' }, 503);
  }
  if (!isPortalWorkerRequest(c)) {
    return c.json({ error: 'Unauthorized portal worker' }, 401);
  }
  return null;
}

export function categoryMatches(requestedCategoryId: string, policyCategoryId: string): boolean {
  if (requestedCategoryId === policyCategoryId) return true;

  const groupedCategories: Record<string, string[]> = {
    retirement_planning: ['retirement_planning', 'retirement_pre', 'retirement_post'],
    investments: ['investments', 'investments_voluntary', 'investments_guaranteed'],
    employee_benefits: ['employee_benefits', 'employee_benefits_risk', 'employee_benefits_retirement'],
  };

  return (groupedCategories[requestedCategoryId] || [requestedCategoryId]).includes(policyCategoryId);
}

const PORTAL_AUTOMATION_CATEGORY_LABELS: Record<string, string> = {
  risk_planning: 'Risk Planning',
  medical_aid: 'Medical Aid',
  retirement_pre: 'Pre-Retirement',
  retirement_post: 'Post-Retirement',
  investments_voluntary: 'Voluntary Investments',
  investments_guaranteed: 'Guaranteed Investments',
  employee_benefits: 'Employee Benefits',
  employee_benefits_risk: 'Employee Benefits Risk',
  employee_benefits_retirement: 'Employee Benefits Retirement',
  tax_planning: 'Tax Planning',
  estate_planning: 'Estate Planning',
};

export function isPortalAutomationCategory(categoryId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PORTAL_AUTOMATION_CATEGORY_LABELS, categoryId);
}

export function getPortalAutomationCategoryError(categoryId: string): string | null {
  if (isPortalAutomationCategory(categoryId)) return null;

  if (categoryId === 'retirement_planning') {
    return 'Retirement Planning is a parent category. Portal automation can only run for Pre-Retirement or Post-Retirement.';
  }

  if (categoryId === 'investments') {
    return 'Investments is a parent category. Portal automation can only run for Voluntary Investments or Guaranteed Investments.';
  }

  return 'Portal automation can only run for specific product subcategories. Select a supported category before starting a job.';
}

export function isRetirementPortalCategory(categoryId: string): boolean {
  return categoryMatches('retirement_planning', categoryId);
}

export function isInvestmentPortalCategory(categoryId: string): boolean {
  return categoryMatches('investments', categoryId);
}

export function normalisePortalCategoryProbe(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function recordHasRetirementAnnuityMarker(record?: Record<string, unknown>): boolean {
  if (!record) return false;
  return Object.entries(record).some(([key, value]) => {
    const text = `${normalisePortalCategoryProbe(key)} ${normalisePortalCategoryProbe(value)}`;
    return /\bretirement\s+annuit/.test(text) || /\bretirement\s+annuity\s+fund\b/.test(text);
  });
}

export function syncRunHasRetirementAnnuityMarker(run?: IntegrationSyncRun | null): boolean {
  if (!run) return false;
  return (run.rows || []).some((row) =>
    recordHasRetirementAnnuityMarker(row.rawData) ||
    recordHasRetirementAnnuityMarker(row.mappedData) ||
    row.diffs.some((diff) =>
      recordHasRetirementAnnuityMarker({
        fieldName: diff.fieldName,
        oldValue: diff.oldValue,
        newValue: diff.newValue,
      })
    )
  );
}

export function portalJobItemsHaveRetirementAnnuityMarker(items?: PortalJobPolicyItem[] | null): boolean {
  if (!Array.isArray(items)) return false;
  return items.some((item) =>
    recordHasRetirementAnnuityMarker(item.rawData) ||
    recordHasRetirementAnnuityMarker(item.extractedData)
  );
}

export function inferPortalRowCategoryId(row: Record<string, unknown>, fallbackCategoryId: string): string {
  if (recordHasRetirementAnnuityMarker(row)) {
    return 'retirement_planning';
  }
  return fallbackCategoryId;
}

export function portalArtifactsMatchCategory(categoryId: string, options: {
  stagedRun?: IntegrationSyncRun | null;
  items?: PortalJobPolicyItem[] | null;
} = {}): boolean {
  if (isInvestmentPortalCategory(categoryId)) {
    return !syncRunHasRetirementAnnuityMarker(options.stagedRun) &&
      !portalJobItemsHaveRetirementAnnuityMarker(options.items);
  }
  return true;
}
