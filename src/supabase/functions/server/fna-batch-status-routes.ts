/**
 * FNA Batch Status Routes
 *
 * Returns latest FNA + client intake overlay status for all domains in one request.
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse, isFnaAdminRole } from './fna-auth.ts';
import { getIntakeOverlayForDomain, type FnaIntakeDomain } from './fna-intake-service.ts';

const fnaBatchStatusRoutes = new Hono();
const log = createModuleLogger('fna-batch-status');

interface FnaRecord {
  id?: string;
  status?: string;
  version?: number;
  publishedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
}

type BatchFnaStatus =
  | 'published'
  | 'draft'
  | 'client_draft'
  | 'submitted'
  | 'not_started'
  | 'error';

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

function findLatestDraft(records: FnaRecord[]): FnaRecord | null {
  const drafts = records.filter((r) => r.status === 'draft');
  if (drafts.length === 0) return null;

  drafts.sort((a, b) => {
    const dateA = a.updatedAt
      ? new Date(a.updatedAt).getTime()
      : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;
    const dateB = b.updatedAt
      ? new Date(b.updatedAt).getTime()
      : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (b.version ?? 0) - (a.version ?? 0);
  });

  return drafts[0];
}

async function resolveDomainStatus(
  clientId: string,
  domain: FnaIntakeDomain,
  fnaStatus: BatchFnaStatus,
): Promise<{
  status: BatchFnaStatus;
  intakeSessionId?: string;
  intakeMeta?: Record<string, unknown> | null;
}> {
  if (fnaStatus === 'published') {
    return { status: 'published' };
  }

  const intake = await getIntakeOverlayForDomain(clientId, domain);
  if (intake.status === 'submitted' && intake.session) {
    return {
      status: 'submitted',
      intakeSessionId: intake.session.id,
      intakeMeta: {
        progressPercent: intake.session.progressPercent,
        submittedAt: intake.session.submittedAt,
        updatedAt: intake.session.updatedAt,
      },
    };
  }
  if (intake.status === 'client_draft' && intake.session) {
    return {
      status: 'client_draft',
      intakeSessionId: intake.session.id,
      intakeMeta: {
        progressPercent: intake.session.progressPercent,
        updatedAt: intake.session.updatedAt,
        requestInfoAt: intake.session.requestInfoAt ?? null,
      },
    };
  }

  if (fnaStatus === 'draft') return { status: 'draft' };
  if (fnaStatus === 'error') return { status: 'error' };
  return { status: 'not_started' };
}

async function resolvePointerModule(
  clientId: string,
  domain: FnaIntakeDomain,
  key: string,
  latestPtr: FnaRecord | null,
) {
  try {
    if (latestPtr) {
      const baseStatus =
        latestPtr.status === 'published'
          ? ('published' as const)
          : latestPtr.status === 'draft'
            ? ('draft' as const)
            : ('draft' as const);
      const resolved = await resolveDomainStatus(clientId, domain, baseStatus);
      const overlayData =
        resolved.status === 'client_draft' || resolved.status === 'submitted'
          ? resolved.intakeMeta
          : baseStatus === 'published'
            ? latestPtr
            : latestPtr;
      return {
        key,
        status: resolved.status,
        data: overlayData ?? null,
        intakeSessionId: resolved.intakeSessionId,
      };
    }

    const resolved = await resolveDomainStatus(clientId, domain, 'not_started');
    return {
      key,
      status: resolved.status,
      data: resolved.intakeMeta ?? null,
      intakeSessionId: resolved.intakeSessionId,
    };
  } catch (err) {
    log.warn(`Error processing ${key} FNA status:`, err);
    return { key, status: 'error' as const, data: null };
  }
}

async function resolvePrefixModule(
  clientId: string,
  domain: FnaIntakeDomain,
  key: string,
  records: FnaRecord[] | null | undefined,
) {
  try {
    const all = (records || []) as FnaRecord[];
    let baseStatus: BatchFnaStatus = 'not_started';
    let data: FnaRecord | null = null;

    if (all.length > 0) {
      const published = findLatestPublished(all);
      if (published) {
        baseStatus = 'published';
        data = published;
      } else {
        const draft = findLatestDraft(all);
        if (draft) {
          baseStatus = 'draft';
          data = draft;
        }
      }
    }

    const resolved = await resolveDomainStatus(clientId, domain, baseStatus);
    const overlayData =
      resolved.status === 'client_draft' || resolved.status === 'submitted'
        ? resolved.intakeMeta
        : resolved.status === 'published'
          ? data
          : data;
    return {
      key,
      status: resolved.status,
      data: overlayData ?? null,
      intakeSessionId: resolved.intakeSessionId,
    };
  } catch (err) {
    log.warn(`Error processing ${key} FNA status:`, err);
    return { key, status: 'error' as const, data: null };
  }
}

/**
 * GET /fna/batch-status/client/:clientId
 */
fnaBatchStatusRoutes.get('/client/:clientId', async (c) => {
  try {
    log.info('📥 GET /fna/batch-status/client/:clientId');
    const clientId = c.req.param('clientId');

    const user = await authenticateUser(c.req.header('Authorization'), 'fna-batch-status');
    const isAdmin = isFnaAdminRole(user.role) || user.id === 'admin';
    const isOwnData = user.id === clientId;

    if (!isAdmin && !isOwnData) {
      return c.json({ success: false, error: 'Unauthorized access to client data' }, 403);
    }

    const [
      riskLatestPtr,
      retirementLatestPtr,
      medicalRecordsLegacy,
      medicalRecordsNew,
      investmentRecords,
      estateRecords,
      taxPlanningRecords,
    ] = await Promise.all([
      kv.get(`risk_planning_fna:${clientId}:latest`),
      kv.get(`retirement_fna:${clientId}:latest`),
      kv.getByPrefix(`medical-fna:client:${clientId}:`),
      kv.getByPrefix(`medical-fna:client_${clientId}_`),
      kv.getByPrefix(`investment-ina:client:${clientId}:`),
      kv.getByPrefix(`estate-planning-fna:client:${clientId}:`),
      kv.getByPrefix(`tax-planning-fna:client:${clientId}:`),
    ]);

    const riskResult = await resolvePointerModule(
      clientId,
      'risk',
      'risk',
      riskLatestPtr as FnaRecord | null,
    );
    const retirementResult = await resolvePointerModule(
      clientId,
      'retirement',
      'retirement',
      retirementLatestPtr as FnaRecord | null,
    );
    const medicalResult = await resolvePrefixModule(clientId, 'medical', 'medical', [
      ...(medicalRecordsLegacy || []),
      ...(medicalRecordsNew || []),
    ]);
    const investmentResult = await resolvePrefixModule(
      clientId,
      'investment',
      'investment',
      investmentRecords,
    );
    const estateResult = await resolvePrefixModule(clientId, 'estate', 'estate', estateRecords);
    const taxResult = await resolvePrefixModule(clientId, 'tax', 'tax', taxPlanningRecords);

    const results = [
      riskResult,
      medicalResult,
      retirementResult,
      investmentResult,
      estateResult,
      taxResult,
    ];

    log.info(
      `✅ Batch FNA status fetched for client ${clientId}: ${results.map((r) => `${r.key}=${r.status}`).join(', ')}`,
    );

    return c.json({ success: true, data: results });
  } catch (error: unknown) {
    log.error('❌ Error fetching batch FNA status:', error);
    return fnaErrorResponse(c, error);
  }
});

export default fnaBatchStatusRoutes;
