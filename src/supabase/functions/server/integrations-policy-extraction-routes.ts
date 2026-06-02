/**
 * Policy-extraction and provider-terminology routes (Phase 5 Slice F).
 * =====================================================================
 *
 * Extracted verbatim from integrations.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST /policy-extraction/extract         — trigger AI extraction on a policy document
 *   GET  /policy-extraction/result          — get latest extraction result
 *   GET  /policy-extraction/history         — get extraction history for a policy
 *   GET  /policy-extraction/compare         — compare two history entries side-by-side
 *   POST /policy-extraction/apply           — apply extracted fields to policy data
 *   POST /policy-extraction/lock-fields     — lock or unlock schema fields
 *   GET  /policy-extraction/quality-stats   — aggregated quality metrics
 *   POST /policy-extraction/bulk-reextract  — bulk re-extraction for a provider
 *   GET  /provider-terminology              — get provider terminology mapping(s)
 *   POST /provider-terminology              — save a provider terminology mapping
 *
 * @module server/integrations-policy-extraction-routes
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { requireAuth } from './auth-mw.ts';
import type { KvPolicy } from './integrations-types.ts';
import {
  extractPolicyDocument,
  getProviderTerminology,
  saveProviderTerminology,
  getAllProviderTerminologies,
  buildHistoryEntry,
} from './policy-extraction-service.ts';
import type { ProviderTerminologyMap, FieldDiff } from './policy-extraction-types.ts';
import { recalculateClientTotals } from './integrations-derive.ts';

const app = new Hono();
const log = createModuleLogger('integrations-policy-extraction');

// ============================================================================
// POLICY EXTRACTION ENDPOINTS (Phase 2)
// ============================================================================

/**
 * POST /policy-extraction/extract
 * Trigger AI extraction on a policy's attached document.
 * Body: { policyId, clientId }
 */
app.post('/policy-extraction/extract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId } = body;

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    if (!policy.document?.storageKey) {
      return c.json(
        { error: 'No document attached to this policy. Upload a document first.' },
        400,
      );
    }

    // Phase 3: Preserve previous extraction in history before overwriting
    const previousExtraction = policy.extraction;

    if (
      previousExtraction &&
      (previousExtraction.status === 'completed' || previousExtraction.status === 'failed')
    ) {
      // Pass the stored field mappings snapshot for comparison in history
      const previousFieldMappings = policy.lastFieldMappingsSnapshot
        ? policy.lastFieldMappingsSnapshot.map((s) => ({
            canonicalKey: s.k,
            schemaFieldId: s.f,
            schemaFieldName: s.n,
            value: s.v,
            confidence: s.c,
          }))
        : undefined;

      const historyEntry = buildHistoryEntry(
        previousExtraction,
        previousExtraction.appliedFields?.length || 0,
        policy.document?.fileName,
        previousFieldMappings,
      );

      const existingHistory = policy.extractionHistory || [];
      // Keep last 10 history entries to prevent unbounded growth
      const trimmedHistory = [...existingHistory, historyEntry].slice(-10);

      (policies as KvPolicy[])[policyIndex] = {
        ...policy,
        extractionHistory: trimmedHistory,
      };
    }

    // Mark extraction as pending
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction: {
        extractedData: null,
        extractedAt: new Date().toISOString(),
        confidence: 0,
        status: 'pending',
        model: 'gpt-4o',
      },
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    // Run the extraction (this can take 10-30 seconds)
    const { extraction, fieldMappings } = await extractPolicyDocument(policy);

    // Phase 3: Generate diff comparing new extraction against current policy data
    let diff: FieldDiff[] | undefined;
    if (extraction.status === 'completed') {
      const changedFields = fieldMappings.filter((m) => {
        const current = policy.data?.[m.schemaFieldId];
        return (
          current !== undefined &&
          current !== null &&
          current !== '' &&
          String(current) !== String(m.value)
        );
      });

      if (changedFields.length > 0) {
        diff = changedFields.map((m) => ({
          schemaFieldId: m.schemaFieldId,
          fieldName: m.schemaFieldName,
          oldValue: policy.data?.[m.schemaFieldId] ?? null,
          newValue: m.value,
          oldConfidence: 0,
          newConfidence: m.confidence,
          changed: true,
        }));
      }
    }

    // Save the extraction result and field mappings snapshot for future history comparison
    (policies as KvPolicy[])[policyIndex] = {
      ...(policies as KvPolicy[])[policyIndex],
      extraction,
      lastFieldMappingsSnapshot: fieldMappings.slice(0, 50).map((fm) => ({
        k: fm.canonicalKey,
        f: fm.schemaFieldId,
        n: fm.schemaFieldName,
        v: fm.value,
        c: fm.confidence,
      })),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(policiesKey, policies);

    return c.json({
      success: true,
      extraction,
      fieldMappings,
      diff: diff || [],
      historyCount: (policies as KvPolicy[])[policyIndex].extractionHistory?.length || 0,
    });
  } catch (e) {
    log.error('Error extracting policy data:', e);
    return c.json({ error: `Extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/result
 * Get the latest extraction result and field mappings for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/result', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    if (!policy.extraction) {
      return c.json({ error: 'No extraction result available' }, 404);
    }

    return c.json({
      success: true,
      extraction: policy.extraction,
    });
  } catch (e) {
    log.error('Error fetching extraction result:', e);
    return c.json({ error: `Failed to get extraction result: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/history
 * Get the extraction history for a policy.
 * Query params: policyId, clientId
 */
app.get('/policy-extraction/history', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');

    if (!policyId || !clientId) {
      return c.json({ error: 'Missing policyId or clientId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    return c.json({
      success: true,
      history: policy.extractionHistory || [],
      currentExtraction: policy.extraction || null,
    });
  } catch (e) {
    log.error('Error fetching extraction history:', e);
    return c.json({ error: `Failed to get extraction history: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * GET /policy-extraction/compare
 * Compare two extraction history entries side-by-side.
 * Query params: policyId, clientId, leftId, rightId
 * Returns: { fields: ComparisonField[] }
 *
 * If rightId is 'current', compares against the live extraction.
 */
app.get('/policy-extraction/compare', requireAuth, async (c) => {
  try {
    const policyId = c.req.query('policyId');
    const clientId = c.req.query('clientId');
    const leftId = c.req.query('leftId');
    const rightId = c.req.query('rightId');

    if (!policyId || !clientId || !leftId || !rightId) {
      return c.json({ error: 'Missing policyId, clientId, leftId, or rightId' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policy = (policies as KvPolicy[]).find((p: KvPolicy) => p.id === policyId);

    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const history = policy.extractionHistory || [];

    // Resolve left entry
    const leftEntry = history.find((h) => h.id === leftId);
    if (!leftEntry) {
      return c.json({ error: `Left entry '${leftId}' not found in history` }, 404);
    }

    // Resolve right entry — 'current' means the live extraction's stored snapshot
    let rightSnapshot:
      | Array<{ k: string; f: string; n: string; v: unknown; c: number }>
      | undefined;
    let rightMeta: { confidence: number; extractedAt: string } | undefined;

    if (rightId === 'current') {
      rightSnapshot = policy.lastFieldMappingsSnapshot;
      rightMeta = policy.extraction
        ? { confidence: policy.extraction.confidence, extractedAt: policy.extraction.extractedAt }
        : undefined;
    } else {
      const rightEntry = history.find((h) => h.id === rightId);
      if (!rightEntry) {
        return c.json({ error: `Right entry '${rightId}' not found in history` }, 404);
      }
      rightSnapshot = rightEntry.fieldMappingsSnapshot;
      rightMeta = { confidence: rightEntry.confidence, extractedAt: rightEntry.extractedAt };
    }

    const leftSnapshot = leftEntry.fieldMappingsSnapshot;

    // Build comparison fields
    if (!leftSnapshot && !rightSnapshot) {
      return c.json({
        success: true,
        fields: [],
        message:
          'Neither entry has field mapping snapshots. Comparison data is unavailable for extractions before snapshot storage was enabled.',
      });
    }

    const leftMap = new Map((leftSnapshot || []).map((s) => [s.f, s]));
    const rightMap = new Map((rightSnapshot || []).map((s) => [s.f, s]));
    const allFieldIds = new Set([...leftMap.keys(), ...rightMap.keys()]);

    const fields: Array<{
      fieldName: string;
      schemaFieldId: string;
      leftValue: unknown;
      rightValue: unknown;
      leftConfidence: number;
      rightConfidence: number;
      changed: boolean;
      confidenceDelta: number;
    }> = [];

    for (const fieldId of allFieldIds) {
      const left = leftMap.get(fieldId);
      const right = rightMap.get(fieldId);

      const leftVal = left?.v ?? null;
      const rightVal = right?.v ?? null;
      const leftConf = left?.c ?? 0;
      const rightConf = right?.c ?? 0;

      fields.push({
        fieldName: right?.n || left?.n || fieldId,
        schemaFieldId: fieldId,
        leftValue: leftVal,
        rightValue: rightVal,
        leftConfidence: leftConf,
        rightConfidence: rightConf,
        changed: String(leftVal) !== String(rightVal),
        confidenceDelta: rightConf - leftConf,
      });
    }

    // Sort: changed first, then by name
    fields.sort((a, b) => {
      if (a.changed !== b.changed) return a.changed ? -1 : 1;
      return a.fieldName.localeCompare(b.fieldName);
    });

    return c.json({
      success: true,
      fields,
      leftMeta: { confidence: leftEntry.confidence, extractedAt: leftEntry.extractedAt },
      rightMeta,
    });
  } catch (e) {
    log.error('Error comparing extractions:', e);
    return c.json({ error: `Comparison failed: ${getErrMsg(e)}` }, 500);
  }
});

function hasExtractedPolicyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

/**
 * POST /policy-extraction/apply
 * Apply selected extracted fields to the policy's data.
 * Body: { policyId, clientId, fieldsToApply: { schemaFieldId: value }[] }
 */
app.post('/policy-extraction/apply', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldsToApply } = body;

    if (!policyId || !clientId || !fieldsToApply || typeof fieldsToApply !== 'object') {
      return c.json({ error: 'Missing policyId, clientId, or fieldsToApply' }, 400);
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];

    // Merge extracted fields into the policy data (skip locked fields)
    const updatedData = { ...policy.data };
    const appliedFieldIds: string[] = [];
    const skippedLockedIds: string[] = [];
    const skippedEmptyIds: string[] = [];
    const lockedSet = new Set(policy.lockedFields || []);

    for (const [fieldId, value] of Object.entries(fieldsToApply)) {
      if (lockedSet.has(fieldId)) {
        skippedLockedIds.push(fieldId);
        continue;
      }
      if (!hasExtractedPolicyValue(value)) {
        skippedEmptyIds.push(fieldId);
        continue;
      }
      updatedData[fieldId] = value;
      appliedFieldIds.push(fieldId);
    }

    // Update the policy with the new data and mark extraction as applied
    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      data: updatedData,
      extraction: policy.extraction
        ? {
            ...policy.extraction,
            appliedAt: new Date().toISOString(),
            appliedFields: appliedFieldIds,
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);
    await recalculateClientTotals(clientId);

    log.info('Extracted data applied to policy', {
      policyId,
      fieldsApplied: appliedFieldIds.length,
    });

    return c.json({
      success: true,
      appliedFields: appliedFieldIds,
      skippedLockedFields: skippedLockedIds,
      skippedEmptyFields: skippedEmptyIds,
      policy: (policies as KvPolicy[])[policyIndex],
    });
  } catch (e) {
    log.error('Error applying extracted data:', e);
    return c.json({ error: `Failed to apply extracted data: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /policy-extraction/lock-fields
 * Lock or unlock schema fields to protect them from AI extraction overwrite.
 * Body: { policyId, clientId, fieldIds: string[], action: 'lock' | 'unlock' }
 */
app.post('/policy-extraction/lock-fields', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { policyId, clientId, fieldIds, action } = body;

    if (
      !policyId ||
      !clientId ||
      !Array.isArray(fieldIds) ||
      !['lock', 'unlock'].includes(action)
    ) {
      return c.json(
        {
          error: 'Missing or invalid policyId, clientId, fieldIds (array), or action (lock|unlock)',
        },
        400,
      );
    }

    const policiesKey = `policies:client:${clientId}`;
    const policies = (await kv.get(policiesKey)) || [];
    const policyIndex = (policies as KvPolicy[]).findIndex((p: KvPolicy) => p.id === policyId);

    if (policyIndex === -1) {
      return c.json({ error: 'Policy not found' }, 404);
    }

    const policy = (policies as KvPolicy[])[policyIndex];
    const currentLocked = new Set(policy.lockedFields || []);

    if (action === 'lock') {
      for (const fid of fieldIds) currentLocked.add(fid);
    } else {
      for (const fid of fieldIds) currentLocked.delete(fid);
    }

    const updatedLockedFields = Array.from(currentLocked);

    (policies as KvPolicy[])[policyIndex] = {
      ...policy,
      lockedFields: updatedLockedFields,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(policiesKey, policies);

    log.info('Policy field locks updated', {
      policyId,
      action,
      fieldIds,
      totalLocked: updatedLockedFields.length,
    });

    return c.json({
      success: true,
      lockedFields: updatedLockedFields,
    });
  } catch (e) {
    log.error('Error updating field locks:', e);
    return c.json({ error: `Failed to update field locks: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// PROVIDER TERMINOLOGY ENDPOINTS (Phase 2)
// ============================================================================

/**
 * GET /provider-terminology
 * Get terminology mapping for a specific provider, or all provider mappings.
 * Query params: providerId (optional — if omitted, returns all)
 */
app.get('/provider-terminology', requireAuth, async (c) => {
  try {
    const providerId = c.req.query('providerId');

    if (providerId) {
      const map = await getProviderTerminology(providerId);
      return c.json({ success: true, terminology: map });
    }

    const all = await getAllProviderTerminologies();
    return c.json({ success: true, terminologies: all });
  } catch (e) {
    log.error('Error fetching provider terminology:', e);
    return c.json({ error: `Failed to get terminology: ${getErrMsg(e)}` }, 500);
  }
});

/**
 * POST /provider-terminology
 * Save or update a provider's terminology mapping.
 * Body: ProviderTerminologyMap
 */
app.post('/provider-terminology', requireAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.providerId || !body.providerName) {
      return c.json({ error: 'Missing providerId or providerName' }, 400);
    }

    const map: ProviderTerminologyMap = {
      providerId: body.providerId,
      providerName: body.providerName,
      benefitMappings: body.benefitMappings || {},
      productMappings: body.productMappings || {},
      updatedAt: new Date().toISOString(),
      updatedBy: body.updatedBy || 'admin',
    };

    await saveProviderTerminology(map);

    return c.json({ success: true, terminology: map });
  } catch (e) {
    log.error('Error saving provider terminology:', e);
    return c.json({ error: `Failed to save terminology: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// EXTRACTION QUALITY STATS ENDPOINT
// ============================================================================

/**
 * GET /policy-extraction/quality-stats
 * Aggregated extraction quality metrics across all policies.
 * Returns: per-provider stats, overall stats, low-confidence field frequency,
 *          and extraction timeline data.
 */
app.get('/policy-extraction/quality-stats', requireAuth, async (c) => {
  try {
    // Fetch all client policy keys
    const allPolicyEntries = await kv.getByPrefix('policies:client:');

    interface ProviderStats {
      providerId: string;
      providerName: string;
      totalPolicies: number;
      withDocuments: number;
      withExtractions: number;
      completedExtractions: number;
      failedExtractions: number;
      avgConfidence: number;
      confidenceSum: number;
      totalFieldsMapped: number;
      totalWarnings: number;
      lockedFieldCount: number;
    }

    const providerMap = new Map<string, ProviderStats>();
    const fieldConfidenceMap = new Map<
      string,
      { fieldName: string; totalConfidence: number; count: number; lowCount: number }
    >();
    const timelineEntries: Array<{
      date: string;
      confidence: number;
      provider: string;
      status: string;
    }> = [];
    let totalPolicies = 0;
    let totalWithDocs = 0;
    let totalWithExtractions = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalLockedFields = 0;
    let overallConfidenceSum = 0;

    for (const entry of allPolicyEntries) {
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];
      for (const policy of policies) {
        if (policy.archived) continue;
        totalPolicies++;

        // Get or create provider stats
        let pStats = providerMap.get(policy.providerId);
        if (!pStats) {
          pStats = {
            providerId: policy.providerId,
            providerName: policy.providerName,
            totalPolicies: 0,
            withDocuments: 0,
            withExtractions: 0,
            completedExtractions: 0,
            failedExtractions: 0,
            avgConfidence: 0,
            confidenceSum: 0,
            totalFieldsMapped: 0,
            totalWarnings: 0,
            lockedFieldCount: 0,
          };
          providerMap.set(policy.providerId, pStats);
        }
        pStats.totalPolicies++;

        if (policy.document) {
          totalWithDocs++;
          pStats.withDocuments++;
        }

        if (policy.lockedFields?.length) {
          totalLockedFields += policy.lockedFields.length;
          pStats.lockedFieldCount += policy.lockedFields.length;
        }

        if (policy.extraction) {
          totalWithExtractions++;
          pStats.withExtractions++;

          if (policy.extraction.status === 'completed') {
            totalCompleted++;
            pStats.completedExtractions++;
            pStats.confidenceSum += policy.extraction.confidence;
            overallConfidenceSum += policy.extraction.confidence;
            pStats.totalWarnings += policy.extraction.validationWarnings?.length || 0;

            // Timeline entry
            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: policy.extraction.confidence,
              provider: policy.providerName,
              status: 'completed',
            });

            // Field-level confidence tracking from snapshot
            if (policy.lastFieldMappingsSnapshot) {
              pStats.totalFieldsMapped += policy.lastFieldMappingsSnapshot.length;
              for (const fm of policy.lastFieldMappingsSnapshot) {
                let fStats = fieldConfidenceMap.get(fm.f);
                if (!fStats) {
                  fStats = { fieldName: fm.n, totalConfidence: 0, count: 0, lowCount: 0 };
                  fieldConfidenceMap.set(fm.f, fStats);
                }
                fStats.totalConfidence += fm.c;
                fStats.count++;
                if (fm.c < 0.5) fStats.lowCount++;
              }
            }
          } else if (policy.extraction.status === 'failed') {
            totalFailed++;
            pStats.failedExtractions++;

            timelineEntries.push({
              date: policy.extraction.extractedAt,
              confidence: 0,
              provider: policy.providerName,
              status: 'failed',
            });
          }
        }
      }
    }

    // Compute averages
    const providerStats = Array.from(providerMap.values()).map((ps) => ({
      ...ps,
      avgConfidence:
        ps.completedExtractions > 0
          ? Math.round((ps.confidenceSum / ps.completedExtractions) * 100) / 100
          : 0,
      successRate:
        ps.withExtractions > 0
          ? Math.round((ps.completedExtractions / ps.withExtractions) * 100 * 10) / 10
          : 0,
    }));

    // Sort providers by extraction count descending
    providerStats.sort((a, b) => b.withExtractions - a.withExtractions);

    // Low-confidence fields (fields that frequently have confidence < 0.5)
    const lowConfidenceFields = Array.from(fieldConfidenceMap.entries())
      .map(([fieldId, s]) => ({
        fieldId,
        fieldName: s.fieldName,
        avgConfidence: Math.round((s.totalConfidence / s.count) * 100) / 100,
        occurrences: s.count,
        lowConfidenceCount: s.lowCount,
        lowConfidenceRate: Math.round((s.lowCount / s.count) * 100),
      }))
      .filter((f) => f.lowConfidenceCount > 0)
      .sort((a, b) => b.lowConfidenceRate - a.lowConfidenceRate)
      .slice(0, 15);

    // Sort timeline chronologically and limit
    timelineEntries.sort((a, b) => a.date.localeCompare(b.date));

    return c.json({
      success: true,
      overview: {
        totalPolicies,
        totalWithDocuments: totalWithDocs,
        totalExtractions: totalWithExtractions,
        completedExtractions: totalCompleted,
        failedExtractions: totalFailed,
        avgConfidence:
          totalCompleted > 0 ? Math.round((overallConfidenceSum / totalCompleted) * 100) / 100 : 0,
        successRate:
          totalWithExtractions > 0
            ? Math.round((totalCompleted / totalWithExtractions) * 100 * 10) / 10
            : 0,
        totalLockedFields,
      },
      providerStats,
      lowConfidenceFields,
      timeline: timelineEntries.slice(-50),
    });
  } catch (e) {
    log.error('Error computing extraction quality stats:', e);
    return c.json({ error: `Failed to compute quality stats: ${getErrMsg(e)}` }, 500);
  }
});

// ============================================================================
// BULK RE-EXTRACTION ENDPOINT (Phase 3)
// ============================================================================

/**
 * POST /policy-extraction/bulk-reextract
 * Find all policies for a given provider that have documents attached
 * and queue them for re-extraction. Supports dry-run mode (default: true).
 * Body: { providerId, dryRun?: boolean }
 */
app.post('/policy-extraction/bulk-reextract', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { providerId, dryRun = true } = body;

    if (!providerId) {
      return c.json({ error: 'Missing providerId' }, 400);
    }

    // Scan all client policy keys to find policies with this provider
    const allClientEntries = await kv.getByPrefix('policies:client:');
    const candidates: Array<{
      clientId: string;
      policyId: string;
      providerName: string;
      fileName: string;
      hasExistingExtraction: boolean;
    }> = [];

    for (const entry of allClientEntries || []) {
      // getByPrefix returns raw values — each is the array of KvPolicy[]
      const policies = (Array.isArray(entry) ? entry : []) as KvPolicy[];

      for (const policy of policies) {
        if (policy.providerId === providerId && policy.document?.storageKey && !policy.archived) {
          candidates.push({
            clientId: policy.clientId,
            policyId: policy.id,
            providerName: policy.providerName,
            fileName: policy.document.fileName,
            hasExistingExtraction: !!policy.extraction?.extractedData,
          });
        }
      }
    }

    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        candidateCount: candidates.length,
        candidates: candidates.map((cand) => ({
          policyId: cand.policyId,
          fileName: cand.fileName,
          hasExistingExtraction: cand.hasExistingExtraction,
        })),
        message: `Found ${candidates.length} policies with documents for this provider. Set dryRun: false to execute.`,
      });
    }

    // Live run — stream NDJSON progress events as each policy is processed
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        let successCount = 0;
        let failCount = 0;
        const total = candidates.length;

        send({ type: 'start', total, providerId });

        for (let i = 0; i < candidates.length; i++) {
          const cand = candidates[i];
          send({
            type: 'progress',
            current: i + 1,
            total,
            policyId: cand.policyId,
            fileName: cand.fileName,
            status: 'processing',
          });

          try {
            const policiesKey = `policies:client:${cand.clientId}`;
            const policies = ((await kv.get(policiesKey)) || []) as KvPolicy[];
            const policyIndex = policies.findIndex((p) => p.id === cand.policyId);

            if (policyIndex === -1) {
              send({
                type: 'result',
                current: i + 1,
                total,
                policyId: cand.policyId,
                fileName: cand.fileName,
                status: 'skipped',
                error: 'Policy not found',
              });
              continue;
            }

            const policy = policies[policyIndex];

            // Preserve previous extraction in history with field mappings snapshot
            if (
              policy.extraction &&
              (policy.extraction.status === 'completed' || policy.extraction.status === 'failed')
            ) {
              const prevFM = policy.lastFieldMappingsSnapshot
                ? policy.lastFieldMappingsSnapshot.map((s) => ({
                    canonicalKey: s.k,
                    schemaFieldId: s.f,
                    schemaFieldName: s.n,
                    value: s.v,
                    confidence: s.c,
                  }))
                : undefined;

              const historyEntry = buildHistoryEntry(
                policy.extraction,
                policy.extraction.appliedFields?.length || 0,
                policy.document?.fileName,
                prevFM,
              );
              const existingHistory = policy.extractionHistory || [];
              policies[policyIndex] = {
                ...policy,
                extractionHistory: [...existingHistory, historyEntry].slice(-10),
              };
            }

            const { extraction, fieldMappings: newFM } = await extractPolicyDocument(policy);

            policies[policyIndex] = {
              ...policies[policyIndex],
              extraction,
              lastFieldMappingsSnapshot: newFM.slice(0, 50).map((fm) => ({
                k: fm.canonicalKey,
                f: fm.schemaFieldId,
                n: fm.schemaFieldName,
                v: fm.value,
                c: fm.confidence,
              })),
              updatedAt: new Date().toISOString(),
            };
            await kv.set(policiesKey, policies);

            successCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: extraction.status,
              confidence: extraction.confidence,
            });
          } catch (err) {
            failCount++;
            send({
              type: 'result',
              current: i + 1,
              total,
              policyId: cand.policyId,
              fileName: cand.fileName,
              status: 'failed',
              error: getErrMsg(err),
            });
          }
        }

        log.info('Bulk re-extraction complete', {
          providerId,
          total,
          success: successCount,
          failed: failCount,
        });

        send({
          type: 'complete',
          totalProcessed: total,
          successCount,
          failCount,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    log.error('Bulk re-extraction error:', e);
    return c.json({ error: `Bulk re-extraction failed: ${getErrMsg(e)}` }, 500);
  }
});

export default app;
