/**
 * FNA Batch Status Routes
 * 
 * Provides a single endpoint to fetch the latest published FNA status
 * for all 5 FNA modules in a single request, replacing 5 individual
 * waterfall/parallel calls from the frontend.
 * 
 * Response shape per module:
 *   { key, status, data } — where data is the full FNA record or null
 * 
 * This is a read-only, performance-oriented endpoint.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser } from './fna-auth.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const fnaBatchStatusRoutes = new Hono();
const log = createModuleLogger('fna-batch-status');

/** Minimal shape for sorting FNA records */
interface FnaRecord {
  id?: string;
  status?: string;
  version?: number;
  publishedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Find the latest published FNA from a list of records.
 * Sorts by publishedAt descending, then by version descending.
 */
function findLatestPublished(records: FnaRecord[]): FnaRecord | null {
  const published = records.filter((r) => r.status === 'published');
  if (published.length === 0) return null;

  published.sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (b.version ?? 0) - (a.version ?? 0);
  });

  return published[0];
}

/**
 * Find the latest draft FNA (when no published version exists).
 */
function findLatestDraft(records: FnaRecord[]): FnaRecord | null {
  const drafts = records.filter((r) => r.status === 'draft');
  if (drafts.length === 0) return null;

  drafts.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (dateA !== dateB) return dateB - dateA;
    return (b.version ?? 0) - (a.version ?? 0);
  });

  return drafts[0];
}

/**
 * GET /fna/batch-status/client/:clientId
 * 
 * Returns the latest FNA status for all 5 modules in a single response.
 * Each module result includes: key, status ('published' | 'draft' | 'not_started' | 'error'), data (full record or null)
 */
fnaBatchStatusRoutes.get('/client/:clientId', async (c) => {
  try {
    log.info('📥 GET /fna/batch-status/client/:clientId');
    const clientId = c.req.param('clientId');

    // Optional authentication — mirrors individual FNA route patterns
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.role === 'super-admin' || user.id === 'admin';
        const isOwnData = user.id === clientId;

        if (!isAdmin && !isOwnData) {
          log.warn(`⚠️ User ${user.id} (role: ${user.role}) attempting batch FNA status for client ${clientId}`);
          return c.json({ success: false, error: 'Unauthorized access to client data' }, 403);
        }
      } catch {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published FNA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing FNA display until portal auth is refactored.
        // Proper fix: Require authentication on all FNA reads; update client portal to pass user session token.
        log.info('Authentication failed, allowing unauthenticated access to batch FNA status');
      }
    }

    // Fetch all 5 FNA module data in parallel using Promise.all for batch KV reads
    const [
      riskLatestPtr,
      retirementLatestPtr,
      medicalRecordsLegacy,
      medicalRecordsNew,
      investmentRecords,
      estateRecords,
      taxPlanningRecords,
    ] = await Promise.all([
      // Risk Planning uses a :latest pointer key
      kv.get(`risk_planning_fna:${clientId}:latest`),
      // Retirement uses a :latest pointer key
      kv.get(`retirement_fna:${clientId}:latest`),
      // Medical uses getByPrefix with both legacy and new key formats
      kv.getByPrefix(`medical-fna:client:${clientId}:`),
      kv.getByPrefix(`medical-fna:client_${clientId}_`),
      // Investment uses getByPrefix
      kv.getByPrefix(`investment-ina:client:${clientId}:`),
      // Estate Planning uses getByPrefix
      kv.getByPrefix(`estate-planning-fna:client:${clientId}:`),
      // Tax Planning uses getByPrefix
      kv.getByPrefix(`tax-planning-fna:client:${clientId}:`),
    ]);

    // ── Risk Planning ──
    const riskResult = (() => {
      try {
        if (riskLatestPtr) {
          return { key: 'risk', status: 'published' as const, data: riskLatestPtr };
        }
        return { key: 'risk', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing risk FNA status:', err);
        return { key: 'risk', status: 'error' as const, data: null };
      }
    })();

    // ── Retirement ──
    const retirementResult = (() => {
      try {
        if (retirementLatestPtr) {
          const status = retirementLatestPtr.status === 'published' ? 'published' : 'draft';
          return { key: 'retirement', status: status as 'published' | 'draft', data: retirementLatestPtr };
        }
        return { key: 'retirement', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing retirement FNA status:', err);
        return { key: 'retirement', status: 'error' as const, data: null };
      }
    })();

    // ── Medical Aid ──
    const medicalResult = (() => {
      try {
        const allMedical = [...(medicalRecordsLegacy || []), ...(medicalRecordsNew || [])] as FnaRecord[];
        if (allMedical.length === 0) {
          return { key: 'medical', status: 'not_started' as const, data: null };
        }
        const published = findLatestPublished(allMedical);
        if (published) {
          return { key: 'medical', status: 'published' as const, data: published };
        }
        const draft = findLatestDraft(allMedical);
        if (draft) {
          return { key: 'medical', status: 'draft' as const, data: draft };
        }
        return { key: 'medical', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing medical FNA status:', err);
        return { key: 'medical', status: 'error' as const, data: null };
      }
    })();

    // ── Investment INA ──
    const investmentResult = (() => {
      try {
        const allInvestment = (investmentRecords || []) as FnaRecord[];
        if (allInvestment.length === 0) {
          return { key: 'investment', status: 'not_started' as const, data: null };
        }
        const published = findLatestPublished(allInvestment);
        if (published) {
          return { key: 'investment', status: 'published' as const, data: published };
        }
        const draft = findLatestDraft(allInvestment);
        if (draft) {
          return { key: 'investment', status: 'draft' as const, data: draft };
        }
        return { key: 'investment', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing investment INA status:', err);
        return { key: 'investment', status: 'error' as const, data: null };
      }
    })();

    // ── Estate Planning ──
    const estateResult = (() => {
      try {
        const allEstate = (estateRecords || []) as FnaRecord[];
        if (allEstate.length === 0) {
          return { key: 'estate', status: 'not_started' as const, data: null };
        }
        const published = findLatestPublished(allEstate);
        if (published) {
          return { key: 'estate', status: 'published' as const, data: published };
        }
        const draft = findLatestDraft(allEstate);
        if (draft) {
          return { key: 'estate', status: 'draft' as const, data: draft };
        }
        return { key: 'estate', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing estate FNA status:', err);
        return { key: 'estate', status: 'error' as const, data: null };
      }
    })();

    // ── Tax Planning ──
    const taxPlanningResult = (() => {
      try {
        const allTaxPlanning = (taxPlanningRecords || []) as FnaRecord[];
        if (allTaxPlanning.length === 0) {
          return { key: 'taxPlanning', status: 'not_started' as const, data: null };
        }
        const published = findLatestPublished(allTaxPlanning);
        if (published) {
          return { key: 'taxPlanning', status: 'published' as const, data: published };
        }
        const draft = findLatestDraft(allTaxPlanning);
        if (draft) {
          return { key: 'taxPlanning', status: 'draft' as const, data: draft };
        }
        return { key: 'taxPlanning', status: 'not_started' as const, data: null };
      } catch (err) {
        log.warn('Error processing tax planning FNA status:', err);
        return { key: 'taxPlanning', status: 'error' as const, data: null };
      }
    })();

    const results = [riskResult, medicalResult, retirementResult, investmentResult, estateResult, taxPlanningResult];

    log.info(`✅ Batch FNA status fetched for client ${clientId}: ${results.map(r => `${r.key}=${r.status}`).join(', ')}`);

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: unknown) {
    log.error('❌ Error fetching batch FNA status:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

export default fnaBatchStatusRoutes;