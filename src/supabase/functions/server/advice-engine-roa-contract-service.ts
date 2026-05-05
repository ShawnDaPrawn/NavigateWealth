/**
 * Editable RoA module contract registry.
 *
 * Phase 2 stores module contracts as configuration so super admins can later
 * edit the schema, evidence requirements and document sections in-app.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';
import {
  DEFAULT_ROA_MODULE_CONTRACTS,
  ROA_MODULE_CONTRACT_SCHEMA_FORMAT,
  contractToLegacyModule,
  validateRoAModuleContract,
  type LegacyRoAModule,
  type RoAContractStatus,
  type RoAModuleContract,
  type RoAModuleContractSchemaFormat,
} from './advice-engine-roa-contract-types.ts';

const log = createModuleLogger('advice-engine-roa-contract-service');

interface AuthUserLike {
  id: string;
  email?: string;
}

interface ListContractFilters {
  status?: RoAContractStatus;
  includeArchived?: boolean;
}

const CONTRACT_PREFIX = 'roa:module-contract:';
const CONTRACT_HISTORY_PREFIX = 'roa:module-contract-history:';

function contractKey(id: string): string {
  return `${CONTRACT_PREFIX}${id}`;
}

function contractHistoryKey(id: string, version: number, updatedAt: string): string {
  return `${CONTRACT_HISTORY_PREFIX}${id}:v${version}:${updatedAt}`;
}

function getUserId(user: AuthUserLike): string {
  return user.id || user.email || 'unknown-user';
}

function mergeDefaultsAndSaved(saved: RoAModuleContract[]): RoAModuleContract[] {
  const byId = new Map(DEFAULT_ROA_MODULE_CONTRACTS.map((contract) => [contract.id, contract]));
  for (const contract of saved) {
    byId.set(contract.id, contract);
  }
  return Array.from(byId.values());
}

export class AdviceEngineRoAContractService {
  getSchemaFormat(): RoAModuleContractSchemaFormat {
    return ROA_MODULE_CONTRACT_SCHEMA_FORMAT;
  }

  async listContracts(filters: ListContractFilters = {}): Promise<RoAModuleContract[]> {
    const savedContracts = (await kv.getByPrefix(CONTRACT_PREFIX)) as RoAModuleContract[];
    return mergeDefaultsAndSaved(savedContracts || [])
      .filter((contract) => filters.includeArchived || contract.status !== 'archived')
      .filter((contract) => !filters.status || contract.status === filters.status)
      .sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.title.localeCompare(b.title);
      });
  }

  async listLegacyModules(): Promise<LegacyRoAModule[]> {
    const activeContracts = await this.listContracts({ status: 'active' });
    return activeContracts.map(contractToLegacyModule);
  }

  async getContract(moduleId: string): Promise<RoAModuleContract> {
    const saved = await kv.get(contractKey(moduleId)) as RoAModuleContract | null;
    if (saved) return saved;

    const seeded = DEFAULT_ROA_MODULE_CONTRACTS.find((contract) => contract.id === moduleId);
    if (!seeded) throw new NotFoundError('RoA module contract not found');
    return seeded;
  }

  async saveContract(input: unknown, user: AuthUserLike): Promise<RoAModuleContract> {
    let incoming: RoAModuleContract;
    try {
      incoming = validateRoAModuleContract(input);
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : 'Invalid RoA module contract');
    }

    const now = new Date().toISOString();
    const existing = await kv.get(contractKey(incoming.id)) as RoAModuleContract | null;
    const seeded = DEFAULT_ROA_MODULE_CONTRACTS.find((contract) => contract.id === incoming.id);
    const base = existing || seeded;
    const userId = getUserId(user);

    const contract = validateRoAModuleContract({
      ...incoming,
      version: base ? base.version + 1 : 1,
      createdAt: base?.createdAt || now,
      createdBy: base?.createdBy || userId,
      updatedAt: now,
      updatedBy: userId,
      publishedAt: incoming.status === 'active' ? incoming.publishedAt || base?.publishedAt || now : incoming.publishedAt,
    });

    await kv.set(contractKey(contract.id), contract);
    await kv.set(contractHistoryKey(contract.id, contract.version, contract.updatedAt), contract);

    log.info('Saved RoA module contract', {
      moduleId: contract.id,
      status: contract.status,
      version: contract.version,
      updatedBy: userId,
    });

    return contract;
  }

  async publishContract(moduleId: string, user: AuthUserLike): Promise<RoAModuleContract> {
    const existing = await this.getContract(moduleId);
    return this.saveContract({
      ...existing,
      status: 'active',
      publishedAt: new Date().toISOString(),
    }, user);
  }

  async archiveContract(moduleId: string, user: AuthUserLike): Promise<RoAModuleContract> {
    const existing = await this.getContract(moduleId);
    return this.saveContract({
      ...existing,
      status: 'archived',
    }, user);
  }
}
