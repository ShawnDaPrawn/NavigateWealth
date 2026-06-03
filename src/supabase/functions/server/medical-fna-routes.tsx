/**
 * Medical FNA (Financial Needs Analysis) Backend Routes
 * Handles Medical Aid FNA calculation, storage, and versioning
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { authenticateUser, fnaErrorResponse } from './fna-auth.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { CreateSessionSchema, UpdateResultsSchema } from './fna-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { NetWorthSnapshotService } from './net-worth-snapshot-service.ts';

const medicalFnaRoutes = new Hono();
const log = createModuleLogger('medical-fna-routes');
const snapshotService = new NetWorthSnapshotService();

/**
 * Shared shape for KV entries with date fields used in filter/sort callbacks */
interface FnaSession {
  createdAt?: string;
  publishedAt?: string;
  version?: number;
  status?: string;
  [key: string]: unknown;
}
interface FamilyMember {
  fullName?: string;
  dateOfBirth?: string;
  relationship?: string;
  isFinanciallyDependent?: boolean;
  [key: string]: unknown;
}
interface AssetEntry {
  type?: string;
  value?: number;
  [key: string]: unknown;
}
interface RiskPolicy {
  name?: string;
  coverAmount?: number;
  [key: string]: unknown;
}
interface MedicalFNAInputs {
  currentPlan: { monthlyPremium: number };
  netMonthlyIncome: number;
  [key: string]: unknown;
}

/**
 * Get next Medical FNA version number for a client
 */
async function getNextVersionNumber(clientId: string): Promise<number> {
  // Check for both legacy (colon) and new (underscore) formats
  const legacyFnas = (await kv.getByPrefix(`medical-fna:client:${clientId}:`)) || [];
  const newFnas = (await kv.getByPrefix(`medical-fna:client_${clientId}_`)) || [];
  return legacyFnas.length + newFnas.length + 1;
}

/**
 * Auto-populate Medical FNA inputs from client profile
 */
async function autoPopulateFromProfile(clientId: string) {
  try {
    log.info('ðŸ“‹ Auto-populating Medical FNA for client:', { clientId });
    const { medicalStep1AutoPopulateFromResolver } =
      await import('./form-prefill-auto-populate.ts');
    const step1 = await medicalStep1AutoPopulateFromResolver(clientId);
    const defaults = getDefaultMedicalFNAInputs();
    return {
      ...defaults,
      clientAge: step1.currentAge ?? defaults.clientAge,
      spousePartner: step1.spousePartner ?? false,
      childrenCount: step1.childrenCount ?? 0,
      grossMonthlyIncome: step1.grossMonthlyIncome ?? 0,
      existingPlanType: step1.existingPlanType ?? '',
      existingHospitalCover: step1.existingHospitalCover ?? '',
      existingTotalPremium: step1.existingTotalPremium ?? 0,
      existingMSA: step1.existingMSA ?? 0,
      existingLJP: step1.existingLJP ?? 0,
      existingDependents: step1.existingDependents ?? 0,
    };
  } catch (error) {
    log.error('âŒ Error auto-populating Medical FNA:', error);
    return getDefaultMedicalFNAInputs();
  }
}

/**
 * Determine plan type from plan name
 */
function determinePlanType(
  planName: string,
): 'hospital-only' | 'saver' | 'comprehensive' | 'network' {
  const name = planName.toLowerCase();
  if (name.includes('hospital') && !name.includes('saver')) return 'hospital-only';
  if (name.includes('saver') || name.includes('smart')) return 'saver';
  if (name.includes('comprehensive') || name.includes('executive') || name.includes('classic'))
    return 'comprehensive';
  if (name.includes('network')) return 'network';
  return 'comprehensive'; // Default
}

/**
 * Default Medical FNA inputs
 */
function getDefaultMedicalFNAInputs() {
  return {
    clientAge: 35,
    maritalStatus: 'Single',
    spouseName: undefined,
    spouseDateOfBirth: undefined,
    spouseAge: undefined,
    dependants: [],
    netMonthlyIncome: 0,
    totalMonthlyExpenses: 0,
    currentMedicalExpenses: 0,
    discretionarySpending: 0,
    healthNeeds: {
      expectedGPVisitsPerYear: 4,
      expectedSpecialistVisitsPerYear: 1,
      expectedDentistVisitsPerYear: 2,
      expectedOptometryVisitsPerYear: 1,
      chronicConditions: [],
      isPMBQualifying: false,
      chronicMedicationCostMonthly: 0,
      requiresDSPCompliance: false,
      recentHospitalAdmissions: 0,
      upcomingPlannedProcedures: [],
      maternityPlanning: false,
      maternityTimeframe: undefined,
      highRiskLifestyleFactors: [],
    },
    currentPlan: {
      schemeName: '',
      planOptionName: '',
      monthlyPremium: 0,
      dependantsCovered: 1,
      planType: 'comprehensive' as const,
      hospitalBenefitLevel: 200,
      hospitalNetwork: 'network',
      hasMedicalSavingsAccount: false,
      msaAmountAnnual: 0,
      dayToDayLimits: {},
      chronicCoverLevel: 'PMB only',
      chronicFormularyRestrictions: false,
      hasGapCover: false,
    },
    preferences: {
      networkPreference: 'network-ok' as const,
      specialistPreference: 'network-only' as const,
      maxTolerablePremium: 5000,
      outOfPocketTolerance: 'medium' as const,
      preferenceDirection: 'balanced' as const,
      prioritizeHospitalCover: true,
      prioritizeDayToDay: false,
      willingToUseGapCover: true,
    },
    emergencyFundSavings: 0,
    severeCriticalIllnessCover: 0,
  };
}

// ==================== ROUTES ====================

/**
 * GET /medical-fna/health
 * Health check endpoint for Medical FNA routes
 */
medicalFnaRoutes.get('/health', async (c) => {
  log.info('ðŸ“¥ GET /medical-fna/health - Health check');
  return c.json({
    status: 'ok',
    module: 'medical-fna',
    routes: [
      'GET /client/:clientId',
      'GET /client/:clientId/latest-published',
      'GET /client/:clientId/auto-populate',
      'POST /create',
      'PUT /inputs/:fnaId',
      'POST /calculate/:fnaId',
      'PUT /draft/:fnaId',
      'POST /publish/:fnaId',
      'POST /unpublish/:fnaId',
      'PUT /archive/:fnaId',
      'DELETE /delete/:fnaId',
      'GET /:fnaId (catch-all)',
    ],
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /medical-fna/client/:clientId
 * Get all Medical FNA sessions for a client
 */
medicalFnaRoutes.get('/client/:clientId', async (c) => {
  try {
    log.info('ðŸ“¥ GET /medical-fna/client/:clientId');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;

    // Support both legacy (colon) and new (underscore) ID formats
    const legacyFnas = (await kv.getByPrefix(`medical-fna:client:${clientId}:`)) || [];
    const newFnas = (await kv.getByPrefix(`medical-fna:client_${clientId}_`)) || [];

    const fnas = [...legacyFnas, ...newFnas];

    // Sort by createdAt descending (newest first)
    fnas.sort((a: FnaSession, b: FnaSession) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    log.info(`âœ… Found ${fnas.length} Medical FNA sessions`);
    return c.json({ success: true, data: fnas });
  } catch (error: unknown) {
    log.error('âŒ Error fetching Medical FNAs:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /medical-fna/client/:clientId/latest-published
 * Get the latest published Medical FNA for a client
 */
medicalFnaRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    log.info('ðŸ“¥ GET /medical-fna/client/:clientId/latest-published');
    const clientId = c.req.param('clientId')!;

    // Optional authentication - allow both authenticated clients and anon key access
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        // If authenticated as a specific user (not admin), verify they're accessing their own data
        // Check authorization: admins can access all data, regular users only their own
        const isAdmin =
          user.role === 'admin' ||
          user.role === 'super_admin' ||
          user.role === 'super-admin' ||
          user.id === 'admin';
        const isOwnData = user.id === clientId;

        if (!isAdmin && !isOwnData) {
          log.warn(
            `âš ï¸ User ${user.id} (role: ${user.role}) attempting to access Medical FNA for client ${clientId}`,
          );
          return c.json({ success: false, error: 'Unauthorized access to client data' }, 403);
        }
      } catch (authError) {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published FNA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing FNA display until portal auth is refactored.
        // Proper fix: Require authentication on all FNA reads; update client portal to pass user session token.
        // Revisit: When client portal auth is unified (tracked in Tier B backlog).
        log.info('Authentication failed, allowing unauthenticated access to published Medical FNA');
      }
    }

    // Support both legacy (colon) and new (underscore) ID formats
    const legacyFnas = (await kv.getByPrefix(`medical-fna:client:${clientId}:`)) || [];
    const newFnas = (await kv.getByPrefix(`medical-fna:client_${clientId}_`)) || [];

    const fnas = [...legacyFnas, ...newFnas];

    const publishedFnas = fnas
      .filter((fna: FnaSession) => fna.status === 'published')
      .sort((a: FnaSession, b: FnaSession) => {
        // Sort by publishedAt descending (most recent first)
        // Fallback to version if publishedAt is missing (legacy)
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

        if (dateA !== dateB) {
          return dateB - dateA;
        }
        return b.version - a.version;
      });

    const latestPublished = publishedFnas[0] || null;

    log.info(
      latestPublished
        ? `âœ… Latest published Medical FNA found: ${latestPublished.id}`
        : 'âš ï¸ No published Medical FNA',
    );
    return c.json({ success: true, data: latestPublished });
  } catch (error: unknown) {
    log.error('âŒ Error fetching latest published Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /medical-fna/client/:clientId/auto-populate
 * Auto-populate Medical FNA from client profile
 */
medicalFnaRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    log.info('ðŸ“¥ GET /medical-fna/client/:clientId/auto-populate');
    await authenticateUser(c.req.header('Authorization'));

    const clientId = c.req.param('clientId')!;
    const inputs = await autoPopulateFromProfile(clientId);

    log.info('âœ… Auto-population data generated');
    return c.json({ success: true, data: inputs });
  } catch (error: unknown) {
    log.error('âŒ Error auto-populating:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * POST /medical-fna/create
 * Create a new Medical FNA session (auto-populated from client profile)
 */
medicalFnaRoutes.post('/create', async (c) => {
  try {
    log.info('ðŸ“¥ POST /medical-fna/create');
    const user = await authenticateUser(c.req.header('Authorization'));

    const body = await c.req.json();

    // Validate input
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }

    const { clientId } = parsed.data;

    log.info('Creating Medical FNA for client:', { clientId });

    // Auto-populate from profile
    const inputs = await autoPopulateFromProfile(clientId);

    // Get next version
    const version = await getNextVersionNumber(clientId);

    // Create FNA session with URL-safe ID format (underscore instead of colon)
    const fnaId = `client_${clientId}_v${version}`;
    const fna = {
      id: fnaId,
      clientId,
      version,
      status: 'draft',
      inputs,
      results: null, // Not calculated yet
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to KV store
    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA created:', { fnaId });
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error creating Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * PUT /medical-fna/inputs/:fnaId
 * Update Medical FNA inputs
 */
medicalFnaRoutes.put('/inputs/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ PUT /medical-fna/inputs/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const inputUpdates = await c.req.json();

    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    // Merge inputs
    fna.inputs = {
      ...fna.inputs,
      ...inputUpdates,
    };

    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA inputs updated');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error updating Medical FNA inputs:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * PUT /medical-fna/results/:fnaId
 * Update Medical FNA results and adjustments (from client-side calculation)
 */
medicalFnaRoutes.put('/results/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ PUT /medical-fna/results/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const { results, adjustments } = await c.req.json();

    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    // Validate results update
    const validationResult = UpdateResultsSchema.safeParse({ results, adjustments });
    if (!validationResult.success) {
      const errMsg = formatZodError(validationResult.error);
      log.error('âŒ Validation error updating Medical FNA results:', errMsg);
      return c.json({ success: false, error: errMsg }, 400);
    }

    // Update results and adjustments
    if (results) fna.results = results;
    if (adjustments) fna.adjustments = adjustments;

    // Also support 'calculations' alias for results if provided (for backward compatibility)
    if (results) fna.calculations = results;

    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA results updated');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error updating Medical FNA results:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * POST /medical-fna/calculate/:fnaId
 * Calculate Medical FNA results (runs calculation engine)
 */
medicalFnaRoutes.post('/calculate/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ POST /medical-fna/calculate/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    log.info('ðŸ§® Running Medical FNA calculation...');

    // Import calculation service dynamically
    // Note: In production, this would import the actual calculation service
    // For now, we'll create a placeholder that returns the structure
    const results = calculateMedicalFNA(fna.inputs);

    fna.results = results;
    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA calculation complete');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error calculating Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * PUT /medical-fna/draft/:fnaId
 * Save Medical FNA as draft
 */
medicalFnaRoutes.put('/draft/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ PUT /medical-fna/draft/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    fna.status = 'draft';
    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA saved as draft');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error saving Medical FNA draft:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * POST /medical-fna/publish/:fnaId
 * Publish Medical FNA (makes it visible to client)
 */
medicalFnaRoutes.post('/publish/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ POST /medical-fna/publish/:fnaId - ROUTE HIT');
    log.info('ðŸ“‹ Request details:', {
      path: c.req.path,
      method: c.req.method,
      headers: Object.fromEntries(c.req.raw.headers.entries()),
    });

    const user = await authenticateUser(c.req.header('Authorization'));
    log.info('âœ… User authenticated:', { userId: user.id });

    const fnaId = c.req.param('fnaId')!;
    log.info('ðŸ“Œ FNA ID from params:', { fnaId });

    const fna = await kv.get(`medical-fna:${fnaId}`);
    log.info('ðŸ” KV lookup result:', {
      found: !!fna,
      key: `medical-fna:${fnaId}`,
      status: fna?.status,
    });

    if (!fna) {
      log.error('âŒ Medical FNA not found in KV store:', { fnaId });
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    fna.status = 'published';
    fna.publishedAt = new Date().toISOString();
    fna.publishedBy = user.id;
    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA published successfully:', {
      fnaId,
      clientId: fna.clientId,
      publishedBy: user.id,
    });

    // Phase 4: Auto-snapshot net worth on FNA publish (fire-and-forget, Â§13)
    if (fna.clientId) {
      snapshotService.autoSnapshotFromKV(fna.clientId, 'medical-fna-publish').catch(() => {});
    }

    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error publishing Medical FNA:', {
      error: getErrMsg(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return fnaErrorResponse(c, error);
  }
});

/**
 * POST /medical-fna/unpublish/:fnaId
 * Unpublish Medical FNA (changes status from published back to draft)
 */
medicalFnaRoutes.post('/unpublish/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ POST /medical-fna/unpublish/:fnaId');
    const user = await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    fna.status = 'draft';
    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA unpublished');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error unpublishing Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * PUT /medical-fna/archive/:fnaId
 * Archive a Medical FNA
 */
medicalFnaRoutes.put('/archive/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ PUT /medical-fna/archive/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    fna.status = 'archived';
    fna.updatedAt = new Date().toISOString();

    await kv.set(`medical-fna:${fnaId}`, fna);

    log.info('âœ… Medical FNA archived');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error archiving Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * DELETE /medical-fna/delete/:fnaId
 * Delete a Medical FNA
 */
medicalFnaRoutes.delete('/delete/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ DELETE /medical-fna/delete/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;

    await kv.del(`medical-fna:${fnaId}`);

    log.info('âœ… Medical FNA deleted');
    return c.json({ success: true, data: null });
  } catch (error: unknown) {
    log.error('âŒ Error deleting Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

/**
 * GET /medical-fna/:fnaId
 * Get a specific Medical FNA session
 * MUST BE LAST - Generic catch-all route
 */
medicalFnaRoutes.get('/:fnaId', async (c) => {
  try {
    log.info('ðŸ“¥ GET /medical-fna/:fnaId');
    await authenticateUser(c.req.header('Authorization'));

    const fnaId = c.req.param('fnaId')!;
    const fna = await kv.get(`medical-fna:${fnaId}`);

    if (!fna) {
      return c.json({ success: false, error: 'Medical FNA not found' }, 404);
    }

    log.info('âœ… Medical FNA retrieved');
    return c.json({ success: true, data: fna });
  } catch (error: unknown) {
    log.error('âŒ Error fetching Medical FNA:', error);
    return fnaErrorResponse(c, error);
  }
});

// ==================== CALCULATION FUNCTION ====================

/**
 * Calculate Medical FNA results
 * This is a server-side implementation of the calculation logic
 */
function calculateMedicalFNA(inputs: MedicalFNAInputs) {
  // TODO: Implement full calculation logic here
  // For now, return placeholder structure

  return {
    hospitalCover: {
      requiredTier: 3,
      requiredTierRationale: 'Based on your health profile and needs.',
      currentTier: 3,
      hospitalBenefitAdequacy: 'adequate',
      networkAdequacy: 'good',
      specialistReimbursementRisk: 'medium',
      gapCoverNecessity: 'optional',
      gapCoverRationale: 'Your current plan provides reasonable coverage.',
      recommendations: ['Current hospital cover is appropriate'],
    },
    dayToDayCare: {
      expectedAnnualGPCost: 1800,
      expectedAnnualSpecialistCost: 1200,
      expectedAnnualDentistCost: 1600,
      expectedAnnualOptometryCost: 600,
      expectedAnnualChronicMedication: 0,
      expectedAnnualOtherCosts: 2000,
      totalExpectedDayToDayCost: 7200,
      currentMSAAllowance: 0,
      currentDayToDayLimits: 0,
      projectedOutOfPocketCost: 7200,
      adequacyScore: 'adequate',
      isOverinsured: false,
      recommendations: ['Day-to-day benefits align well with expected usage'],
    },
    chronicCover: {
      hasChronicConditions: false,
      chronicConditionsList: [],
      isPMBQualifying: false,
      formularyAdequacy: 'excellent',
      dspComplianceRequired: false,
      dspAccessibility: 'easy',
      chronicCoverAdequacy: 'excellent',
      identifiedGaps: [],
      recommendations: ['No chronic conditions - current cover is adequate'],
    },
    affordability: {
      currentTotalPremium: inputs.currentPlan.monthlyPremium,
      premiumToIncomeRatio: (inputs.currentPlan.monthlyPremium / inputs.netMonthlyIncome) * 100,
      affordabilityLevel: 'affordable',
      isSustainable: true,
      sustainabilityRationale: 'Medical aid premium is within recommended thresholds',
      potentialSavingsMonthly: 0,
      downgradeFeasible: false,
      recommendations: ['Medical aid premium is affordable and sustainable'],
    },
    overallRecommendation: {
      verdict: 'keep-current',
      verdictRationale: 'Current plan appropriately matches your health needs and budget.',
      priorityActions: [
        {
          action: 'Annual review to ensure continued adequacy',
          priority: 'low',
          impact: 'Proactive monitoring of changing health and financial needs',
        },
      ],
      overallScore: 75,
      strengthsIdentified: [
        'Strong hospital cover protection',
        'Premium is sustainable and affordable',
      ],
      weaknessesIdentified: [],
    },
  };
}

export default medicalFnaRoutes;
