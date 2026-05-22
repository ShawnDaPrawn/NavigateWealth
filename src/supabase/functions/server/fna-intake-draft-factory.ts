/**
 * Shared FNA draft creation from client intake accept handoff.
 * Keeps KV record shapes aligned with admin POST /create routes.
 */

import * as kv from './kv_store.tsx';
import type { FnaIntakeDomain, FnaIntakeSession } from './fna-intake-service.ts';

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

async function createRetirementDraftFromIntake(session: FnaIntakeSession, admin: IntakeDraftCreator) {
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
  await kv.set(`retirement_fna:${fnaId}`, record);
  await kv.set(`retirement_fna:${session.clientId}:latest`, record);
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
  await kv.set(`risk_planning_fna:${fnaId}`, record);
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

export const FNA_INTAKE_DOMAIN_LIST: FnaIntakeDomain[] = [
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
];
