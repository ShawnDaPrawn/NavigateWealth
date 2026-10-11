/**
 * Shared FNA draft creation from client intake accept handoff.
 * Keeps KV record shapes aligned with admin POST /create routes.
 */

import * as kv from './kv_store.tsx';
import {
  FNA_INTAKE_DOMAINS,
  type FnaIntakeDomain,
  type FnaIntakeSession,
} from './fna-intake-types.ts';

export interface IntakeDraftCreator {
  id: string;
  email: string;
}

export async function createFnaDraftFromIntake(
  session: FnaIntakeSession,
  admin: IntakeDraftCreator,
): Promise<string> {
  switch (session.domain) {
    case 'retirement':
      return createRetirementDraftFromIntake(session, admin);
    case 'medical':
      return createMedicalDraftFromIntake(session, admin);
    case 'risk':
      return createRiskDraftFromIntake(session, admin);
    case 'investment':
      return createGenericDraftFromIntake(session, admin, 'investment-ina');
    case 'tax':
      return createGenericDraftFromIntake(session, admin, 'tax-planning-fna');
    case 'estate':
      return createGenericDraftFromIntake(session, admin, 'estate-planning-fna');
    default:
      throw new Error(`Unsupported intake domain: ${session.domain as string}`);
  }
}

/**
 * Risk and Retirement keep each FNA at `<prefix>:<id>` and the client's FNAs in
 * an id list at `<prefix>:<clientId>:list`. The record and its list entry are
 * written together.
 */
async function saveWithListEntry(
  prefix: 'retirement_fna' | 'risk_planning_fna',
  clientId: string,
  fnaId: string,
  record: Record<string, unknown>,
): Promise<void> {
  const listKey = `${prefix}:${clientId}:list`;
  const list = ((await kv.get(listKey)) as string[] | null) || [];
  await kv.mset(
    [`${prefix}:${fnaId}`, listKey],
    [record, list.includes(fnaId) ? list : [...list, fnaId]],
  );
}

async function createRetirementDraftFromIntake(
  session: FnaIntakeSession,
  admin: IntakeDraftCreator,
) {
  const fnaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id: fnaId,
    clientId: session.clientId,
    status: 'draft',
    version: 1,
    inputs: session.inputs,
    adjustments: {},
    results: null,
    createdAt: now,
    updatedAt: now,
    createdBy: admin.id,
    intakeSessionId: session.id,
    intakeSource: 'client',
  };
  // Not written to `:latest`: that pointer is what "latest published" reads,
  // and a draft there showed as the client's current Retirement FNA. It IS put
  // on the client's list, which is what the FNA list reads — without it the
  // draft appeared nowhere.
  await saveWithListEntry('retirement_fna', session.clientId, fnaId, record);
  return fnaId;
}

async function createMedicalDraftFromIntake(session: FnaIntakeSession, admin: IntakeDraftCreator) {
  const fnaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id: fnaId,
    clientId: session.clientId,
    status: 'draft',
    version: 1,
    inputs: session.inputs,
    results: null,
    adjustments: {},
    createdAt: now,
    updatedAt: now,
    createdBy: admin.id,
    intakeSessionId: session.id,
    intakeSource: 'client',
  };
  await kv.set(`medical-fna:client:${session.clientId}:${fnaId}`, record);
  return fnaId;
}

async function createRiskDraftFromIntake(session: FnaIntakeSession, admin: IntakeDraftCreator) {
  const fnaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id: fnaId,
    clientId: session.clientId,
    clientName: '',
    status: 'draft',
    version: 1,
    inputData: session.inputs,
    calculations: null,
    adjustments: {},
    finalNeeds: null,
    createdAt: now,
    updatedAt: now,
    createdBy: admin.id,
    intakeSessionId: session.id,
    intakeSource: 'client',
  };
  // On the client's list, which is what the FNA list reads — without it the
  // draft appeared nowhere.
  await saveWithListEntry('risk_planning_fna', session.clientId, fnaId, record);
  return fnaId;
}

async function createGenericDraftFromIntake(
  session: FnaIntakeSession,
  admin: IntakeDraftCreator,
  prefix: string,
) {
  const fnaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record = {
    id: fnaId,
    clientId: session.clientId,
    status: 'draft',
    version: 1,
    inputs: session.inputs,
    results: null,
    createdAt: now,
    updatedAt: now,
    createdBy: admin.id,
    intakeSessionId: session.id,
    intakeSource: 'client',
  };
  await kv.set(`${prefix}:client:${session.clientId}:${fnaId}`, record);
  return fnaId;
}

export const FNA_INTAKE_DOMAIN_LIST: FnaIntakeDomain[] = [...FNA_INTAKE_DOMAINS];
