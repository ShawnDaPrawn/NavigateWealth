/**
 * Services and skills: storage and validation. What an agent reads for a
 * login is assembled in `src/shared/vault-skills.ts`, which the admin screen
 * also uses to preview it.
 */
import { z } from 'npm:zod@4.6.5';
import {
  NAVIGATE_WEALTH_ADMIN_URL,
  NAVIGATE_WEALTH_SERVICE_ID,
  type Service,
  type ServiceInput,
  type Skill,
  type SkillInput,
} from '../../../shared/password-manager.ts';
export { renderSkillsFor, skillsFor } from '../../../shared/vault-skills.ts';
import { insertIfAbsent } from './repositories/password-vault.ts';
import { compareAndSet, services, skills } from './repositories/vault-store.ts';

// ── Validation ───────────────────────────────────────────────────────────────

const website = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Enter the website address, starting with https://');

export const serviceInput = z.object({
  name: z.string().trim().min(1, 'Give the service a name').max(80),
  website,
  description: z.string().trim().max(1000),
});

export const skillInput = z.object({
  name: z.string().trim().min(1, 'Give the skill a short title').max(120),
  whenToUse: z.string().trim().max(500),
  instructions: z.string().trim().min(1, 'Write the instructions').max(20000),
  serviceId: z.string().min(1).max(60),
  credentialId: z.uuid().nullable(),
});

// ── Services ─────────────────────────────────────────────────────────────────

const NAVIGATE_WEALTH: Omit<Service, 'createdAt'> = {
  id: NAVIGATE_WEALTH_SERVICE_ID,
  name: 'Navigate Wealth',
  website: NAVIGATE_WEALTH_ADMIN_URL,
  description:
    'Our own platform. Agents signed in here can work in the admin panel modules, guided by the platform map and the skills below.',
  builtIn: true,
};

/** The built-in service, created on first use. Safe under concurrent first calls. */
export async function ensureNavigateWealth(): Promise<Service> {
  const existing = await services.get(NAVIGATE_WEALTH_SERVICE_ID);
  if (existing) return existing;
  const row: Service = { ...NAVIGATE_WEALTH, createdAt: new Date().toISOString() };
  if (await insertIfAbsent(services.key(row.id), row)) return row;
  return (await services.get(NAVIGATE_WEALTH_SERVICE_ID))!;
}

/** Every service, Navigate Wealth first, then by name. */
export async function allServices(): Promise<Service[]> {
  await ensureNavigateWealth();
  const rows = await services.listAll('password vault: services');
  return rows.sort((a, b) =>
    a.builtIn === b.builtIn ? a.name.localeCompare(b.name) : a.builtIn ? -1 : 1,
  );
}

export async function createService(input: ServiceInput): Promise<Service> {
  const row: Service = {
    ...input,
    id: crypto.randomUUID(),
    builtIn: false,
    createdAt: new Date().toISOString(),
  };
  await services.put(row.id, row);
  return row;
}

export async function serviceExists(id: string) {
  if (id === NAVIGATE_WEALTH_SERVICE_ID) return true;
  return Boolean(await services.get(id));
}

// ── Skills ───────────────────────────────────────────────────────────────────

export async function allSkills(): Promise<Skill[]> {
  return (await skills.listAll('password vault: skills')).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function createSkill(input: SkillInput, by: string): Promise<Skill> {
  const row: Skill = {
    ...input,
    id: crypto.randomUUID(),
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  await skills.put(row.id, row);
  return row;
}

export async function updateSkill(row: Skill, input: SkillInput, revision: string, by: string) {
  const next: Skill = {
    ...row,
    ...input,
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  return (await compareAndSet(skills.key(row.id), next, 'revision', revision)) ? next : null;
}
