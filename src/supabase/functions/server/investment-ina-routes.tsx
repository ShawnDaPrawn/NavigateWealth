/**
 * Investment Needs Analysis (INA) Backend Routes
 * Handles Goal-Based Investment Planning calculation, storage, and versioning
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { authenticateUser } from "./fna-auth.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { SaveInvestmentSessionSchema } from "./fna-validation.ts";
import { formatZodError } from "./shared-validation-utils.ts";

const investmentInaRoutes = new Hono();
const log = createModuleLogger('investment-ina-routes');

// Root handlers
investmentInaRoutes.get('/', (c) => c.json({ service: 'investment-ina', status: 'active' }));
investmentInaRoutes.get('', (c) => c.json({ service: 'investment-ina', status: 'active' }));

// ==================== HELPER FUNCTIONS ====================

/**
 * Get next Investment INA version number for a client
 */
async function getNextVersionNumber(clientId: string): Promise<number> {
  const inas = await kv.getByPrefix(`investment-ina:client:${clientId}:`);
  return (inas?.length || 0) + 1;
}

/**
 * Default economic assumptions
 */
function getDefaultEconomicAssumptions() {
  return {
    longTermInflationRate: 0.06,
    expectedRealReturns: {
      conservative: 0.02,
      moderate: 0.035,
      balanced: 0.05,
      growth: 0.065,
      aggressive: 0.08,
    },
  };
}

/**
 * Auto-populate Investment INA inputs from client profile and existing investments
 */
async function autoPopulateFromProfile(clientId: string) {
  try {
    log.info('📋 Auto-populating Investment INA for client:', { clientId });
    
    // Get client profile
    const profileKey = `profile:${clientId}`;
    const profile = await kv.get(profileKey);

    if (!profile) {
      log.warn('⚠️ No profile found, using defaults');
      return getDefaultInputs();
    }

    // Calculate age from date of birth
    const calculateAge = (dob: string) => {
      if (!dob) return 0;
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const clientAge = calculateAge(profile.dateOfBirth || profile.date_of_birth);

    // Get existing policies (to extract discretionary investments)
    const policiesKey = `policies:${clientId}`;
    const policies = await kv.get(policiesKey) || { investments: [] };
    
    // Extract discretionary investments from investments tab
    const discretionaryInvestments = (policies.investments || [])
      .filter((inv: InvestmentEntry) => inv.isDiscretionary === true)
      .map((inv: InvestmentEntry) => ({
        id: inv.id,
        productName: inv.name || inv.productName || 'Unnamed Investment',
        provider: inv.provider || '',
        currentValue: parseFloat(String(inv.currentValue)) || 0,
        monthlyContribution: parseFloat(String(inv.contribution || inv.monthlyContribution || 0)),
        expectedDrawdownDate: inv.expectedDrawdownDate,
        riskCategory: inv.riskCategory || 'balanced',
        isDiscretionary: true,
      }));

    const totalDiscretionaryCapitalCurrent = discretionaryInvestments.reduce(
      (sum: number, inv: DiscretionaryInvestment) => sum + inv.currentValue,
      0
    );

    const totalDiscretionaryMonthlyContributions = discretionaryInvestments.reduce(
      (sum: number, inv: DiscretionaryInvestment) => sum + inv.monthlyContribution,
      0
    );

    // Get risk profile if available
    const riskProfileKey = `risk-profile:${clientId}`;
    const riskProfileData = await kv.get(riskProfileKey);
    const clientRiskProfile = riskProfileData?.profile || 'balanced';

    const economicAssumptions = getDefaultEconomicAssumptions();

    return {
      // Personal information
      currentAge: clientAge,
      dateOfBirth: profile.dateOfBirth || profile.date_of_birth || '',
      householdDependants: profile.dependants?.length || 0,
      grossMonthlyIncome: parseFloat(profile.grossMonthlyIncome) || 0,
      netMonthlyIncome: parseFloat(profile.netMonthlyIncome) || 0,
      
      // Risk profile
      clientRiskProfile,
      
      // Economic assumptions
      longTermInflationRate: economicAssumptions.longTermInflationRate,
      expectedRealReturns: economicAssumptions.expectedRealReturns,
      
      // Discretionary investments
      discretionaryInvestments,
      totalDiscretionaryCapitalCurrent,
      totalDiscretionaryMonthlyContributions,
      
      // Goals (empty initially - to be added by adviser)
      goals: [],
    };
  } catch (error) {
    log.error('❌ Error auto-populating Investment INA:', error);
    return getDefaultInputs();
  }
}

function getDefaultInputs() {
  const economicAssumptions = getDefaultEconomicAssumptions();
  return {
    currentAge: 0,
    dateOfBirth: '',
    householdDependants: 0,
    grossMonthlyIncome: 0,
    netMonthlyIncome: 0,
    clientRiskProfile: 'balanced',
    longTermInflationRate: economicAssumptions.longTermInflationRate,
    expectedRealReturns: economicAssumptions.expectedRealReturns,
    discretionaryInvestments: [],
    totalDiscretionaryCapitalCurrent: 0,
    totalDiscretionaryMonthlyContributions: 0,
    goals: [],
  };
}

/**
 * Calculate Investment INA Results
 */
function calculateInvestmentINA(inputs: INAInputs) {
  log.info('🧮 Calculating Investment INA...');
  
  const currentYear = new Date().getFullYear();
  const goalResults: GoalResult[] = [];
  const recommendations: Array<{ goalId: string; goalName: string; action: string; priority: string | undefined; impact: string }> = [];
  
  // Process each goal
  for (const goal of inputs.goals || []) {
    const result = calculateSingleGoal(goal, inputs, currentYear);
    goalResults.push(result);
    
    // Generate recommendations based on goal status
    if (result.fundingGap.hasShortfall) {
      recommendations.push({
        goalId: goal.id,
        goalName: goal.goalName,
        action: result.requiredContributions.canMeetGoal
          ? `Increase monthly contribution by R${formatCurrency(result.requiredContributions.requiredAdditionalMonthly)} to meet this goal`
          : `Goal may not be achievable with current time horizon. Consider extending timeline or increasing initial capital`,
        priority: goal.priorityLevel,
        impact: `This will help close the R${formatCurrency(result.fundingGap.gapAmount)} funding gap`,
      });
    }
  }
  
  // Calculate portfolio summary
  const portfolioSummary = calculatePortfolioSummary(goalResults);
  
  return {
    portfolioSummary,
    goalResults,
    recommendations,
    economicAssumptions: {
      inflationRate: inputs.longTermInflationRate,
      realReturnsByProfile: inputs.expectedRealReturns,
    },
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate results for a single goal
 */
function calculateSingleGoal(goal: INAGoal, inputs: INAInputs, currentYear: number) {
  const yearsToGoal = goal.targetYear - currentYear;
  const isValidTimeHorizon = yearsToGoal > 0;
  
  // Determine applicable risk profile and real return
  const applicableRiskProfile = goal.useClientRiskProfile 
    ? inputs.clientRiskProfile 
    : goal.goalSpecificRiskProfile;
  const applicableRealReturn = inputs.expectedRealReturns[applicableRiskProfile];
  
  // Step 1: Calculate time horizon
  const timeHorizon = {
    targetYear: goal.targetYear,
    currentYear,
    yearsToGoal,
    isValidTimeHorizon,
    warningMessage: !isValidTimeHorizon ? 'Goal target date is in the past or current year' : undefined,
  };
  
  // Step 2: Project existing capital
  const existingCapital = calculateExistingCapital(goal, inputs, yearsToGoal, applicableRealReturn);
  
  // Step 3: Project monthly contributions
  const monthlyContributions = calculateMonthlyContributions(
    goal.currentContributionToGoal || 0,
    yearsToGoal,
    applicableRealReturn
  );
  
  // Step 4: Project lump sums
  const lumpSums = calculateLumpSums(goal.expectedLumpSums || [], goal.targetYear, applicableRealReturn);
  const totalLumpSumFutureValue = lumpSums.reduce((sum, ls) => sum + ls.futureValue, 0);
  
  // Step 5: Total projected capital
  const totalProjectedCapital = 
    existingCapital.totalExistingFutureValue +
    monthlyContributions.futureValueOfContributions +
    totalLumpSumFutureValue;
  
  const projectedCapital = {
    existingCapital,
    monthlyContributions,
    lumpSums,
    totalLumpSumFutureValue,
    totalProjectedCapital,
  };
  
  // Step 6: Calculate funding gap
  const fundingGap = calculateFundingGap(goal.goalAmountToday, totalProjectedCapital);
  
  // Step 7: Calculate required contributions
  const requiredContributions = calculateRequiredContributions(
    fundingGap,
    goal.currentContributionToGoal || 0,
    yearsToGoal,
    applicableRealReturn
  );
  
  // Determine goal status
  const goalStatus = determineGoalStatus(fundingGap.fundingPercentage);
  const statusRationale = generateStatusRationale(fundingGap, goalStatus);
  
  return {
    goalId: goal.id,
    goalName: goal.goalName,
    goalType: goal.goalType,
    goalStatus,
    statusRationale,
    timeHorizon,
    projectedCapital,
    fundingGap,
    requiredContributions,
    applicableRiskProfile,
    applicableRealReturn,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate existing capital projection
 */
function calculateExistingCapital(goal: INAGoal, inputs: INAInputs, yearsToGoal: number, realReturn: number) {
  const linkedInvestments = (goal.linkedInvestmentIds || [])
    .map((invId: string) => {
      const investment = inputs.discretionaryInvestments.find((inv: DiscretionaryInvestment) => inv.id === invId);
      if (!investment) return null;
      
      const futureValue = investment.currentValue * Math.pow(1 + realReturn, yearsToGoal);
      
      return {
        investmentId: investment.id,
        investmentName: investment.productName,
        currentValue: investment.currentValue,
        yearsToGoal,
        applicableRealReturn: realReturn,
        futureValue,
      };
    })
    .filter((inv: LinkedInvestmentResult | null): inv is LinkedInvestmentResult => inv !== null);
  
  const totalExistingFutureValue = linkedInvestments.reduce((sum: number, inv: LinkedInvestmentResult) => sum + inv.futureValue, 0);
  
  return {
    linkedInvestments,
    totalExistingFutureValue,
  };
}

/**
 * Calculate monthly contributions projection
 */
function calculateMonthlyContributions(monthlyAmount: number, yearsToGoal: number, realReturn: number) {
  if (monthlyAmount === 0 || yearsToGoal <= 0) {
    return {
      monthlyContributionReal: 0,
      yearsToGoal,
      applicableRealReturn: realReturn,
      annuityFactor: 0,
      futureValueOfContributions: 0,
    };
  }
  
  // Future value of annuity formula: PMT * 12 * [((1 + r)^n - 1) / r]
  const annuityFactor = (Math.pow(1 + realReturn, yearsToGoal) - 1) / realReturn;
  const futureValueOfContributions = monthlyAmount * 12 * annuityFactor;
  
  return {
    monthlyContributionReal: monthlyAmount,
    yearsToGoal,
    applicableRealReturn: realReturn,
    annuityFactor,
    futureValueOfContributions,
  };
}

/**
 * Calculate lump sum projections
 */
function calculateLumpSums(lumpSums: LumpSumEntry[], targetYear: number, realReturn: number): LumpSumResult[] {
  return lumpSums.map((ls: LumpSumEntry) => {
    const lumpSumYear = new Date(ls.expectedDate).getFullYear();
    const yearsFromLumpToGoal = targetYear - lumpSumYear;
    const futureValue = ls.amount * Math.pow(1 + realReturn, Math.max(0, yearsFromLumpToGoal));
    
    return {
      lumpSumId: ls.id,
      lumpSumAmount: ls.amount,
      lumpSumDate: ls.expectedDate,
      yearsFromLumpToGoal,
      applicableRealReturn: realReturn,
      futureValue,
    };
  });
}

/**
 * Calculate funding gap analysis
 */
function calculateFundingGap(goalRequired: number, projectedCapital: number) {
  const gapAmount = goalRequired - projectedCapital;
  const hasShortfall = gapAmount > 0;
  const fundingPercentage = (projectedCapital / goalRequired) * 100;
  const gapPercentage = (gapAmount / goalRequired) * 100;
  
  return {
    goalRequiredReal: goalRequired,
    projectedCapitalAtGoal: projectedCapital,
    gapAmount,
    hasShortfall,
    fundingPercentage,
    gapPercentage,
  };
}

/**
 * Calculate required contributions to close funding gap
 */
function calculateRequiredContributions(
  fundingGap: FundingGap,
  currentMonthly: number,
  yearsToGoal: number,
  realReturn: number
) {
  if (!fundingGap.hasShortfall) {
    return {
      currentMonthlyContribution: currentMonthly,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: currentMonthly,
      alternativeLumpSumToday: 0,
      canMeetGoal: true,
    };
  }
  
  if (yearsToGoal <= 0) {
    return {
      currentMonthlyContribution: currentMonthly,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: currentMonthly,
      alternativeLumpSumToday: fundingGap.gapAmount,
      canMeetGoal: false,
    };
  }
  
  // Calculate required additional monthly contribution
  // Solve: gap = X * 12 * annuityFactor
  const annuityFactor = (Math.pow(1 + realReturn, yearsToGoal) - 1) / realReturn;
  const requiredAdditionalMonthly = fundingGap.gapAmount / (12 * annuityFactor);
  
  // Calculate alternative lump sum needed today
  const alternativeLumpSumToday = fundingGap.gapAmount / Math.pow(1 + realReturn, yearsToGoal);
  
  return {
    currentMonthlyContribution: currentMonthly,
    requiredAdditionalMonthly,
    recommendedTotalMonthly: currentMonthly + requiredAdditionalMonthly,
    alternativeLumpSumToday,
    canMeetGoal: true,
  };
}

/**
 * Determine goal status based on funding percentage
 */
function determineGoalStatus(fundingPercentage: number): string {
  if (fundingPercentage >= 100) return 'on-track';
  if (fundingPercentage >= 90) return 'slight-shortfall';
  if (fundingPercentage >= 70) return 'moderate-shortfall';
  if (fundingPercentage >= 50) return 'significant-shortfall';
  return 'significant-shortfall';
}

/**
 * Generate status rationale
 */
function generateStatusRationale(fundingGap: FundingGap, status: string): string {
  if (!fundingGap.hasShortfall) {
    return `Goal is ${fundingGap.fundingPercentage > 100 ? 'overfunded' : 'fully funded'}. Current trajectory exceeds or meets requirements.`;
  }
  
  return `Goal is ${Math.round(fundingGap.fundingPercentage)}% funded. Shortfall of R${formatCurrency(fundingGap.gapAmount)} needs to be addressed.`;
}

/**
 * Calculate portfolio summary
 */
function calculatePortfolioSummary(goalResults: GoalResult[]) {
  const totalGoals = goalResults.length;
  const totalRequiredCapital = goalResults.reduce((sum, g) => sum + g.fundingGap.goalRequiredReal, 0);
  const totalProjectedCapital = goalResults.reduce((sum, g) => sum + g.projectedCapital.totalProjectedCapital, 0);
  const totalFundingGap = goalResults.reduce((sum, g) => sum + (g.fundingGap.hasShortfall ? g.fundingGap.gapAmount : 0), 0);
  const totalAdditionalMonthlyRequired = goalResults.reduce((sum, g) => sum + g.requiredContributions.requiredAdditionalMonthly, 0);
  
  const goalsOnTrack = goalResults.filter(g => g.goalStatus === 'on-track').length;
  const goalsUnderfunded = goalResults.filter(g => g.fundingGap.hasShortfall).length;
  const goalsOverfunded = goalResults.filter(g => !g.fundingGap.hasShortfall && g.fundingGap.fundingPercentage > 100).length;
  
  // Determine overall portfolio health
  let overallPortfolioHealth = 'excellent';
  const fundingRatio = totalGoals > 0 ? goalsOnTrack / totalGoals : 0;
  if (fundingRatio < 0.3) overallPortfolioHealth = 'critical';
  else if (fundingRatio < 0.6) overallPortfolioHealth = 'needs-attention';
  else if (fundingRatio < 0.9) overallPortfolioHealth = 'good';
  
  return {
    totalGoals,
    totalRequiredCapital,
    totalProjectedCapital,
    totalFundingGap,
    totalAdditionalMonthlyRequired,
    goalsOnTrack,
    goalsUnderfunded,
    goalsOverfunded,
    overallPortfolioHealth,
  };
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('en-ZA');
}

// ==================== ROUTES ====================

/**
 * GET /investment-ina/client/:clientId/auto-populate
 * Auto-populate INA inputs from client profile
 */
investmentInaRoutes.get('/client/:clientId/auto-populate', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    
    const inputs = await autoPopulateFromProfile(clientId);
    
    return c.json({ success: true, data: inputs });
  } catch (error: unknown) {
    log.error('❌ Error auto-populating Investment INA:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * POST /investment-ina/client/:clientId/calculate
 * Calculate INA results
 */
investmentInaRoutes.post('/client/:clientId/calculate', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    const inputs = await c.req.json();
    
    log.info('📊 Calculating Investment INA for client:', { clientId });
    
    const results = calculateInvestmentINA(inputs);
    
    return c.json({ success: true, data: results });
  } catch (error: unknown) {
    log.error('❌ Error calculating Investment INA:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * POST /investment-ina/client/:clientId/save
 * Save INA session (draft or published)
 */
investmentInaRoutes.post('/client/:clientId/save', async (c) => {
  try {
    const user = await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    const body = await c.req.json();

    // Validate input per §4.2 / fna-validation.ts
    const validationResult = SaveInvestmentSessionSchema.safeParse(body);
    if (!validationResult.success) {
      const errMsg = formatZodError(validationResult.error);
      log.warn(`Validation failed for Investment INA save: ${errMsg}`);
      return c.json({ success: false, error: errMsg }, 400);
    }

    const { inputs, results, status } = validationResult.data;
    
    const version = await getNextVersionNumber(clientId);
    const sessionId = `${clientId}-v${version}`;
    
    const session = {
      id: sessionId,
      clientId,
      version,
      status: status || 'draft',
      inputs,
      results,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: status === 'published' ? new Date().toISOString() : undefined,
      publishedBy: status === 'published' ? user.id : undefined,
    };
    
    const key = `investment-ina:client:${clientId}:${sessionId}`;
    await kv.set(key, session);
    
    log.info(`✅ Investment INA saved: ${key} (${status})`);
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('❌ Error saving Investment INA:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /investment-ina/client/:clientId/sessions
 * Get all INA sessions for a client
 */
investmentInaRoutes.get('/client/:clientId/sessions', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const clientId = c.req.param('clientId');
    
    const sessions = await kv.getByPrefix(`investment-ina:client:${clientId}:`);
    
    // Sort by version descending
    const sorted = (sessions || []).sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);
    
    return c.json({ success: true, data: sorted });
  } catch (error: unknown) {
    log.error('❌ Error fetching Investment INA sessions:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * GET /investment-ina/client/:clientId/latest-published
 * Get latest published INA for a client
 */
investmentInaRoutes.get('/client/:clientId/latest-published', async (c) => {
  try {
    const clientId = c.req.param('clientId');
    
    // Optional authentication - allow both authenticated clients and anon key access
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      try {
        const user = await authenticateUser(authHeader);
        // Check authorization: admins can access all data, regular users only their own
        const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.role === 'super-admin' || user.id === 'admin';
        const isOwnData = user.id === clientId;
        
        if (!isAdmin && !isOwnData) {
          log.warn(`⚠️ User ${user.id} (role: ${user.role}) attempting to access Investment INA for client ${clientId}`);
          return c.json({ error: 'Unauthorized access to client data' }, 403);
        }
      } catch (authError) {
        // WORKAROUND: Auth bypass for backward compatibility with client portal
        // Problem: Client portal accesses published INA data using the anon key without a user session.
        // Why chosen: Removing this would break client-facing INA display until portal auth is refactored.
        // Proper fix: Require authentication on all INA reads; update client portal to pass user session token.
        // Revisit: When client portal auth is unified (tracked in Tier B backlog).
        log.info('Authentication failed, allowing unauthenticated access to published Investment INA');
      }
    }
    
    const sessions = await kv.getByPrefix(`investment-ina:client:${clientId}:`);
    
    const published = (sessions || [])
      .filter((s: VersionedSession) => s.status === 'published')
      .sort((a: VersionedSession, b: VersionedSession) => b.version - a.version);
    
    const latest = published[0] || null;
    
    log.info(latest ? `✅ Latest published Investment INA found: ${latest.id}` : '⚠️ No published Investment INA');
    return c.json({ success: true, data: latest });
  } catch (error: unknown) {
    log.error('❌ Error fetching latest published Investment INA:', error);
    const message = getErrMsg(error);
    return c.json({ success: false, error: message }, 500);
  }
});

/**
 * GET /investment-ina/session/:sessionId
 * Get specific INA session by ID
 */
investmentInaRoutes.get('/session/:sessionId', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'));
    const sessionId = c.req.param('sessionId');
    
    // Extract clientId from sessionId (format: clientId-vN)
    const clientId = sessionId.split('-v')[0];
    
    const key = `investment-ina:client:${clientId}:${sessionId}`;
    const session = await kv.get(key);
    
    if (!session) {
      return c.json({ 
        success: false, 
        error: 'Investment INA session not found' 
      }, 404);
    }
    
    return c.json({ success: true, data: session });
  } catch (error: unknown) {
    log.error('❌ Error fetching Investment INA session:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

/**
 * DELETE /investment-ina/session/:sessionId
 * Delete an Investment INA session
 */
investmentInaRoutes.delete('/session/:sessionId', async (c) => {
  try {
    log.info('📥 DELETE /investment-ina/session/:sessionId');
    await authenticateUser(c.req.header('Authorization'));
    
    const sessionId = c.req.param('sessionId');
    
    // Extract clientId from sessionId (format: clientId-vN)
    const clientId = sessionId.split('-v')[0];
    
    const key = `investment-ina:client:${clientId}:${sessionId}`;
    await kv.del(key);
    
    log.info('✅ Investment INA session deleted:', { sessionId });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Error deleting Investment INA session:', error);
    const message = getErrMsg(error);
    return c.json({ 
      success: false, 
      error: message 
    }, message === 'Unauthorized' ? 401 : 500);
  }
});

export default investmentInaRoutes;

// --- Internal types for Investment INA calculations ---
interface InvestmentEntry { id?: string; name?: string; productName?: string; provider?: string; currentValue?: string | number; contribution?: string | number; monthlyContribution?: string | number; expectedDrawdownDate?: string; riskCategory?: string; isDiscretionary?: boolean; [key: string]: unknown }
interface DiscretionaryInvestment { id: string; productName: string; provider: string; currentValue: number; monthlyContribution: number; expectedDrawdownDate?: string; riskCategory: string; isDiscretionary: boolean }
interface INAGoal { id: string; goalName: string; targetYear: number; goalAmountToday: number; useClientRiskProfile?: boolean; goalSpecificRiskProfile?: string; priorityLevel?: string; linkedInvestmentIds?: string[]; currentContributionToGoal?: number; expectedLumpSums?: LumpSumEntry[]; [key: string]: unknown }
interface LumpSumEntry { id?: string; amount: number; expectedDate: string; [key: string]: unknown }
interface INAInputs { goals: INAGoal[]; clientRiskProfile: string; expectedRealReturns: Record<string, number>; longTermInflationRate: number; discretionaryInvestments: DiscretionaryInvestment[]; [key: string]: unknown }
interface FundingGap { goalRequiredReal: number; totalProjectedCapital: number; gapAmount: number; hasShortfall: boolean; fundingPercentage: number; gapPercentage: number }
interface GoalResult { goalStatus: string; fundingGap: FundingGap; projectedCapital: { totalProjectedCapital: number; [key: string]: unknown }; requiredContributions: { requiredAdditionalMonthly: number; [key: string]: unknown }; [key: string]: unknown }
interface LinkedInvestmentResult { investmentId: string; investmentName: string; currentValue: number; yearsToGoal: number; applicableRealReturn: number; futureValue: number }
interface LumpSumResult { lumpSumId: string; lumpSumAmount: number; lumpSumDate: string; yearsFromLumpToGoal: number; applicableRealReturn: number; futureValue: number }
interface VersionedSession { version: number; status?: string; [key: string]: unknown }