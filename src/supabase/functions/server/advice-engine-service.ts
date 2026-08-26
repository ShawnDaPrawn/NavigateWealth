/**
 * Advice Engine Module - Service Layer
 * Fresh file moved to root to fix bundling issues
 *
 * Unified FNA (Financial Needs Analysis) service
 * Eliminates ~60% code duplication across 6 FNA types
 */

import type {
  FNA,
  FNAType,
  FNACreate,
  FNAUpdate,
  AIChatResponse,
  AIAnalysisResponse,
} from './advice-engine-types.ts';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';

const log = createModuleLogger('advice-engine-service');

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Helper to calculate age from date of birth
function calculateAge(dob: string): number {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export class AdviceEngineService {
  /**
   * Get KV prefix for FNA type
   */
  private getFNAPrefix(type: FNAType): string {
    const prefixes: Record<FNAType, string> = {
      risk: 'fna',
      medical: 'medical-fna',
      retirement: 'retirement-fna',
      investment: 'investment-ina',
      tax: 'tax-planning-fna',
      estate: 'estate-planning-fna',
    };
    return prefixes[type];
  }

  /**
   * Get next version number for client
   */
  private async getNextVersionNumber(type: FNAType, clientId: string): Promise<number> {
    const prefix = this.getFNAPrefix(type);

    // Highest stored version, not how many are stored — see fna-versioning.ts.
    // A count only counts what is still there, so a deleted FNA used to hand
    // this number back out, and the next create's index row upserted over the
    // previous one, orphaning an FNA that was still on file.
    //
    // Read from the index KEYS, which already carry `v{version}`, rather than
    // fetching the record each id points at. One prefix listing instead of
    // N+1 reads on a create path — and this runs behind a ~1s platform floor,
    // so N+1 here is the difference a client feels.
    //
    // Parsed here rather than through `highestVersion` because this key has its
    // own grammar: `{prefix}:client:{clientId}:v{n}` before the fix and
    // `...:v{n}:{fnaId}` after it, colon-separated and with the version in the
    // middle — not the `-v{n}` record-id shape that helper reads.
    //
    // Paged, because `listByPrefix` returns at most 100 rows per call and these
    // keys sort as strings: `:v10:` comes before `:v9:`, so the first page is
    // not the highest versions and a truncated read would hand back a number
    // already in use. The loop runs once for any realistic client.
    const indexPrefix = `${prefix}:client:${clientId}:`;
    let highest = 0;
    let startAfter: string | undefined;
    while (true) {
      const batch = await kv.listByPrefix(indexPrefix, { limit: 200, startAfter });
      for (const row of batch) {
        const matched = /:v(\d+)(?::|$)/.exec(row.key);
        const found = matched ? Number(matched[1]) : NaN;
        if (Number.isFinite(found) && found > highest) highest = found;
      }
      if (batch.length < 200) break;
      startAfter = batch[batch.length - 1]?.key;
      if (!startAfter) break;
    }
    return highest + 1;
  }

  /**
   * Auto-populate FNA from client profile
   */
  private async autoPopulateFromProfile(
    type: FNAType,
    clientId: string,
  ): Promise<Record<string, unknown>> {
    try {
      log.info('Auto-populating FNA from profile', { type, clientId });

      // Get client profile
      const profileKey = `profile:${clientId}`;
      const profile = await kv.get(profileKey);

      if (!profile) {
        log.warn('No profile found, using defaults', { clientId });
        return this.getDefaultInputs(type);
      }

      const clientAge = calculateAge(profile.dateOfBirth || profile.date_of_birth);
      const spouseAge = profile.spouseDateOfBirth
        ? calculateAge(profile.spouseDateOfBirth)
        : undefined;

      // Map dependants
      const dependants = (profile.familyMembers || [])
        .filter((fm: Record<string, unknown>) => fm.isFinanciallyDependent)
        .map((fm: Record<string, unknown>) => ({
          name: fm.fullName as string,
          dateOfBirth: fm.dateOfBirth as string,
          age: calculateAge(fm.dateOfBirth as string),
          relationship: fm.relationship as string,
          financiallyDependent: true,
          expectedSupportEndAge: (fm.expectedSupportEndAge as number) || 25,
          financialDependencyPercent: 100,
        }));

      // Map liabilities
      const liabilities = (profile.liabilities || []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        type: l.type as string,
        description: l.description as string,
        outstandingBalance: (l.outstandingBalance as number) || 0,
        monthlyPayment: (l.monthlyPayment as number) || 0,
        interestRate: (l.interestRate as number) || 0,
        remainingTerm: (l.remainingTerm as number) || 0,
      }));

      // Map assets
      const assets = (profile.assets || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        type: a.type as string,
        description: a.description as string,
        currentValue: (a.currentValue as number) || 0,
      }));

      // Common populated data
      const populatedData = {
        // Personal info
        clientAge,
        clientName: profile.firstName || profile.name,
        hasSpouse: !!profile.hasSpouse,
        spouseAge,
        spouseName: profile.spouseName,
        dependants,

        // Financial info
        monthlyIncome: profile.monthlyIncome || 0,
        monthlyExpenses: profile.monthlyExpenses || 0,
        liabilities,
        assets,

        // Address
        residentialAddress: profile.residentialAddress,

        // Contact
        email: profile.email,
        phone: profile.phone,
      };

      // Add type-specific defaults
      return {
        ...populatedData,
        ...this.getTypeSpecificDefaults(type, populatedData),
      };
    } catch (error) {
      log.error('Failed to auto-populate', error as Error, { type, clientId });
      return this.getDefaultInputs(type);
    }
  }

  /**
   * Get type-specific default values
   */
  private getTypeSpecificDefaults(
    type: FNAType,
    baseData: Record<string, unknown>,
  ): Record<string, unknown> {
    switch (type) {
      case 'medical':
        return {
          currentMedicalAid: null,
          currentOption: null,
          currentPremium: 0,
          numberOfBeneficiaries:
            (Array.isArray(baseData.dependants) ? baseData.dependants.length : 0) +
            (baseData.hasSpouse ? 2 : 1),
        };

      case 'retirement':
        return {
          desiredRetirementAge: 65,
          currentSavings: 0,
          monthlyContribution: 0,
          expectedInflationRate: 6,
          expectedReturnRate: 10,
        };

      case 'investment':
        return {
          investmentGoal: 'wealth_creation',
          investmentHorizon: 10,
          riskTolerance: 'moderate',
          expectedReturn: 10,
        };

      case 'tax':
        return {
          taxableIncome: ((baseData.monthlyIncome as number) || 0) * 12,
          deductions: [],
          taxCredits: [],
        };

      case 'estate':
        return {
          estateValue: (Array.isArray(baseData.assets) ? baseData.assets : []).reduce(
            (sum: number, a: Record<string, unknown>) => sum + ((a.currentValue as number) || 0),
            0,
          ),
          hasWill: false,
          hasTrust: false,
          beneficiaries: [],
        };

      case 'risk':
      default:
        return {
          currentLifeCover: 0,
          currentDisabilityCover: 0,
          currentDreadDiseaseCover: 0,
        };
    }
  }

  /**
   * Get default inputs for FNA type
   */
  private getDefaultInputs(type: FNAType): Record<string, unknown> {
    return {
      clientAge: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      dependants: [],
      liabilities: [],
      assets: [],
      ...this.getTypeSpecificDefaults(type, {}),
    };
  }

  /**
   * Create new FNA
   */
  async createFNA(type: FNAType, userId: string, data: FNACreate): Promise<FNA> {
    log.info('Creating FNA', { type, userId, clientId: data.clientId });

    // Validate
    if (!data.clientId) {
      throw new ValidationError('Client ID is required', 'clientId');
    }

    const fnaId = generateId();
    const timestamp = new Date().toISOString();
    const version = await this.getNextVersionNumber(type, data.clientId);

    // Auto-populate if requested
    let inputs = data.inputs || {};
    if (data.autoPopulate) {
      inputs = await this.autoPopulateFromProfile(type, data.clientId);
    }

    const fna: FNA = {
      id: fnaId,
      type,
      version,
      clientId: data.clientId,
      advisorId: userId,
      status: 'draft',
      inputs,
      outputs: data.outputs || {},
      recommendations: data.recommendations || [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const prefix = this.getFNAPrefix(type);
    await kv.set(`${prefix}:${fnaId}`, fna);
    // `:${fnaId}` closes a silent orphaning. This row is the client -> fnaId
    // index that `getClientFNAs` prefix-scans, and its key used to end at
    // `v${version}`. Two creates settling on the same version made the second
    // upsert over the first index row: the earlier FNA survived at
    // `${prefix}:${fnaId}` but became unreachable for that client — invisible
    // in the UI, still held under FAIS retention. The reader scans the prefix
    // and consumes VALUES, so the extra key segment is backward compatible
    // with index rows already stored under the old shape.
    await kv.set(`${prefix}:client:${data.clientId}:v${version}:${fnaId}`, fnaId);

    log.success('FNA created', { type, fnaId, version });

    return fna;
  }

  /**
   * Update FNA
   */
  async updateFNA(type: FNAType, fnaId: string, updates: FNAUpdate): Promise<FNA> {
    const fna = await this.getFNAById(type, fnaId);

    if (fna.status === 'published') {
      throw new ValidationError('Cannot update published FNA');
    }

    // Merge updates
    Object.assign(fna, updates);
    fna.updatedAt = new Date().toISOString();

    const prefix = this.getFNAPrefix(type);
    await kv.set(`${prefix}:${fnaId}`, fna);

    log.success('FNA updated', { type, fnaId });

    return fna;
  }

  /**
   * Get FNA by ID
   */
  async getFNAById(type: FNAType, fnaId: string): Promise<FNA> {
    const prefix = this.getFNAPrefix(type);
    const fna = await kv.get(`${prefix}:${fnaId}`);

    if (!fna) {
      throw new NotFoundError('FNA not found');
    }

    return fna;
  }

  /**
   * Get all FNAs for client
   */
  async getClientFNAs(type: FNAType, clientId: string): Promise<FNA[]> {
    const prefix = this.getFNAPrefix(type);
    const fnaIds = await kv.getByPrefix(`${prefix}:client:${clientId}:`);

    if (!fnaIds || fnaIds.length === 0) {
      return [];
    }

    // Get full FNA objects
    const fnas: FNA[] = [];
    for (const id of fnaIds) {
      const fna = await kv.get(`${prefix}:${id}`);
      if (fna) {
        fnas.push(fna);
      }
    }

    // Sort by version (newest first)
    fnas.sort((a, b) => b.version - a.version);

    return fnas;
  }

  /**
   * Publish FNA
   */
  async publishFNA(type: FNAType, fnaId: string, adminUserId: string): Promise<FNA> {
    const fna = await this.getFNAById(type, fnaId);

    if (fna.status === 'published') {
      throw new ValidationError('FNA is already published');
    }

    fna.status = 'published';
    fna.publishedAt = new Date().toISOString();
    fna.publishedBy = adminUserId;
    fna.updatedAt = new Date().toISOString();

    const prefix = this.getFNAPrefix(type);
    await kv.set(`${prefix}:${fnaId}`, fna);

    log.success('FNA published', { type, fnaId });

    return fna;
  }

  /**
   * AI Advisor chat (client portal)
   */
  async aiChat(
    userId: string,
    _message: string,
    _context?: Record<string, unknown>,
  ): Promise<AIChatResponse> {
    log.info('AI Advisor chat', { userId });

    // TODO: Integrate with OpenAI or other AI service
    // For now, return a placeholder

    return {
      response: 'AI Advisor integration coming soon. Your question has been logged.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * AI Intelligence analysis (admin)
   */
  async aiAnalyze(
    clientId: string,
    analysisType: string,
    _data: Record<string, unknown>,
  ): Promise<AIAnalysisResponse> {
    log.info('AI Intelligence analysis', { clientId, analysisType });

    // TODO: Integrate with AI service for advanced analysis
    // For now, return a placeholder

    return {
      analysis: `${analysisType} analysis for client ${clientId}`,
      insights: [],
      recommendations: [],
      timestamp: new Date().toISOString(),
    };
  }
}
