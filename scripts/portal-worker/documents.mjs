/**
 * Portal worker — document artifact downloads + uploads.
 * ======================================================
 *
 * Extracted verbatim from scripts/provider-portal-worker.mjs (worker
 * decomposition). Owns download-action discovery, the per-artifact download
 * steps, PDF validation, and policy/estate document uploads.
 * Behaviour-preserving move.
 */
import { readFile, unlink } from 'node:fs/promises';
import { workerSecret } from './config.mjs';
import { apiUpload, updatePolicyItem, workerJobPath } from './api.mjs';
import { writeDebugArtifact, writeDebugScreenshot } from './debug-artifacts.mjs';
import {
  evaluateWithNavigationRetry,
  providerAdapterRuntime,
  splitLabels,
} from './page-utils.mjs';

export async function findClickableByIntent(page, selector, labels = []) {
  if (selector) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) return locator;
  }

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const labelRegex = new RegExp(escaped, 'i');
    const candidates = [
      page.getByRole('link', { name: labelRegex }).first(),
      page.getByRole('button', { name: labelRegex }).first(),
      page.locator('a, button, [role="link"], [role="button"]').filter({ hasText: labelRegex }).first(),
    ];

    for (const locator of candidates) {
      if (await locator.isVisible({ timeout: 800 }).catch(() => false)) return locator;
    }
  }

  const inferredSelector = await evaluateWithNavigationRetry(page, (labelList) => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    const labelsText = normalise((labelList || []).join(' '));
    const wantsDownload = /download|pdf|statement|schedule/i.test(labelsText);
    if (!wantsDownload) return '';

    const clickables = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'))
      .filter(isVisible);
    const candidate = clickables.find((el) => {
      const text = [
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('download'),
        el.getAttribute('data-testid'),
        el.getAttribute('mattooltip'),
        el.getAttribute('ng-reflect-message'),
        ...Array.from(el.querySelectorAll('mat-icon, svg, use, i')).map((icon) => [
          icon.textContent,
          icon.getAttribute('aria-label'),
          icon.getAttribute('title'),
          icon.getAttribute('data-icon'),
          icon.getAttribute('href'),
          icon.getAttribute('xlink:href'),
          icon.getAttribute('class'),
        ].filter(Boolean).join(' ')),
      ].filter(Boolean).join(' ');
      return /download|file_download|cloud_download|picture_as_pdf|pdf|statement/i.test(text);
    }) || clickables
      .map((el) => ({ el, rect: el.getBoundingClientRect(), text: normalise(el.textContent) }))
      .filter((entry) =>
        entry.rect.top >= 80
        && entry.rect.top <= 280
        && entry.rect.left >= window.innerWidth * 0.75
        && entry.rect.width >= 24
        && entry.rect.height >= 24
        && entry.el.querySelector('svg, mat-icon, i')
        && !/zar|last\s+1\s+year|agra|account|client/i.test(entry.text)
      )
      .sort((a, b) => b.rect.left - a.rect.left)[0]?.el;
    if (!candidate) return '';

    const id = `nw-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-nw-worker-clickable', id);
    return `[data-nw-worker-clickable="${id}"]`;
  }, labels).catch(() => '');

  if (inferredSelector) {
    const locator = page.locator(inferredSelector).first();
    if (await locator.isVisible({ timeout: 800 }).catch(() => false)) return locator;
  }

  throw new Error('Could not confidently find the policy schedule download action.');
}

export function safeDownloadedPdfName(item, suggestedFilename, artifactId = 'policy_schedule') {
  const baseName = String(suggestedFilename || `${item.policyNumber || item.id}-${artifactId}.pdf`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName || 'policy_schedule'}.pdf`;
}

export function normaliseArtifactStepLabels(step, fallback = []) {
  return splitLabels(step?.labels || step?.text || fallback);
}

export function buildDocumentArtifacts(flow) {
  const configuredArtifacts = Array.isArray(flow.documentArtifacts)
    ? flow.documentArtifacts.filter((artifact) => artifact && artifact.enabled !== false)
    : [];
  if (configuredArtifacts.length > 0) return configuredArtifacts;

  const policySchedule = flow.policySchedule || {};
  if (!policySchedule.enabled) return [];
  const timeout = Number(policySchedule.waitForDownloadMs || 30000);
  return [{
    id: 'policy_schedule',
    label: 'Policy schedule',
    enabled: true,
    required: policySchedule.required === true,
    attachTo: 'matched_policy',
    documentType: policySchedule.documentType || 'policy_schedule',
    fileType: 'pdf',
    steps: [
      {
        action: 'click',
        target: 'download_button',
        selector: policySchedule.downloadSelector,
        labels: splitLabels(policySchedule.downloadLabels || ['Policy schedule', 'Download', 'PDF', 'Statement']),
        timeoutMs: Math.min(timeout, 10000),
      },
      {
        action: 'click_menu_item',
        target: 'menu_item',
        labels: splitLabels(policySchedule.downloadMenuLabels || ['Download PDF with company logo', 'Download PDF without company logo']),
        timeoutMs: timeout,
      },
      {
        action: 'wait_for_download',
        timeoutMs: timeout,
      },
    ],
  }];
}

export function artifactStatus(artifact, status, patch = {}) {
  return {
    id: String(artifact.id || 'document'),
    label: String(artifact.label || artifact.id || 'Document'),
    status,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

export function mergeArtifactStatus(statuses, nextStatus) {
  return [
    ...statuses.filter((status) => status.id !== nextStatus.id),
    nextStatus,
  ];
}

export async function captureVisibleDocumentActions(page) {
  return evaluateWithNavigationRetry(page, () => {
    const normalise = (value) => String(value || '').trim().replace(/\s+/g, ' ');
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    };
    return Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"], [role="menuitem"], [tabindex]'))
      .filter(isVisible)
      .slice(0, 80)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          title: el.getAttribute('title') || '',
          text: normalise(el.textContent || '').slice(0, 200),
          className: String(el.getAttribute('class') || '').slice(0, 160),
          rect: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
  }).catch(() => []);
}

export async function findDocumentClickTarget(page, artifact, step, providerAdapter) {
  const labels = normaliseArtifactStepLabels(step, ['Policy schedule', 'Download', 'PDF', 'Statement']);
  const adapterTarget = await providerAdapter?.findDocumentClickTarget?.(page, {
    artifact,
    step,
    labels,
  }, providerAdapterRuntime());
  if (adapterTarget) {
    return adapterTarget;
  }
  return findClickableByIntent(page, step?.selector || '', labels);
}

export async function clickDocumentMenuItem(page, artifact, step, item) {
  await page.waitForTimeout(600);
  await writeDebugScreenshot(page, item, `${artifact.id}-menu-open`);
  const labels = normaliseArtifactStepLabels(step, ['Download PDF with company logo', 'Download PDF']);
  const menuAction = await findClickableByIntent(page, step?.selector || '', labels);
  if (!menuAction) {
    const visibleActions = await captureVisibleDocumentActions(page);
    await writeDebugArtifact(item, `${artifact.id}-menu-candidates`, {
      pageUrl: page.url(),
      labels,
      visibleActions,
    });
    throw new Error(`Could not find document menu item for ${artifact.label}. Expected one of: ${labels.join(', ')}`);
  }
  return menuAction.click();
}

export async function runDocumentDownloadSteps(page, artifact, item, providerAdapter) {
  const steps = Array.isArray(artifact.steps) ? artifact.steps : [];
  const clickStep = steps.find((step) => step.action === 'click') || {};
  const menuStep = steps.find((step) => step.action === 'click_menu_item');
  const downloadStep = steps.find((step) => step.action === 'wait_for_download') || {};
  const timeout = Number(downloadStep.timeoutMs || menuStep?.timeoutMs || clickStep.timeoutMs || 30000);
  const directTimeout = Math.min(Number(clickStep.timeoutMs || 5000), 10000);
  const clickTarget = await findDocumentClickTarget(page, artifact, clickStep, providerAdapter);
  if (!clickTarget) {
    const visibleActions = await captureVisibleDocumentActions(page);
    await writeDebugArtifact(item, `${artifact.id}-download-action-candidates`, {
      pageUrl: page.url(),
      labels: normaliseArtifactStepLabels(clickStep),
      visibleActions,
    });
    throw new Error(`Could not find document download action for ${artifact.label}.`);
  }

  let download;
  try {
    const directDownloadPromise = page.waitForEvent('download', { timeout: directTimeout });
    await clickTarget.click();
    download = await directDownloadPromise;
  } catch {
    if (!menuStep) {
      throw new Error(`${artifact.label} did not start a download after clicking the document action.`);
    }
    const menuDownloadPromise = page.waitForEvent('download', { timeout });
    await clickDocumentMenuItem(page, artifact, menuStep, item);
    download = await menuDownloadPromise;
  }

  const failure = await download.failure();
  if (failure) throw new Error(`Provider PDF download failed: ${failure}`);

  const filePath = await download.path();
  if (!filePath) {
    throw new Error('Provider created a PDF download, but Playwright could not access the file path.');
  }

  return {
    filePath,
    fileName: safeDownloadedPdfName(item, download.suggestedFilename(), artifact.id),
  };
}

export async function uploadPolicyDocumentArtifact(item, artifact, downloaded) {
  if (!workerSecret) {
    throw new Error('Policy document attachment requires NW_PORTAL_WORKER_SECRET live worker mode.');
  }

  const buffer = await readFile(downloaded.filePath);
  const signature = buffer.subarray(0, 5).toString('utf8');
  if (!signature.startsWith('%PDF-')) {
    throw new Error(`Downloaded ${artifact.label} is not a valid PDF.`);
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), downloaded.fileName);
  formData.append('fileName', downloaded.fileName);
  formData.append('documentType', artifact.documentType || 'policy_schedule');

  return apiUpload(workerJobPath(`/items/${item.id}/policy-document`), formData);
}

export async function uploadEstateDocumentArtifact(item, artifact, downloaded) {
  if (!workerSecret) {
    throw new Error('Estate document attachment requires NW_PORTAL_WORKER_SECRET live worker mode.');
  }

  const buffer = await readFile(downloaded.filePath);
  const signature = buffer.subarray(0, 5).toString('utf8');
  if (!signature.startsWith('%PDF-')) {
    throw new Error(`Downloaded ${artifact.label} is not a valid PDF.`);
  }

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), downloaded.fileName);
  formData.append('fileName', downloaded.fileName);
  formData.append('documentType', artifact.documentType || 'other');
  formData.append('artifactId', artifact.id || 'estate_document');
  formData.append('artifactLabel', artifact.label || 'Estate document');
  formData.append('title', artifact.documentType === 'last_will_scanned'
    ? `Last Will & Testament - ${item.clientName}`
    : `${artifact.label || 'Estate document'} - ${item.clientName}`);

  return apiUpload(workerJobPath(`/items/${item.id}/estate-document`), formData);
}

export async function processDocumentArtifacts(page, flow, item, jobMode, providerAdapter) {
  const artifacts = buildDocumentArtifacts(flow);
  const statuses = artifacts.length > 0
    ? artifacts.map((artifact) => artifactStatus(artifact, 'not_requested'))
    : [];
  const attachedDocuments = [];

  for (const artifact of artifacts) {
    let downloaded = null;
    try {
      const started = artifactStatus(artifact, 'started');
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, started));
      await updatePolicyItem(item.id, 'in_progress', {
        currentStep: jobMode === 'dry-run' ? `checking_${artifact.id}` : `attaching_${artifact.id}`,
        message: jobMode === 'dry-run'
          ? `Checking ${artifact.label} for ${item.clientName} / ${item.policyNumber}.`
          : `Downloading and attaching ${artifact.label} for ${item.clientName} / ${item.policyNumber}.`,
        artifactStatuses: statuses,
      });

      downloaded = await runDocumentDownloadSteps(page, artifact, item, providerAdapter);
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'downloaded', {
        fileName: downloaded.fileName,
      })));

      if (jobMode === 'dry-run') {
        statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'validated', {
          fileName: downloaded.fileName,
          error: 'Found during dry run; not attached.',
        })));
        continue;
      }

      const upload = artifact.attachTo === 'estate_documents'
        ? await uploadEstateDocumentArtifact(item, artifact, downloaded)
        : await uploadPolicyDocumentArtifact(item, artifact, downloaded);
      const document = upload.document || null;
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'attached', {
        fileName: document?.fileName || downloaded.fileName,
        documentId: document?.id,
      })));
      if (document) attachedDocuments.push({ artifact, document });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statuses.splice(0, statuses.length, ...mergeArtifactStatus(statuses, artifactStatus(artifact, 'failed', {
        error: message,
      })));
      await writeDebugArtifact(item, `${artifact.id}-artifact-failure`, {
        pageUrl: page.url(),
        artifact,
        error: message,
        visibleActions: await captureVisibleDocumentActions(page),
      });
      await writeDebugScreenshot(page, item, `${artifact.id}-artifact-failure`);
    } finally {
      if (downloaded?.filePath) {
        await unlink(downloaded.filePath).catch(() => undefined);
      }
    }
  }

  return { statuses, attachedDocuments };
}
