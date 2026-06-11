/**
 * Portal worker — per-policy queue processing.
 * ============================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Claims queued policy items one by one, drives
 * search → extract → documents → complete for each, and stages the run.
 * Behaviour-preserving move, plus the strictly observational shadow
 * LLM-extraction comparison (see shadow-extraction.mjs).
 */
import {
  claimNextPolicyItem,
  stageCompletedPolicyItems,
  updateJob,
  updatePolicyItem,
} from './api.mjs';
import { itemWarnings } from './state.mjs';
import { publishLiveView } from './live-view.mjs';
import { writeDebugArtifact } from './debug-artifacts.mjs';
import { searchPolicyByNumber } from './search.mjs';
import { buildExtractionFieldList, countVisibleValues, extractPolicyRecord } from './extraction.mjs';
import { buildDocumentArtifacts, processDocumentArtifacts } from './documents.mjs';
import {
  describeShadowComparison,
  runShadowExtractionComparison,
} from './shadow-extraction.mjs';

export async function processPolicyQueue(page, flow, config, jobMode, brain, providerAdapter) {
  let completed = 0;
  let failed = 0;
  const failureSummaries = [];

  for (;;) {
    const item = await claimNextPolicyItem();
    if (!item) break;
    itemWarnings.delete(item.id);

    try {
      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: 'searching_policy',
        message: `Searching provider portal for ${item.clientName} / ${item.policyNumber}.`,
      });
      await publishLiveView(page, {
        force: true,
        note: `Searching provider portal for ${item.clientName} / ${item.policyNumber}.`,
      });

      await searchPolicyByNumber(page, flow, item, brain);
      await publishLiveView(page, {
        force: true,
        note: `Policy search landed on ${item.clientName} / ${item.policyNumber}.`,
      });

      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: 'extracting_policy',
        message: `Extracting values for ${item.clientName} / ${item.policyNumber}.`,
      });
      await publishLiveView(page, {
        force: true,
        note: `Extracting values for ${item.clientName} / ${item.policyNumber}.`,
      });

      const { rawData, extractedData, extractedFieldNames } = await extractPolicyRecord(page, flow, config, item, providerAdapter);
      console.log(`Portal item extracted ${item.clientName} / ${item.policyNumber}: ${extractedFieldNames.length ? extractedFieldNames.join(', ') : 'no mapped field names'}`);

      // Shadow LLM extraction is observe-only: failures are logged and the
      // item continues exactly as if the comparison never ran.
      let shadowExtraction = null;
      try {
        shadowExtraction = await runShadowExtractionComparison(page, flow, item, {
          fields: buildExtractionFieldList(flow, config),
          rawData,
        });
        if (shadowExtraction) {
          console.log(`Portal item ${item.clientName} / ${item.policyNumber}: ${describeShadowComparison(shadowExtraction)}`);
          await writeDebugArtifact(item, 'shadow-extraction-comparison', shadowExtraction);
        }
      } catch (shadowError) {
        console.warn(`Shadow extraction comparison failed for ${item.clientName} / ${item.policyNumber}: ${shadowError instanceof Error ? shadowError.message : String(shadowError)}`);
      }

      await writeDebugArtifact(item, 'extracted-row', {
        pageUrl: page.url(),
        extractedFieldNames,
        rawData,
        documentRequested: buildDocumentArtifacts(flow).length > 0,
      });
      const artifactResult = await processDocumentArtifacts(page, flow, item, jobMode, providerAdapter);
      const attachedDocument = artifactResult.attachedDocuments[0]?.document || null;
      const artifactFailures = artifactResult.statuses.filter((status) => status.status === 'failed');
      const artifactMessages = artifactResult.statuses.map((status) => {
        if (status.status === 'attached') return `${status.label} attached (${status.fileName}).`;
        if (status.status === 'validated') return `${status.label} found (${status.fileName}); not attached during dry run.`;
        if (status.status === 'failed') return `${status.label} failed: ${status.error}`;
        return '';
      }).filter(Boolean);

      await updatePolicyItem(item.id, 'completed', {
        currentStep: 'completed',
        message: [
          `Extracted ${countVisibleValues(rawData)} mapped value(s).`,
          extractedFieldNames?.length ? `Fields: ${extractedFieldNames.slice(0, 6).join(', ')}.` : '',
          ...artifactMessages,
        ].filter(Boolean).join(' '),
        rawData,
        extractedData,
        matchConfidence: 'high',
        documentAttached: artifactResult.statuses.some((status) => status.status === 'attached'),
        documentFileName: attachedDocument?.fileName,
        documentUpdatedAt: attachedDocument?.uploadDate,
        artifactStatuses: artifactResult.statuses,
        ...(shadowExtraction ? { shadowExtraction } : {}),
        warning: artifactFailures.length > 0
          ? artifactFailures.map((status) => `${status.label}: ${status.error}`).join(' ')
          : undefined,
      });
      await publishLiveView(page, {
        force: true,
        note: `Completed ${item.clientName} / ${item.policyNumber}.`,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failureSummary = `${item.clientName} / ${item.policyNumber}: ${errorMessage}`;
      failureSummaries.push(failureSummary);
      console.error(`Portal policy item failed: ${failureSummary}`);
      await updatePolicyItem(item.id, 'failed', {
        currentStep: 'failed',
        message: `Could not complete ${item.clientName} / ${item.policyNumber}.`,
        error: errorMessage,
        matchConfidence: 'low',
      }).catch(() => undefined);
      await publishLiveView(page, {
        force: true,
        note: `Failed ${item.clientName} / ${item.policyNumber}: ${errorMessage}`.slice(0, 500),
      }).catch(() => undefined);
    }
  }

  if (jobMode === 'dry-run') {
    await updateJob('dry_run_ready', {
      currentStep: 'dry_run_ready',
      message: `Dry run finished. ${completed} policy${completed === 1 ? '' : 'ies'} extracted, ${failed} failed. No client policies were updated.`,
      extractedRows: completed,
    });
    return;
  }

  if (completed === 0) {
    const firstFailure = failureSummaries[0] || 'The provider workflow did not complete any policy items.';
    await updateJob('failed', {
      currentStep: 'failed',
      message: `Portal run finished with 0 completed policies and ${failed} failed.`,
      error: `No policy updates were staged. First failure: ${firstFailure}`.slice(0, 1000),
      extractedRows: 0,
    });
    throw new Error(`All ${failed} policy item(s) failed before staging. First failure: ${firstFailure}`);
  }

  await updateJob('staging', {
    currentStep: 'staging_completed_policy_items',
    message: `Staging ${completed} completed policy update${completed === 1 ? '' : 's'} for review.`,
    extractedRows: completed,
  });
  await publishLiveView(page, {
    force: true,
    note: `Staging ${completed} completed policy update${completed === 1 ? '' : 's'} for review.`,
  });
  await stageCompletedPolicyItems();
}
