/**
 * Retirement Planning FNA Backend Routes
 * Handles Retirement Planning FNA calculation, storage, and versioning
 * 
 * FAIS-Compliant | Nominal Future Value Projections | Audit Trail
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { authenticateUser } from "./fna-auth.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { CreateSessionSchema, UpdateInputsSchema } from "./fna-validation.ts";
import { formatZodError } from "./shared-validation-utils.ts";

const retirementFnaRoutes = new Hono();
const log = createModuleLogger('retirement-fna-routes');

// ==================== CONSTANTS ====================

const SYSTEM_VERSION = '1.0.0';

const DEFAULT_ASSUMPTIONS = {
  retirementAge: 65,
  yearsInRetirement: 25,
  preRetirementReturn: 0.10,  // Nominal 10%
  postRetirementReturn: 0.08, // Nominal 8%
  inflationRate: 0.06,        // CPI 6%
  replacementRatio: 0.75,     // 75%
  salaryEscalation: 0.07,     // 7%
  premiumEscalation: 0.06,    // 6%
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique FNA ID
 */
function generateFnaId(): string {
  return `retirement-fna-${crypto.randomUUID()}`;
}

/**
 * Get next version number for a client
 */
async function getNextVersionNumber(clientId: string): Promise<number> {
  const fnas = await kv.getByPrefix(`retirement_fna:${clientId}:`);
  return (fnas?.length || 0) + 1;
}

/**
 * Safely parse a number from input, falling back to default if invalid/missing.
 */
function safeNumber(val: unknown, defaultVal: number): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  return Number.isNaN(num) ? defaultVal : num;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string | Date | undefined): number {
  if (!dob) return 30; // Default fallback
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Auto-populate logic extracted to a reusable function
 * Fetches profile, keys, and policies to determine default inputs
 */
async function autoPopulateFromProfile(clientId: string) {
  log.info('📋 Auto-populating Retirement FNA for client:', { clientId });
  
  // 1. Get Client Profile & Keys
  // We must fetch BOTH personal info and the dedicated client keys store
  const profileKey = `user_profile:${clientId}:personal_info`;
  const clientKeysKey = `user_profile:${clientId}:client_keys`;
  
  const [personalInfo, clientKeys] = await Promise.all([
    kv.get(profileKey) || {},
    kv.get(clientKeysKey) || {}
  ]);

  // Merge: clientKeys take precedence for "universal keys"
  const profile = { ...personalInfo, ...clientKeys };
  
  // 2. Get Policies / Products to Aggregate Totals (Fallback)
  const policiesKey = `policies:${clientId}`;
  const policiesData = await kv.get(policiesKey) || { investments: [] };
  const investments = Array.isArray(policiesData.investments) ? policiesData.investments : [];

  // Filter for Retirement Products and Sum values
  const retirementProducts = investments.filter((inv: InvestmentRecord) => {
    const name = (inv.name || inv.productName || '').toLowerCase();
    const category = (inv.category || inv.productCategory || '').toLowerCase();
    const type = (inv.type || '').toLowerCase();
    
    return category.includes('retirement') || 
           category.includes('pension') || 
           category.includes('provident') ||
           category.includes('ra') ||
           category.includes('preservation') ||
           type.includes('retirement') ||
           name.includes('retirement') ||
           name.includes('pension') ||
           name.includes('provident') ||
           name.includes('ra ') ||
           name.includes('preservation') ||
           inv.isDiscretionary === false;
  });

  const aggregatedCapital = retirementProducts.reduce((sum: number, p: InvestmentRecord) => sum + (parseFloat(String(p.currentValue)) || 0), 0);
  const aggregatedContribution = retirementProducts.reduce((sum: number, p: InvestmentRecord) => sum + (parseFloat(String(p.contribution || p.monthlyContribution)) || 0), 0);

  // 3. Determine Final Values
  // PRIORITY: Specific keys from Universal Key Manager -> Aggregated from Policies -> Fallbacks
  const totalContribution = 
    profile.retirement_total_contribution || 
    profile.retirement_monthly_contribution ||
    aggregatedContribution || 
    profile.totalMonthlyContribution || 
    profile.retirement_contribution || 
    0;

  const totalCapital = 
    profile.retirement_fund_value_total || 
    profile.retirement_fund_value || 
    profile.retirement_total_value || 
    aggregatedCapital || 
    profile.totalCurrentRetirementCapital || 
    profile.retirement_capital || 
    0;

  // Calculate Age
  const currentAge = calculateAge(profile.dateOfBirth);

  return {
    currentAge,
    intendedRetirementAge: 65,
    grossMonthlyIncome: profile.grossMonthlyIncome || profile.gross_monthly_income || 0,
    netMonthlyIncome: profile.netMonthlyIncome || profile.net_monthly_income || 0,
    totalMonthlyContribution: totalContribution,
    totalCurrentRetirementCapital: totalCapital
  };
}

// ==================== CALCULATION ENGINE ====================

function performCalculations(inputs: RetirementCalcInputs, adjustments: RetirementCalcInputs = {}) {
  // Use safe parsing for all inputs
  // Note: adjustments take precedence over inputs for fields like retirementAge
  
  const currentAge = safeNumber(inputs.currentAge, 30);
  
  // Logic to pick retirementAge: adjust -> input -> default
  const inputRetAge = inputs.retirementAge !== undefined ? inputs.retirementAge : DEFAULT_ASSUMPTIONS.retirementAge;
  const effRetAge = adjustments.retirementAge !== undefined ? adjustments.retirementAge : inputRetAge;
  const retirementAge = safeNumber(effRetAge, DEFAULT_ASSUMPTIONS.retirementAge);
  
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = safeNumber(adjustments.yearsInRetirement, DEFAULT_ASSUMPTIONS.yearsInRetirement);
  
  // Economic Assumptions (Nominal)
  const inflation = safeNumber(adjustments.inflationRate, DEFAULT_ASSUMPTIONS.inflationRate);
  const preRetReturn = safeNumber(adjustments.preRetirementReturn, DEFAULT_ASSUMPTIONS.preRetirementReturn);
  const postRetReturn = safeNumber(adjustments.postRetirementReturn, DEFAULT_ASSUMPTIONS.postRetirementReturn);
  const salaryEscalation = safeNumber(adjustments.salaryEscalation, DEFAULT_ASSUMPTIONS.salaryEscalation);
  const replaceRatio = safeNumber(adjustments.replacementRatio, DEFAULT_ASSUMPTIONS.replacementRatio);
  const premiumEscalation = safeNumber(adjustments.premiumEscalation, DEFAULT_ASSUMPTIONS.premiumEscalation);

  // 2. Rates (Nominal Monthly)
  const nominalMonthlyGrowth = Math.pow(1 + preRetReturn, 1/12) - 1;
  const nominalMonthlyEscalation = Math.pow(1 + premiumEscalation, 1/12) - 1;
  
  // Real Rates (for Annuity Factor / Required Capital)
  const realPostReturn = (1 + inflation) !== 0 ? ((1 + postRetReturn) / (1 + inflation) - 1) : 0;
  
  // 3. Target Income (Future Value)
  const currentIncome = safeNumber(inputs.currentMonthlyIncome, 0);
  
  // Project current income to retirement using Salary Escalation
  const projectedFinalNominalIncome = currentIncome * Math.pow(1 + salaryEscalation, yearsToRetirement);
  
  const targetMonthlyIncome = projectedFinalNominalIncome * replaceRatio;
  const targetAnnualIncome = targetMonthlyIncome * 12;

  // 4. Required Capital (Future Value)
  let requiredCapital = 0;
  if (Math.abs(realPostReturn) < 0.000001) {
    requiredCapital = targetAnnualIncome * yearsInRetirement;
  } else {
    requiredCapital = targetAnnualIncome * ((1 - Math.pow(1 + realPostReturn, -yearsInRetirement)) / realPostReturn);
  }

  // 5. Projected Capital (Future Value)
  // FV of Existing Lumpsum
  const currentSavings = safeNumber(inputs.currentRetirementSavings, 0);
  const fvExisting = currentSavings * Math.pow(1 + preRetReturn, yearsToRetirement);

  // FV of Contributions (Growing Annuity)
  const monthlyContrib = safeNumber(inputs.currentMonthlyContribution, 0);
  const months = yearsToRetirement * 12;
  
  let fvContribs = 0;
  if (monthlyContrib > 0 && months > 0) {
    if (Math.abs(nominalMonthlyGrowth - nominalMonthlyEscalation) < 0.000001) {
      fvContribs = monthlyContrib * months * Math.pow(1 + nominalMonthlyGrowth, months - 1);
    } else {
      fvContribs = monthlyContrib * (
        (Math.pow(1 + nominalMonthlyGrowth, months) - Math.pow(1 + nominalMonthlyEscalation, months)) / 
        (nominalMonthlyGrowth - nominalMonthlyEscalation)
      );
    }
  }

  const projectedCapital = fvExisting + fvContribs;

  // 6. Analysis
  const capitalShortfall = requiredCapital - projectedCapital;
  const hasShortfall = capitalShortfall > 0;
  const shortfallPercentage = requiredCapital > 0 ? (capitalShortfall / requiredCapital) * 100 : 0;

  // 7. Solve for Additional Contribution (PMT)
  let requiredAdditionalContribution = 0;
  if (hasShortfall && months > 0) {
    let annuityFactor = 0;
    if (Math.abs(nominalMonthlyGrowth - nominalMonthlyEscalation) < 0.000001) {
      annuityFactor = months * Math.pow(1 + nominalMonthlyGrowth, months - 1);
    } else {
      annuityFactor = (Math.pow(1 + nominalMonthlyGrowth, months) - Math.pow(1 + nominalMonthlyEscalation, months)) / 
                      (nominalMonthlyGrowth - nominalMonthlyEscalation);
    }
    
    if (annuityFactor > 0) {
      requiredAdditionalContribution = capitalShortfall / annuityFactor;
    }
  }

  const totalRecommendedContribution = monthlyContrib + requiredAdditionalContribution;
  const percentageOfIncome = currentIncome > 0 
    ? (totalRecommendedContribution / currentIncome) * 100 
    : 0;
    
  // Final NaN check for outputs
  const safeOutput = (v: number) => Number.isNaN(v) || !Number.isFinite(v) ? 0 : v;

  return {
    yearsToRetirement,
    yearsInRetirement,
    realGrowthRate: preRetReturn, // Nominal rate
    realSalaryGrowth: salaryEscalation,
    targetMonthlyIncome: safeOutput(targetMonthlyIncome),
    requiredCapital: safeOutput(requiredCapital),
    projectedCapital: safeOutput(projectedCapital),
    capitalShortfall: safeOutput(capitalShortfall),
    hasShortfall,
    shortfallPercentage: safeOutput(shortfallPercentage),
    requiredAdditionalContribution: safeOutput(requiredAdditionalContribution),
    totalRecommendedContribution: safeOutput(totalRecommendedContribution),
    percentageOfIncome: safeOutput(percentageOfIncome)
  };
}

// ==================== ROUTE HANDLERS ====================

// GET All for Client
retirementFnaRoutes.get('/client/:clientId', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    
    // Fetch all sessions (using list pattern or prefix scan)
    const listKey = `retirement_fna:${clientId}:list`;
    const list = await kv.get(listKey) || [];
    
    const sessions = [];
    for (const id of list) {
      const session = await kv.get(`retirement_fna:${id}`);
      if (session) sessions.push(session);
    }
    
    // Sort by updated at desc
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    return c.json({ success: true, data: sessions });
  } catch (error: unknown) {
    log.error('Error fetching sessions:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// GET By ID
retirementFnaRoutes.get('/:fnaId', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId');
    const session = await kv.get(`retirement_fna:${fnaId}`);
    
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// CREATE Session
retirementFnaRoutes.post('/create', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const body = await c.req.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }
    const { clientId } = parsed.data;
    
    const id = generateFnaId();
    const version = await getNextVersionNumber(clientId);
    
    const session = {
      id,
      clientId,
      version,
      status: 'draft',
      inputs: {},
      adjustments: {},
      results: null,
      metadata: {
        systemVersion: SYSTEM_VERSION,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id
    };
    
    // Save
    await kv.set(`retirement_fna:${id}`, session);
    
    // Add to list
    const listKey = `retirement_fna:${clientId}:list`;
    const list = await kv.get(listKey) || [];
    list.push(id);
    await kv.set(listKey, list);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('Error creating session:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// UPDATE Inputs
retirementFnaRoutes.put('/:fnaId/inputs', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId');
    const body = await c.req.json();
    const parsed = UpdateInputsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: formatZodError(parsed.error) }, 400);
    }
    const inputUpdates = parsed.data;
    
    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    
    session.inputs = { ...session.inputs, ...inputUpdates };
    session.updatedAt = new Date().toISOString();
    
    await kv.set(`retirement_fna:${fnaId}`, session);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// CALCULATE Results
retirementFnaRoutes.post('/:fnaId/calculate', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId');
    
    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    
    log.info(`Calculating FNA ${fnaId} with inputs:`, session.inputs);
    
    // Run Calculation with safe number parsing
    // Passing inputs as second arg allows adjustments to be picked up if they were merged into inputs
    const results = performCalculations(session.inputs, session.inputs); 
    
    session.results = results;
    session.updatedAt = new Date().toISOString();
    
    await kv.set(`retirement_fna:${fnaId}`, session);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('Error calculating:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// PUBLISH
retirementFnaRoutes.put('/:fnaId/publish', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const fnaId = c.req.param('fnaId');
    
    const session = await kv.get(`retirement_fna:${fnaId}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    
    session.status = 'published';
    session.publishedAt = new Date().toISOString();
    session.publishedBy = user.id;
    session.updatedAt = new Date().toISOString();
    
    await kv.set(`retirement_fna:${fnaId}`, session);
    
    // Update latest pointer
    await kv.set(`retirement_fna:${session.clientId}:latest`, session);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// GET Latest Published
retirementFnaRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    
    const latest = await kv.get(`retirement_fna:${clientId}:latest`);
    
    // If not found, try to find from list
    if (!latest) {
      const listKey = `retirement_fna:${clientId}:list`;
      const list = await kv.get(listKey) || [];
      
      // Find most recent published
      for (let i = list.length - 1; i >= 0; i--) {
        const session = await kv.get(`retirement_fna:${list[i]}`);
        if (session && session.status === 'published') {
          return c.json({ success: true, data: session });
        }
      }
      return c.json({ success: true, data: null }); // No published found
    }
    
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

// Auto Populate (Refactored to use helper)
retirementFnaRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    
    const inputs = await autoPopulateFromProfile(clientId);
    
    return c.json({ success: true, data: inputs });
  } catch (error: unknown) {
    log.error('Error in auto-populate:', error);
    return c.json({ success: false, error: getErrMsg(error) }, 500);
  }
});

export default retirementFnaRoutes;

// ==================== INTERFACES ====================

/** Loosely-typed investment record from KV policies data */
interface InvestmentRecord {
  name?: string;
  productName?: string;
  category?: string;
  productCategory?: string;
  type?: string;
  currentValue?: string | number;
  contribution?: string | number;
  monthlyContribution?: string | number;
  isDiscretionary?: boolean;
  [key: string]: unknown;
}

/** Input shape for retirement FNA calculations */
interface RetirementCalcInputs {
  currentAge?: number | string;
  retirementAge?: number | string;
  currentMonthlyIncome?: number | string;
  currentRetirementSavings?: number | string;
  currentMonthlyContribution?: number | string;
  yearsInRetirement?: number | string;
  inflationRate?: number | string;
  preRetirementReturn?: number | string;
  postRetirementReturn?: number | string;
  salaryEscalation?: number | string;
  replacementRatio?: number | string;
  premiumEscalation?: number | string;
  [key: string]: unknown;
}