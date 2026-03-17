/**
 * Risk Planning FNA (Financial Needs Analysis) Backend Routes
 * Handles Risk Planning FNA calculation, storage, and versioning
 * 
 * FAIS-Compliant | Deterministic Calculations | Audit Trail
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { authenticateUser } from "./fna-auth.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import { CreateRiskPlanningFnaSchema, UpdateRiskPlanningFnaSchema } from "./fna-validation.ts";
import { formatZodError } from "./shared-validation-utils.ts";
import { NetWorthSnapshotService } from './net-worth-snapshot-service.ts';

const riskPlanningFnaRoutes = new Hono();
const log = createModuleLogger('risk-planning-fna-routes');
const snapshotService = new NetWorthSnapshotService();

// ==================== LOCAL INTERFACES ====================

/** Family member record from client profile KV data */
interface FamilyMemberRecord {
  relationship?: string;
  dateOfBirth?: string;
  isFinanciallyDependent?: boolean;
  [key: string]: unknown;
}

/** Dependant derived from family member data */
interface DependantRecord {
  id: string;
  relationship: string;
  dependencyTerm: number;
  monthlyEducationCost: number;
}

/** Liability record from client profile */
interface LiabilityRecord {
  outstandingBalance?: number | string;
  [key: string]: unknown;
}

/** Asset record from client profile */
interface AssetRecord {
  value?: number | string;
  [key: string]: unknown;
}

/** Policy record from KV policies data */
interface PolicyRecord {
  id?: string;
  categoryId?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Existing cover structure for calculation functions */
interface ExistingCoverData {
  life: { personal: number; group: number };
  disability: { personal: number; group: number };
  severeIllness: { personal: number; group: number };
  incomeProtection: {
    temporary: { personal: number; group: number };
    permanent: { personal: number; group: number };
  };
}

/** Income protection settings */
interface IncomeProtectionSettings {
  temporary: { benefitPeriod: string };
  permanent: { escalation: string };
}

/** Input data shape for all risk planning calculation functions */
interface RiskCalcInputData {
  grossMonthlyIncome: number;
  grossAnnualIncome: number;
  netMonthlyIncome: number;
  netAnnualIncome: number;
  currentAge: number;
  retirementAge: number;
  dependants: DependantRecord[];
  totalOutstandingDebts: number;
  totalCurrentAssets: number;
  totalEstateValue: number;
  spouseFullName: string;
  spouseAverageMonthlyIncome: number;
  existingCover: ExistingCoverData;
  incomeProtectionSettings: IncomeProtectionSettings;
  [key: string]: unknown;
}

// ==================== CONSTANTS ====================

const SYSTEM_VERSION = '1.0.0';
const INSURABLE_MAXIMUM_DEFAULT = 150000; // R150,000/month default guardrail

// Life Cover Constants
const LIFE_COVER_MULTIPLES = {
  SINGLE_NO_DEPENDANTS: 5,
  SINGLE_INCOME_HOUSEHOLD_BASE: 14,
  MARRIED_YOUNG_CHILDREN_BASE: 10,
  ADDITIONAL_PER_DEPENDANT: 1, // Mandatory: +1× per additional dependant
};

const FUNERAL_FINAL_EXPENSES = 100000; // R100,000
const ESTATE_COSTS_PERCENTAGE = 0.05; // 5%

// Disability Cover Constants
const DISABILITY_MULTIPLE_BASE = 10;
const ADDITIONAL_DISABILITY_COSTS = {
  HOME_MODIFICATIONS: 200000,
  VEHICLE_ADAPTATION: 150000,
  MEDICAL_EQUIPMENT: 100000,
  ONCE_OFF_CARE_COSTS: 100000,
};

// Severe Illness Cover Constants
const SEVERE_ILLNESS_MULTIPLE = 3;

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique FNA ID
 */
function generateFnaId(): string {
  return `risk-fna-${crypto.randomUUID()}`;
}

/**
 * Get next version number for a client
 */
async function getNextVersionNumber(clientId: string): Promise<number> {
  const fnas = await kv.getByPrefix(`risk_planning_fna:${clientId}:`);
  return (fnas?.length || 0) + 1;
}

/**
 * Calculate age from date of birth
 */
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

/**
 * Auto-populate Risk Planning FNA inputs from client profile
 */
async function autoPopulateFromProfile(clientId: string) {
  try {
    log.info('📋 Auto-populating Risk Planning FNA for client:', { clientId });
    
    // Get client profile
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);

    if (!profile) {
      log.warn('⚠️ No profile found for client:', { clientId });
      return null;
    }

    // Extract income information (newly added fields)
    const grossMonthlyIncome = profile.grossMonthlyIncome || profile.grossIncome || profile.income?.grossMonthly || 0;
    const netMonthlyIncome = profile.netMonthlyIncome || profile.netIncome || profile.income?.netMonthly || 0;
    const grossAnnualIncome = profile.grossAnnualIncome || (grossMonthlyIncome * 12);
    const netAnnualIncome = profile.netAnnualIncome || (netMonthlyIncome * 12);

    // Calculate client age
    const currentAge = calculateAge(profile.dateOfBirth || profile.date_of_birth);
    const retirementAge = profile.retirementAge || 65;

    // Extract employment type
    const employmentType = profile.employmentStatus === 'Self-Employed' ? 'self-employed' : 'employed';

    // Map dependants from family members
    const dependants = (profile.familyMembers || [])
      .filter((fm: FamilyMemberRecord) => fm.isFinanciallyDependent || fm.relationship === 'Child')
      .map((fm: FamilyMemberRecord, index: number) => ({
        id: `dep-${index + 1}`,
        relationship: fm.relationship || 'Child',
        dependencyTerm: 18 - calculateAge(fm.dateOfBirth || ''), // Default to age 18
        monthlyEducationCost: 5000, // Default estimate
      }))
      .filter((dep: DependantRecord) => dep.dependencyTerm > 0); // Only include those with remaining dependency

    // Extract financial position
    const totalOutstandingDebts = profile.totalLiabilities || 
      (Array.isArray(profile.liabilities) ? profile.liabilities.reduce((sum: number, item: LiabilityRecord) => sum + (Number(item.outstandingBalance) || 0), 0) : 0);
      
    const totalCurrentAssets = profile.totalAssets || 
      (Array.isArray(profile.assets) ? profile.assets.reduce((sum: number, item: AssetRecord) => sum + (Number(item.value) || 0), 0) : 0);
      
    const totalEstateValue = totalCurrentAssets - totalOutstandingDebts;

    // Spouse information
    const spouseFullName = profile.spouseName || profile.spouse?.fullName || '';
    const spouseAverageMonthlyIncome = profile.spouse?.income || 0;
    const combinedHouseholdIncome = grossMonthlyIncome + spouseAverageMonthlyIncome;
    const clientIncomePercentage = combinedHouseholdIncome > 0 
      ? (grossMonthlyIncome / combinedHouseholdIncome) * 100 
      : 100;

    // Household expenditure (from budget module)
    const totalHouseholdMonthlyExpenditure = profile.totalMonthlyExpenses || 0;

    // Existing cover (from policies) - Load from correct location
    const policiesKey = `policies:client:${clientId}`;
    const allPolicies = await kv.get(policiesKey) || [];
    
    // Filter to get only risk-planning policies
    const riskPolicies = Array.isArray(allPolicies) 
      ? allPolicies.filter((p: PolicyRecord) => p.categoryId === 'risk-planning')
      : [];
    
    // FIRST: Try to get pre-calculated totals using the exact key names from Key Manager
    const clientKeysKey = `user_profile:${clientId}:client_keys`;
    const calculatedTotals = await kv.get(clientKeysKey);
    
    log.info('📊 Loading policy data and calculated totals', { 
      clientId,
      allPoliciesCount: allPolicies.length,
      riskPoliciesCount: riskPolicies.length,
      hasCalculatedTotals: !!calculatedTotals,
      totals: calculatedTotals
    });
    
    // Helper: Get total from either calculated totals or by summing individual policies
    const getTotalForKey = (totalKeyId: string, individualKeyId: string): number => {
      // Strategy 1: Use pre-calculated total if available
      if (calculatedTotals && calculatedTotals[totalKeyId] !== undefined) {
        const value = Number(calculatedTotals[totalKeyId]) || 0;
        log.info(`✅ Using pre-calculated total for ${totalKeyId}: ${value}`);
        return value;
      }
      
      // Strategy 2: Calculate from individual policy fields
      if (!riskPolicies || riskPolicies.length === 0) {
        log.info(`⚠️ No policies found for risk-planning`);
        return 0;
      }
      
      log.info(`📊 Calculating ${totalKeyId} from ${riskPolicies.length} policies`);
      
      let total = 0;
      
      // Load the product schema to get field-to-key mappings
      const schemaKey = 'config:schema:risk-planning';
      
      // Simple approach: sum all fields in all policies that match the individual key patterns
      for (const policy of riskPolicies) {
        if (!policy.data) continue;
        
        for (const [fieldId, value] of Object.entries(policy.data)) {
          const fieldValue = Number(value) || 0;
          if (fieldValue <= 0) continue;
          
          const fieldIdLower = fieldId.toLowerCase();
          let matches = false;
          
          // Pattern match based on individual key type
          switch (individualKeyId) {
            case 'risk_life_cover':
              matches = fieldIdLower.includes('life') && (fieldIdLower.includes('cover') || fieldIdLower.includes('assurance') || fieldIdLower.includes('sum'));
              break;
            case 'risk_severe_illness':
              matches = fieldIdLower.includes('severe') || fieldIdLower.includes('illness') || 
                       fieldIdLower.includes('dread') || fieldIdLower.includes('critical');
              break;
            case 'risk_disability':
              matches = (fieldIdLower.includes('disability') || fieldIdLower.includes('tpd')) && 
                       !fieldIdLower.includes('income');
              break;
            case 'risk_temporary_icb':
              matches = (fieldIdLower.includes('temporary') || fieldIdLower.includes('short')) && 
                       (fieldIdLower.includes('icb') || fieldIdLower.includes('income'));
              break;
            case 'risk_permanent_icb':
              matches = (fieldIdLower.includes('permanent') || fieldIdLower.includes('long')) && 
                       (fieldIdLower.includes('icb') || fieldIdLower.includes('income'));
              break;
          }
          
          if (matches) {
            total += fieldValue;
            log.info(`✅ Added ${fieldValue} from field ${fieldId} in policy ${policy.id || 'unknown'}`);
          }
        }
      }
      
      log.info(`📊 Calculated total for ${totalKeyId}: ${total}`);
      return total;
    };
    
    const existingCover = {
      life: {
        personal: getTotalForKey('risk_life_cover_total', 'risk_life_cover'),
        group: 0, // TODO: Separate group vs personal when group data available
      },
      disability: {
        personal: getTotalForKey('risk_disability_total', 'risk_disability'),
        group: 0,
      },
      severeIllness: {
        personal: getTotalForKey('risk_severe_illness_total', 'risk_severe_illness'),
        group: 0,
      },
      incomeProtection: {
        temporary: {
          personal: getTotalForKey('risk_temporary_icb_total', 'risk_temporary_icb'),
          group: 0,
        },
        permanent: {
          personal: getTotalForKey('risk_permanent_icb_total', 'risk_permanent_icb'),
          group: 0,
        },
      },
    };
    
    log.info('📊 Final existing cover totals:', existingCover);
    
    // Default income protection settings
    const incomeProtectionSettings = {
      temporary: {
        benefitPeriod: '12-months' as const,
      },
      permanent: {
        escalation: 'cpi-linked' as const,
      },
    };

    return {
      grossMonthlyIncome,
      grossAnnualIncome,
      netMonthlyIncome,
      netAnnualIncome,
      incomeEscalationAssumption: 6, // Default 6%
      currentAge,
      retirementAge,
      employmentType,
      dependants,
      totalOutstandingDebts,
      totalCurrentAssets,
      totalEstateValue,
      spouseFullName,
      spouseAverageMonthlyIncome,
      combinedHouseholdIncome,
      clientIncomePercentage,
      totalHouseholdMonthlyExpenditure,
      existingCover,
      incomeProtectionSettings,
    };
  } catch (error) {
    log.error('❌ Error auto-populating from profile:', error);
    throw error;
  }
}

/**
 * Calculate Life Cover
 */
function calculateLifeCover(input: RiskCalcInputData) {
  const { 
    netAnnualIncome,
    totalOutstandingDebts,
    totalEstateValue,
    dependants,
    spouseFullName,
    spouseAverageMonthlyIncome,
    existingCover,
  } = input;
  
  // Step 1: Immediate Capital
  const estateCosts = Math.max(0, totalEstateValue * ESTATE_COSTS_PERCENTAGE);
  const immediateCapital = {
    outstandingDebt: totalOutstandingDebts,
    funeralFinalExpenses: FUNERAL_FINAL_EXPENSES,
    estateCosts,
    total: totalOutstandingDebts + FUNERAL_FINAL_EXPENSES + estateCosts,
  };
  
  // Step 2: Income Replacement Capital
  const numDependants = dependants.length;
  const isSingleIncome = !spouseAverageMonthlyIncome || spouseAverageMonthlyIncome === 0;
  
  let incomeMultiple = 0;
  
  if (numDependants === 0) {
    incomeMultiple = LIFE_COVER_MULTIPLES.SINGLE_NO_DEPENDANTS;
  } else {
    const baseMultiple = isSingleIncome
      ? LIFE_COVER_MULTIPLES.SINGLE_INCOME_HOUSEHOLD_BASE
      : LIFE_COVER_MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE;
    
    incomeMultiple = baseMultiple + ((numDependants - 1) * LIFE_COVER_MULTIPLES.ADDITIONAL_PER_DEPENDANT);
  }
  
  const incomeReplacementCapital = {
    netAnnualIncome,
    incomeMultiple,
    total: netAnnualIncome * incomeMultiple,
  };
  
  // Step 3: Education Capital
  const educationCapitalPerDependant = dependants.map((dep: DependantRecord) => ({
    dependantId: dep.id,
    relationship: dep.relationship,
    monthlyEducationCost: dep.monthlyEducationCost,
    dependencyTerm: dep.dependencyTerm,
    total: dep.monthlyEducationCost * 12 * dep.dependencyTerm,
  }));
  
  const educationCapitalTotal = educationCapitalPerDependant.reduce(
    (sum: number, dep: { total: number }) => sum + dep.total, 
    0
  );
  
  const educationCapital = {
    perDependant: educationCapitalPerDependant,
    total: educationCapitalTotal,
  };
  
  // Step 4: Total Life Cover
  const grossNeed = immediateCapital.total + incomeReplacementCapital.total + educationCapital.total;
  
  const existingCoverData = {
    personal: existingCover.life.personal,
    group: existingCover.life.group,
    total: existingCover.life.personal + existingCover.life.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  const assumptions = [
    `Income multiple: ${incomeMultiple}× (${numDependants} dependant${numDependants !== 1 ? 's' : ''}, ${isSingleIncome ? 'single-income' : 'dual-income'} household)`,
    `Estate costs: ${(ESTATE_COSTS_PERCENTAGE * 100).toFixed(2)}% of net estate value`,
    `Funeral and final expenses: R${FUNERAL_FINAL_EXPENSES.toLocaleString()}`,
    `Net annual income: R${netAnnualIncome.toLocaleString()}`,
  ];
  
  const riskNotes = [
    'Life cover ensures dependants can maintain their standard of living and complete education.',
    'Capital replacement model assumes lump sum investment at retirement return rates.',
    'Review upon material life events (marriage, birth, divorce, debt changes).',
  ];
  
  return {
    immediateCapital,
    incomeReplacementCapital,
    educationCapital,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

/**
 * Calculate Disability Cover
 */
function calculateDisabilityCover(input: RiskCalcInputData) {
  const { netAnnualIncome, dependants, existingCover } = input;
  
  const numDependants = dependants.length;
  const disabilityMultiple = DISABILITY_MULTIPLE_BASE + numDependants;
  
  const capitalisedIncomeLoss = {
    netAnnualIncome,
    disabilityMultiple,
    total: netAnnualIncome * disabilityMultiple,
  };
  
  const additionalDisabilityCosts = {
    homeModifications: ADDITIONAL_DISABILITY_COSTS.HOME_MODIFICATIONS,
    vehicleAdaptation: ADDITIONAL_DISABILITY_COSTS.VEHICLE_ADAPTATION,
    medicalEquipment: ADDITIONAL_DISABILITY_COSTS.MEDICAL_EQUIPMENT,
    onceOffCareCosts: ADDITIONAL_DISABILITY_COSTS.ONCE_OFF_CARE_COSTS,
    total: Object.values(ADDITIONAL_DISABILITY_COSTS).reduce((sum, val) => sum + val, 0),
  };
  
  const grossNeed = capitalisedIncomeLoss.total + additionalDisabilityCosts.total;
  
  const existingCoverData = {
    personal: existingCover.disability.personal,
    group: existingCover.disability.group,
    total: existingCover.disability.personal + existingCover.disability.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  const assumptions = [
    `Disability income multiple: ${disabilityMultiple}× (base 10× + ${numDependants} dependant${numDependants !== 1 ? 's' : ''})`,
    `Net annual income: R${netAnnualIncome.toLocaleString()}`,
    'Additional costs: Home modifications, vehicle adaptation, medical equipment, care costs',
  ];
  
  const riskNotes = [
    'Lump sum disability cover provides capital to adapt living environment and replace lost income.',
    'Does not replace Income Protection (IP) – this is for permanent disability capital needs.',
    'Review if health status changes or dependant structure changes.',
  ];
  
  return {
    capitalisedIncomeLoss,
    additionalDisabilityCosts,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

/**
 * Calculate Severe Illness Cover
 */
function calculateSevereIllnessCover(input: RiskCalcInputData) {
  const { grossAnnualIncome, existingCover } = input;
  
  const incomeMultiple = SEVERE_ILLNESS_MULTIPLE;
  const grossNeed = grossAnnualIncome * incomeMultiple;
  
  const existingCoverData = {
    personal: existingCover.severeIllness.personal,
    group: existingCover.severeIllness.group,
    total: existingCover.severeIllness.personal + existingCover.severeIllness.group,
  };
  
  const netShortfall = Math.max(0, grossNeed - existingCoverData.total);
  
  const assumptions = [
    `Severe illness income multiple: ${incomeMultiple}×`,
    `Gross annual income: R${grossAnnualIncome.toLocaleString()}`,
  ];
  
  const riskNotes = [
    'Severe illness cover provides capital for medical treatment, lifestyle adjustments, and recovery period.',
    'Typically pays out on diagnosis of specified critical illnesses (e.g., cancer, heart attack, stroke).',
    'Review if health status changes or family medical history reveals new risks.',
  ];
  
  return {
    grossAnnualIncome,
    incomeMultiple,
    grossNeed,
    existingCover: existingCoverData,
    netShortfall,
    assumptions,
    riskNotes,
  };
}

/**
 * Calculate Income Protection
 */
function calculateIncomeProtection(input: RiskCalcInputData) {
  const { netMonthlyIncome, currentAge, retirementAge, existingCover, incomeProtectionSettings } = input;
  
  const calculatedNeed = netMonthlyIncome; // 100% of net monthly income
  const benefitTerm = retirementAge - currentAge;
  
  const temporary = {
    calculatedNeed,
    benefitPeriod: incomeProtectionSettings.temporary.benefitPeriod,
    existingCover: {
      personal: existingCover.incomeProtection.temporary.personal,
      group: existingCover.incomeProtection.temporary.group,
      total: existingCover.incomeProtection.temporary.personal + existingCover.incomeProtection.temporary.group,
    },
    netShortfall: Math.max(0, calculatedNeed - (existingCover.incomeProtection.temporary.personal + existingCover.incomeProtection.temporary.group)),
  };
  
  const permanent = {
    calculatedNeed,
    escalation: incomeProtectionSettings.permanent.escalation,
    benefitTerm,
    existingCover: {
      personal: existingCover.incomeProtection.permanent.personal,
      group: existingCover.incomeProtection.permanent.group,
      total: existingCover.incomeProtection.permanent.personal + existingCover.incomeProtection.permanent.group,
    },
    netShortfall: Math.max(0, calculatedNeed - (existingCover.incomeProtection.permanent.personal + existingCover.incomeProtection.permanent.group)),
  };
  
  const assumptions = [
    `Calculated need: R${calculatedNeed.toLocaleString()}/month (100% of net monthly income)`,
    `Benefit term: ${benefitTerm} years (to retirement)`,
  ];
  
  const riskNotes = [
    'Income Protection (IP) replaces monthly income during temporary or permanent disability.',
    'Temporary IP: Short-term disability with benefit period (e.g., 6, 12, or 24 months).',
    'Permanent IP: Long-term disability paying until retirement or recovery.',
    'Personal and Group IP do NOT cross-offset – each type must meet its own shortfall.',
  ];
  
  return {
    temporary,
    permanent,
    assumptions,
    riskNotes,
  };
}

/**
 * Perform all Risk Planning calculations
 */
function performCalculations(inputData: RiskCalcInputData, userId: string) {
  return {
    life: calculateLifeCover(inputData),
    disability: calculateDisabilityCover(inputData),
    severeIllness: calculateSevereIllnessCover(inputData),
    incomeProtection: calculateIncomeProtection(inputData),
    metadata: {
      calculatedAt: new Date().toISOString(),
      calculatedBy: userId,
      systemVersion: SYSTEM_VERSION,
    },
  };
}

// ==================== ROUTE HANDLERS ====================

/**
 * GET /client-profile/:clientId
 * Get client profile data for auto-population
 */
riskPlanningFnaRoutes.get('/client-profile/:clientId', async (c) => {
  try {
    log.info('📥 GET /risk-planning-fna/client-profile/:clientId');
    await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    const profileData = await autoPopulateFromProfile(clientId);
    
    return c.json({
      success: true,
      data: profileData,
    });
  } catch (error) {
    log.error('❌ Error fetching client profile:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * GET /client/:clientId/latest
 * Get latest published FNA for a client
 */
riskPlanningFnaRoutes.get('/client/:clientId/latest', async (c) => {
  try {
    log.info('📥 GET /risk-planning-fna/client/:clientId/latest');
    await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    const latestKey = `risk_planning_fna:${clientId}:latest`;
    const latest = await kv.get(latestKey);
    
    if (!latest) {
      return c.json({
        success: true,
        data: null,
      });
    }
    
    return c.json({
      success: true,
      data: latest,
    });
  } catch (error) {
    log.error('❌ Error fetching latest FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * GET /client/:clientId/list
 * List all FNAs for a client
 */
riskPlanningFnaRoutes.get('/client/:clientId/list', async (c) => {
  try {
    log.info('📥 GET /risk-planning-fna/client/:clientId/list');
    await authenticateUser(c.req.header('Authorization'));
    
    const clientId = c.req.param('clientId');
    const listKey = `risk_planning_fna:${clientId}:list`;
    const list = await kv.get(listKey) || [];
    
    // Load all FNAs
    const fnas = await Promise.all(
      list.map(async (fnaId: string) => {
        const fna = await kv.get(`risk_planning_fna:${fnaId}`);
        return fna ? {
          id: fna.id,
          clientId: fna.clientId,
          clientName: fna.clientName,
          status: fna.status,
          createdAt: fna.createdAt,
          updatedAt: fna.updatedAt,
          publishedAt: fna.publishedAt,
          publishedBy: fna.publishedBy,
          version: fna.version,
          createdBy: fna.createdBy,
        } : null;
      })
    );
    
    const validFnas = fnas.filter(fna => fna !== null);
    
    return c.json({
      success: true,
      data: validFnas,
    });
  } catch (error) {
    log.error('❌ Error listing FNAs:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * POST /create
 * Create new FNA draft
 */
riskPlanningFnaRoutes.post('/create', async (c) => {
  try {
    log.info('📥 POST /risk-planning-fna/create');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const body = await c.req.json();
    const { clientId, inputData, calculations, adjustments, finalNeeds } = body;
    
    if (!clientId) {
      return c.json({
        success: false,
        error: 'clientId is required',
      }, 400);
    }
    
    // Validate input data
    const validationResult = CreateRiskPlanningFnaSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json({
        success: false,
        error: formatZodError(validationResult.error),
      }, 400);
    }
    
    // Generate FNA ID and version
    const fnaId = generateFnaId();
    const version = await getNextVersionNumber(clientId);
    
    // Get client name
    const profileKey = `user_profile:${clientId}:personal_info`;
    const profile = await kv.get(profileKey);
    const firstName = profile?.firstName || '';
    const lastName = profile?.lastName || '';
    const clientName = `${firstName} ${lastName}`.trim() || profile?.fullName || profile?.name || 'Unknown Client';
    
    // Perform calculations if inputData provided and calculations not already provided
    let finalCalculations = calculations;
    if (inputData && !finalCalculations) {
      finalCalculations = performCalculations(inputData, user.id);
    }
    
    // Compliance disclaimers (standard set)
    const complianceDisclaimers = [
      'This analysis is based on the information you have provided and the assumptions stated herein. Any changes to your circumstances may affect the recommendations.',
      'The recommended insurance cover amounts are subject to underwriting approval by insurance providers. Final terms, conditions, premiums, and exclusions will be determined during the underwriting process.',
      'This Financial Needs Analysis does not constitute financial advice. Please consult with your licensed financial adviser before making any decisions regarding insurance products.',
      'All calculations are estimates based on current financial data and standard actuarial assumptions. Actual outcomes may vary.',
      'You should review your insurance coverage regularly (at least annually) or when significant life events occur (marriage, divorce, birth of children, career changes, etc.).',
      'The analysis assumes all information provided is accurate and complete. Navigate Wealth is not responsible for recommendations based on incorrect or incomplete information.',
      'This report is prepared in accordance with the Financial Advisory and Intermediary Services (FAIS) Act requirements for South African financial service providers.',
    ];
    
    // Create FNA object
    const fna = {
      id: fnaId,
      clientId,
      clientName,
      status: 'draft',
      inputData: inputData || null,
      calculations: finalCalculations,
      adjustments: adjustments || {},
      finalNeeds: finalNeeds || [],
      complianceDisclaimers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.id,
      version,
    };
    
    // Save to KV store
    await kv.set(`risk_planning_fna:${fnaId}`, fna);
    
    // Add to client's FNA list
    const listKey = `risk_planning_fna:${clientId}:list`;
    const list = await kv.get(listKey) || [];
    list.push(fnaId);
    await kv.set(listKey, list);
    
    log.info('✅ Risk Planning FNA created:', { fnaId, clientId, version });
    
    return c.json({
      success: true,
      data: fna,
    });
  } catch (error) {
    log.error('❌ Error creating FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * GET /:fnaId
 * Get FNA by ID
 */
riskPlanningFnaRoutes.get('/:fnaId', async (c) => {
  try {
    log.info('📥 GET /risk-planning-fna/:fnaId');
    await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    return c.json({
      success: true,
      data: fna,
    });
  } catch (error) {
    log.error('❌ Error fetching FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * PUT /update/:fnaId
 * Update FNA
 */
riskPlanningFnaRoutes.put('/update/:fnaId', async (c) => {
  try {
    log.info('📥 PUT /risk-planning-fna/update/:fnaId');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const updates = await c.req.json();
    
    // Validate input data
    const validationResult = UpdateRiskPlanningFnaSchema.safeParse(updates);
    if (!validationResult.success) {
      return c.json({
        success: false,
        error: formatZodError(validationResult.error),
      }, 400);
    }
    
    // Load existing FNA
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    if (fna.status === 'published') {
      return c.json({
        success: false,
        error: 'Cannot update published FNA. Unpublish first.',
      }, 400);
    }
    
    // Apply updates
    const updatedFna = {
      ...fna,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Recalculate if inputData changed
    if (updates.inputData) {
      updatedFna.calculations = performCalculations(updates.inputData, user.id);
    }
    
    // Save
    await kv.set(`risk_planning_fna:${fnaId}`, updatedFna);
    
    log.info('✅ Risk Planning FNA updated:', { fnaId });
    
    return c.json({
      success: true,
      data: updatedFna,
    });
  } catch (error) {
    log.error('❌ Error updating FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * POST /publish/:fnaId
 * Publish FNA (lock calculations)
 */
riskPlanningFnaRoutes.post('/publish/:fnaId', async (c) => {
  try {
    log.info('📥 POST /risk-planning-fna/publish/:fnaId');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    if (fna.status === 'published') {
      return c.json({
        success: false,
        error: 'FNA is already published',
      }, 400);
    }
    
    // Mark as published
    const publishedFna = {
      ...fna,
      status: 'published',
      publishedAt: new Date().toISOString(),
      publishedBy: user.id,
      updatedAt: new Date().toISOString(),
    };
    
    // Save
    await kv.set(`risk_planning_fna:${fnaId}`, publishedFna);
    
    // Update latest published for client
    await kv.set(`risk_planning_fna:${fna.clientId}:latest`, publishedFna);
    
    log.info('✅ Risk Planning FNA published:', { fnaId, clientId: fna.clientId });
    
    // Phase 4: Auto-snapshot net worth on FNA publish (fire-and-forget, §13)
    if (fna.clientId) {
      snapshotService.autoSnapshotFromKV(fna.clientId, 'risk-fna-publish').catch(() => {});
    }

    return c.json({
      success: true,
      data: publishedFna,
    });
  } catch (error) {
    log.error('❌ Error publishing FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * POST /unpublish/:fnaId
 * Unpublish FNA (return to draft)
 */
riskPlanningFnaRoutes.post('/unpublish/:fnaId', async (c) => {
  try {
    log.info('📥 POST /risk-planning-fna/unpublish/:fnaId');
    const user = await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    if (fna.status !== 'published') {
      return c.json({
        success: false,
        error: 'FNA is not published',
      }, 400);
    }
    
    // Return to draft
    const unpublishedFna = {
      ...fna,
      status: 'draft',
      publishedAt: undefined,
      publishedBy: undefined,
      updatedAt: new Date().toISOString(),
    };
    
    // Save
    await kv.set(`risk_planning_fna:${fnaId}`, unpublishedFna);
    
    log.info('✅ Risk Planning FNA unpublished:', { fnaId });
    
    return c.json({
      success: true,
      data: unpublishedFna,
    });
  } catch (error) {
    log.error('❌ Error unpublishing FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * DELETE /archive/:fnaId
 * Archive FNA (soft delete)
 */
riskPlanningFnaRoutes.delete('/archive/:fnaId', async (c) => {
  try {
    log.info('📥 DELETE /risk-planning-fna/archive/:fnaId');
    await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    // Mark as archived (soft delete for compliance)
    const archivedFna = {
      ...fna,
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Save archived version
    await kv.set(`risk_planning_fna:${fnaId}`, archivedFna);
    
    // Remove from latest published pointer if this was the latest
    const latestKey = `risk_planning_fna:${fna.clientId}:latest`;
    const latest = await kv.get(latestKey);
    if (latest && latest.id === fnaId) {
      await kv.del(latestKey);
      log.info('✅ Removed from latest published pointer:', { fnaId });
    }
    
    // Remove from client's FNA list
    const listKey = `risk_planning_fna:${fna.clientId}:list`;
    const list = await kv.get(listKey) || [];
    const updatedList = list.filter((id: string) => id !== fnaId);
    await kv.set(listKey, updatedList);
    log.info('✅ Removed from client FNA list:', { fnaId });
    
    log.info('✅ Risk Planning FNA archived:', { fnaId });
    
    return c.json({
      success: true,
      message: 'FNA archived successfully',
    });
  } catch (error) {
    log.error('❌ Error archiving FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

/**
 * DELETE /hard-delete/:fnaId
 * Permanently delete FNA from database (use with caution)
 * Note: This is a hard delete for development/testing purposes
 */
riskPlanningFnaRoutes.delete('/hard-delete/:fnaId', async (c) => {
  try {
    log.info('📥 DELETE /risk-planning-fna/hard-delete/:fnaId');
    await authenticateUser(c.req.header('Authorization'));
    
    const fnaId = c.req.param('fnaId');
    const fna = await kv.get(`risk_planning_fna:${fnaId}`);
    
    if (!fna) {
      return c.json({
        success: false,
        error: 'FNA not found',
      }, 404);
    }
    
    // Hard delete the FNA record
    await kv.del(`risk_planning_fna:${fnaId}`);
    log.info('✅ Deleted FNA record:', { fnaId });
    
    // Remove from latest published pointer if this was the latest
    const latestKey = `risk_planning_fna:${fna.clientId}:latest`;
    const latest = await kv.get(latestKey);
    if (latest && latest.id === fnaId) {
      await kv.del(latestKey);
      log.info('✅ Removed from latest published pointer:', { fnaId });
    }
    
    // Remove from client's FNA list
    const listKey = `risk_planning_fna:${fna.clientId}:list`;
    const list = await kv.get(listKey) || [];
    const updatedList = list.filter((id: string) => id !== fnaId);
    await kv.set(listKey, updatedList);
    log.info('✅ Removed from client FNA list:', { fnaId });
    
    log.info('✅ Risk Planning FNA permanently deleted:', { fnaId });
    
    return c.json({
      success: true,
      message: 'FNA permanently deleted',
    });
  } catch (error) {
    log.error('❌ Error deleting FNA:', error);
    return c.json({
      success: false,
      error: getErrMsg(error),
    }, 500);
  }
});

// Root handlers for health check
riskPlanningFnaRoutes.get('/', (c) => c.json({ service: 'risk-planning-fna', status: 'active', version: SYSTEM_VERSION }));
riskPlanningFnaRoutes.get('', (c) => c.json({ service: 'risk-planning-fna', status: 'active', version: SYSTEM_VERSION }));

export default riskPlanningFnaRoutes;