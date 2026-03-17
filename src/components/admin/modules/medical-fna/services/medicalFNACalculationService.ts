/**
 * Medical FNA Calculation Service
 * Performs all Medical Aid Needs Analysis calculations
 * Based on South African medical market and regulations
 */

import type {
  MedicalFNAInputs,
  MedicalFNAResults,
  HospitalCoverTier,
  HospitalCoverAssessment,
  DayToDayAssessment,
  ChronicCoverAssessment,
  AffordabilityAssessment,
  OverallRecommendation,
  SuitabilityScore,
  GapCoverNecessity,
  AffordabilityLevel
} from '../types';

// South African medical cost assumptions (2024/2025)
const SA_MEDICAL_COSTS = {
  averageGPVisit: 450,
  averageSpecialistVisit: 1200,
  averageDentistVisit: 800,
  averageOptometryVisit: 600,
  averageChronicMedicationMonthly: 850,
};

export class MedicalFNACalculationService {
  /**
   * Main calculation entry point
   */
  static calculate(inputs: MedicalFNAInputs): MedicalFNAResults {
    return {
      hospitalCover: this.assessHospitalCover(inputs),
      dayToDayCare: this.assessDayToDayCare(inputs),
      chronicCover: this.assessChronicCover(inputs),
      affordability: this.assessAffordability(inputs),
      overallRecommendation: this.generateOverallRecommendation(inputs),
    };
  }

  /**
   * 4.1 Determine Level of Required Hospital Cover (Tier 1-5)
   */
  private static assessHospitalCover(inputs: MedicalFNAInputs): HospitalCoverAssessment {
    const {
      clientAge,
      dependants,
      healthNeeds,
      currentPlan,
      preferences,
      netMonthlyIncome
    } = inputs;

    // Calculate required tier based on multiple factors
    const requiredTier = this.determineRequiredHospitalTier(inputs);
    const currentTier = this.identifyCurrentHospitalTier(currentPlan);

    // Assess hospital benefit adequacy
    const hospitalBenefitAdequacy = this.assessHospitalBenefitLevel(
      currentPlan.hospitalBenefitLevel,
      healthNeeds.expectedSpecialistVisitsPerYear,
      preferences.networkPreference
    );

    // Assess network adequacy
    const networkAdequacy = this.assessNetworkAdequacy(
      currentPlan.hospitalNetwork,
      preferences.networkPreference
    );

    // Assess specialist reimbursement risk
    const specialistReimbursementRisk = this.assessSpecialistRisk(
      currentPlan.hospitalBenefitLevel,
      healthNeeds.expectedSpecialistVisitsPerYear,
      currentPlan.hasGapCover
    );

    // Determine gap cover necessity
    const gapCoverResult = this.assessGapCoverNecessity(inputs);

    // Generate recommendations
    const recommendations: string[] = [];

    if (currentTier < requiredTier) {
      recommendations.push(`Upgrade to Tier ${requiredTier} plan (currently on Tier ${currentTier})`);
    }

    if (hospitalBenefitAdequacy === 'inadequate' || hospitalBenefitAdequacy === 'poor') {
      recommendations.push('Consider plan with higher hospital benefit reimbursement rate');
    }

    if (networkAdequacy === 'inadequate' && preferences.networkPreference === 'any-hospital') {
      recommendations.push('Switch to open network plan for greater hospital choice');
    }

    if (gapCoverResult.necessity === 'essential' && !currentPlan.hasGapCover) {
      recommendations.push('Gap cover is essential - high specialist shortfall risk');
    } else if (gapCoverResult.necessity === 'recommended' && !currentPlan.hasGapCover) {
      recommendations.push('Gap cover recommended to protect against specialist shortfalls');
    }

    if (currentTier > requiredTier && netMonthlyIncome < 50000) {
      recommendations.push('Current plan may be higher tier than needed - consider cost optimization');
    }

    return {
      requiredTier,
      requiredTierRationale: this.getTierRationale(requiredTier, inputs),
      currentTier,
      hospitalBenefitAdequacy,
      networkAdequacy,
      specialistReimbursementRisk,
      gapCoverNecessity: gapCoverResult.necessity,
      gapCoverRationale: gapCoverResult.rationale,
      recommendations: recommendations.length > 0 ? recommendations : ['Current hospital cover is appropriate'],
    };
  }

  /**
   * Determine required hospital tier (1-5)
   */
  private static determineRequiredHospitalTier(inputs: MedicalFNAInputs): HospitalCoverTier {
    const {
      clientAge,
      dependants,
      healthNeeds,
      preferences,
      netMonthlyIncome
    } = inputs;

    let score = 0;

    // Age factor
    if (clientAge > 60) score += 3;
    else if (clientAge > 45) score += 2;
    else if (clientAge < 30) score += 0;
    else score += 1;

    // Dependants factor
    score += Math.min(dependants.length, 3);

    // Health conditions
    if (healthNeeds.chronicConditions.length > 2) score += 3;
    else if (healthNeeds.chronicConditions.length > 0) score += 2;

    if (healthNeeds.recentHospitalAdmissions > 1) score += 2;
    if (healthNeeds.upcomingPlannedProcedures.length > 0) score += 2;
    if (healthNeeds.maternityPlanning) score += 2;

    // Specialist usage
    if (healthNeeds.expectedSpecialistVisitsPerYear >= 6) score += 3;
    else if (healthNeeds.expectedSpecialistVisitsPerYear >= 3) score += 2;
    else if (healthNeeds.expectedSpecialistVisitsPerYear >= 1) score += 1;

    // Financial capacity
    if (netMonthlyIncome < 20000) score -= 2;
    else if (netMonthlyIncome > 80000) score += 2;

    // Preferences
    if (preferences.networkPreference === 'any-hospital') score += 2;
    if (preferences.prioritizeHospitalCover) score += 2;
    if (preferences.outOfPocketTolerance === 'low') score += 2;

    // Map score to tier
    if (score <= 3) return 1; // Basic Hospital Plan
    if (score <= 6) return 2; // Hospital Plan + Gap Cover
    if (score <= 10) return 3; // Saver Plan
    if (score <= 14) return 4; // Comprehensive Plan
    return 5; // Premium Comprehensive

  }

  /**
   * Identify current hospital tier from plan details
   */
  private static identifyCurrentHospitalTier(plan: {
    planType?: string;
    hospitalBenefitLevel?: string;
    hasMedicalSavingsAccount?: boolean;
    hasGapCover?: boolean;
    [key: string]: unknown;
  }): HospitalCoverTier {
    const { planType, hospitalBenefitLevel, hasMedicalSavingsAccount, hasGapCover } = plan;

    if (planType === 'hospital-only') {
      return hasGapCover ? 2 : 1;
    }

    if (planType === 'saver') {
      return 3;
    }

    if (planType === 'comprehensive') {
      if (hospitalBenefitLevel >= 300) {
        return 5; // Premium comprehensive
      }
      return 4; // Standard comprehensive
    }

    if (planType === 'network') {
      return hasMedicalSavingsAccount ? 3 : 2;
    }

    return 3; // Default to mid-tier
  }

  /**
   * Get rationale for tier recommendation
   */
  private static getTierRationale(tier: HospitalCoverTier, inputs: MedicalFNAInputs): string {
    const rationales = {
      1: 'Based on your age, good health, low healthcare usage, and financial constraints, a basic hospital plan provides essential hospital cover while keeping costs manageable.',
      2: 'Your health profile requires solid hospital protection. A hospital plan with gap cover protects against specialist shortfalls (which typically range 200%-500% above scheme rates) while maintaining affordability.',
      3: 'Your moderate day-to-day medical usage (GP visits, dentistry, optometry) combined with hospital needs makes a saver plan optimal. You get predictable out-of-pocket costs and comprehensive hospital cover.',
      4: 'Your chronic conditions, dependants with ongoing medical needs, and frequent healthcare usage require comprehensive cover. This ensures minimal out-of-pocket exposure and full access to both hospital and day-to-day benefits.',
      5: 'Your health complexity, preference for freedom of choice (any specialist, any hospital), and need for premium chronic cover justify a top-tier comprehensive plan with maximum network flexibility and minimal restrictions.',
    };

    return rationales[tier];
  }

  /**
   * Assess hospital benefit level adequacy
   */
  private static assessHospitalBenefitLevel(
    benefitLevel: number,
    specialistVisits: number,
    networkPref: string
  ): SuitabilityScore {
    if (benefitLevel >= 300 && networkPref === 'any-hospital') return 'excellent';
    if (benefitLevel >= 200 && specialistVisits <= 2) return 'good';
    if (benefitLevel >= 200) return 'adequate';
    if (benefitLevel >= 100 && specialistVisits === 0) return 'adequate';
    if (benefitLevel >= 100) return 'inadequate';
    return 'poor';
  }

  /**
   * Assess network adequacy
   */
  private static assessNetworkAdequacy(
    network: string,
    preference: string
  ): SuitabilityScore {
    if (network === 'open' && preference === 'any-hospital') return 'excellent';
    if (network === 'open') return 'good';
    if (network === 'network' && preference !== 'any-hospital') return 'good';
    if (network === 'network') return 'adequate';
    if (network === 'designated' && preference === 'designated-ok') return 'adequate';
    return 'inadequate';
  }

  /**
   * Assess specialist reimbursement risk
   */
  private static assessSpecialistRisk(
    benefitLevel: number,
    specialistVisits: number,
    hasGapCover: boolean
  ): 'low' | 'medium' | 'high' | 'very-high' {
    if (hasGapCover && benefitLevel >= 200) return 'low';
    if (hasGapCover || benefitLevel >= 300) return 'low';
    if (benefitLevel >= 200 && specialistVisits <= 2) return 'medium';
    if (benefitLevel >= 200) return 'high';
    if (specialistVisits >= 4) return 'very-high';
    if (specialistVisits >= 2) return 'high';
    return 'medium';
  }

  /**
   * Assess gap cover necessity
   */
  private static assessGapCoverNecessity(inputs: MedicalFNAInputs): {
    necessity: GapCoverNecessity;
    rationale: string;
  } {
    const { currentPlan, healthNeeds, preferences } = inputs;

    // Gap cover not needed if already comprehensive high-tier
    if (currentPlan.hospitalBenefitLevel >= 500) {
      return {
        necessity: 'not-needed',
        rationale: 'Your plan pays 500%+ of scheme rates - gap cover is unnecessary'
      };
    }

    // Essential if high specialist usage and low reimbursement
    if (healthNeeds.expectedSpecialistVisitsPerYear >= 4 && currentPlan.hospitalBenefitLevel <= 100) {
      return {
        necessity: 'essential',
        rationale: 'High specialist usage combined with 100% scheme rate creates severe shortfall risk (specialists charge 300-600% of scheme rates)'
      };
    }

    // Recommended if moderate specialist usage
    if (healthNeeds.expectedSpecialistVisitsPerYear >= 2 && currentPlan.hospitalBenefitLevel <= 200) {
      return {
        necessity: 'recommended',
        rationale: 'Moderate specialist usage with shortfall risk - gap cover provides protection against unexpected specialist bills'
      };
    }

    // Essential if upcoming major procedures
    if (healthNeeds.upcomingPlannedProcedures.length > 0 && currentPlan.hospitalBenefitLevel <= 200) {
      return {
        necessity: 'essential',
        rationale: 'Planned procedures create high shortfall risk - gap cover essential for financial protection'
      };
    }

    // Optional if network-based and happy with DSP
    if (currentPlan.hospitalNetwork === 'designated' && preferences.specialistPreference === 'dsp-ok') {
      return {
        necessity: 'optional',
        rationale: 'Using designated service providers minimizes shortfall - gap cover is optional'
      };
    }

    // Recommended if low out-of-pocket tolerance
    if (preferences.outOfPocketTolerance === 'low') {
      return {
        necessity: 'recommended',
        rationale: 'Your preference for predictable costs makes gap cover a valuable safety net'
      };
    }

    return {
      necessity: 'optional',
      rationale: 'Low specialist usage and adequate reimbursement rates - gap cover is optional'
    };
  }

  /**
   * 4.2 Assess Day-to-Day Care Adequacy
   */
  private static assessDayToDayCare(inputs: MedicalFNAInputs): DayToDayAssessment {
    const { healthNeeds, currentPlan } = inputs;

    // Calculate expected annual costs
    const expectedAnnualGPCost = 
      healthNeeds.expectedGPVisitsPerYear * SA_MEDICAL_COSTS.averageGPVisit;
    
    const expectedAnnualSpecialistCost = 
      healthNeeds.expectedSpecialistVisitsPerYear * SA_MEDICAL_COSTS.averageSpecialistVisit;
    
    const expectedAnnualDentistCost = 
      healthNeeds.expectedDentistVisitsPerYear * SA_MEDICAL_COSTS.averageDentistVisit;
    
    const expectedAnnualOptometryCost = 
      healthNeeds.expectedOptometryVisitsPerYear * SA_MEDICAL_COSTS.averageOptometryVisit;
    
    const expectedAnnualChronicMedication = 
      healthNeeds.chronicMedicationCostMonthly * 12;
    
    const expectedAnnualOtherCosts = 2000; // Buffer for unexpected costs
    
    const totalExpectedDayToDayCost = 
      expectedAnnualGPCost +
      expectedAnnualSpecialistCost +
      expectedAnnualDentistCost +
      expectedAnnualOptometryCost +
      expectedAnnualChronicMedication +
      expectedAnnualOtherCosts;

    // Current plan coverage
    const currentMSAAllowance = currentPlan.msaAmountAnnual || 0;
    const currentDayToDayLimits = Object.values(currentPlan.dayToDayLimits || {})
      .reduce((sum, limit) => sum + limit, 0);
    
    const totalCurrentCoverage = currentMSAAllowance + currentDayToDayLimits;

    // Gap analysis
    const projectedOutOfPocketCost = Math.max(
      0,
      totalExpectedDayToDayCost - totalCurrentCoverage
    );

    // Adequacy score
    let adequacyScore: SuitabilityScore;
    const coverageRatio = totalCurrentCoverage / totalExpectedDayToDayCost;
    
    if (coverageRatio >= 1.2) adequacyScore = 'excellent'; // Overinsured
    else if (coverageRatio >= 0.9) adequacyScore = 'good';
    else if (coverageRatio >= 0.7) adequacyScore = 'adequate';
    else if (coverageRatio >= 0.5) adequacyScore = 'inadequate';
    else adequacyScore = 'poor';

    const isOverinsured = coverageRatio > 1.3;

    // Recommendations
    const recommendations: string[] = [];
    
    if (adequacyScore === 'poor' || adequacyScore === 'inadequate') {
      recommendations.push(`Expected R${projectedOutOfPocketCost.toFixed(0)} out-of-pocket annually - consider saver or comprehensive plan`);
    }
    
    if (isOverinsured) {
      recommendations.push('Current plan exceeds expected usage - consider downgrading to reduce wasted premium');
    }
    
    if (totalExpectedDayToDayCost > 15000 && !currentPlan.hasMedicalSavingsAccount) {
      recommendations.push('Moderate day-to-day usage - saver plan with MSA recommended');
    }

    if (recommendations.length === 0) {
      recommendations.push('Day-to-day benefits align well with expected usage');
    }

    return {
      expectedAnnualGPCost,
      expectedAnnualSpecialistCost,
      expectedAnnualDentistCost,
      expectedAnnualOptometryCost,
      expectedAnnualChronicMedication,
      expectedAnnualOtherCosts,
      totalExpectedDayToDayCost,
      currentMSAAllowance,
      currentDayToDayLimits,
      projectedOutOfPocketCost,
      adequacyScore,
      isOverinsured,
      recommendations,
    };
  }

  /**
   * 4.3 Assess Chronic Cover Adequacy
   */
  private static assessChronicCover(inputs: MedicalFNAInputs): ChronicCoverAssessment {
    const { healthNeeds, currentPlan } = inputs;

    const hasChronicConditions = healthNeeds.chronicConditions.length > 0;
    const isPMBQualifying = healthNeeds.isPMBQualifying;

    // Formulary adequacy
    let formularyAdequacy: SuitabilityScore;
    if (!hasChronicConditions) {
      formularyAdequacy = 'excellent'; // N/A
    } else if (currentPlan.chronicCoverLevel === 'Full CDL' && !currentPlan.chronicFormularyRestrictions) {
      formularyAdequacy = 'excellent';
    } else if (currentPlan.chronicCoverLevel === 'Full CDL') {
      formularyAdequacy = 'good';
    } else if (isPMBQualifying && currentPlan.chronicCoverLevel === 'PMB only') {
      formularyAdequacy = 'adequate';
    } else if (currentPlan.chronicCoverLevel === 'Limited') {
      formularyAdequacy = 'inadequate';
    } else {
      formularyAdequacy = 'poor';
    }

    // DSP compliance
    const dspComplianceRequired = healthNeeds.requiresDSPCompliance;
    let dspAccessibility: 'easy' | 'moderate' | 'difficult' = 'easy';
    
    if (dspComplianceRequired && currentPlan.hospitalNetwork === 'designated') {
      dspAccessibility = 'moderate';
    } else if (dspComplianceRequired) {
      dspAccessibility = 'easy';
    }

    // Overall chronic cover adequacy
    let chronicCoverAdequacy: SuitabilityScore;
    if (!hasChronicConditions) {
      chronicCoverAdequacy = 'excellent'; // N/A
    } else if (formularyAdequacy === 'excellent' || formularyAdequacy === 'good') {
      chronicCoverAdequacy = 'good';
    } else {
      chronicCoverAdequacy = formularyAdequacy;
    }

    // Identify gaps
    const identifiedGaps: string[] = [];
    if (hasChronicConditions && currentPlan.chronicCoverLevel !== 'Full CDL') {
      identifiedGaps.push('Chronic cover not at full CDL level');
    }
    if (currentPlan.chronicFormularyRestrictions) {
      identifiedGaps.push('Formulary restrictions may limit medication options');
    }
    if (dspComplianceRequired && dspAccessibility === 'difficult') {
      identifiedGaps.push('DSP compliance required - may limit provider choice');
    }

    // Recommendations
    const recommendations: string[] = [];
    if (hasChronicConditions && chronicCoverAdequacy === 'inadequate') {
      recommendations.push('Upgrade to plan with full chronic disease list (CDL) cover');
    }
    if (isPMBQualifying && currentPlan.chronicCoverLevel === 'PMB only') {
      recommendations.push('Consider comprehensive plan for better chronic medication access');
    }
    if (currentPlan.chronicFormularyRestrictions) {
      recommendations.push('Review formulary to ensure prescribed medications are covered');
    }
    if (!hasChronicConditions) {
      recommendations.push('No chronic conditions - current cover is adequate');
    }
    if (hasChronicConditions && identifiedGaps.length === 0) {
      recommendations.push('Chronic cover is comprehensive and adequate');
    }

    return {
      hasChronicConditions,
      chronicConditionsList: healthNeeds.chronicConditions,
      isPMBQualifying,
      formularyAdequacy,
      dspComplianceRequired,
      dspAccessibility,
      chronicCoverAdequacy,
      identifiedGaps,
      recommendations,
    };
  }

  /**
   * 4.4 Assess Affordability
   */
  private static assessAffordability(inputs: MedicalFNAInputs): AffordabilityAssessment {
    const { currentPlan, netMonthlyIncome, preferences } = inputs;

    // Calculate total premium
    const currentTotalPremium = 
      currentPlan.monthlyPremium + 
      (currentPlan.gapCoverMonthlyPremium || 0);

    // Premium to income ratio
    const premiumToIncomeRatio = (currentTotalPremium / netMonthlyIncome) * 100;

    // Affordability level
    let affordabilityLevel: AffordabilityLevel;
    if (premiumToIncomeRatio <= 10) affordabilityLevel = 'affordable';
    else if (premiumToIncomeRatio <= 15) affordabilityLevel = 'marginal';
    else if (premiumToIncomeRatio <= 20) affordabilityLevel = 'stretching';
    else affordabilityLevel = 'unsustainable';

    // Sustainability
    const isSustainable = premiumToIncomeRatio <= 15;
    let sustainabilityRationale: string;
    
    if (premiumToIncomeRatio <= 10) {
      sustainabilityRationale = 'Medical aid premium is well within recommended 10-12% of income threshold';
    } else if (premiumToIncomeRatio <= 15) {
      sustainabilityRationale = 'Premium is at upper limit of recommended range - sustainable but limited flexibility';
    } else if (premiumToIncomeRatio <= 20) {
      sustainabilityRationale = 'Premium exceeds recommended 15% threshold - may strain budget during emergencies';
    } else {
      sustainabilityRationale = 'Premium significantly exceeds income capacity - downgrade or cost optimization strongly recommended';
    }

    // Optimization opportunities
    let potentialSavingsMonthly = 0;
    let downgradeFeasible = false;

    if (premiumToIncomeRatio > 15) {
      // Estimate potential savings from downgrade
      potentialSavingsMonthly = currentTotalPremium * 0.25; // 25% savings estimate
      downgradeFeasible = true;
    }

    // Recommendations
    const recommendations: string[] = [];
    
    if (affordabilityLevel === 'unsustainable') {
      recommendations.push('URGENT: Premium is unsustainable - immediate downgrade or restructure required');
    } else if (affordabilityLevel === 'stretching') {
      recommendations.push('Consider downgrade to reduce financial strain');
    } else if (affordabilityLevel === 'marginal') {
      recommendations.push('Premium is at upper limit - review plan annually for optimization');
    } else {
      recommendations.push('Medical aid premium is affordable and sustainable');
    }

    if (preferences.preferenceDirection === 'reduce-premium' && downgradeFeasible) {
      recommendations.push(`Potential monthly savings: R${potentialSavingsMonthly.toFixed(0)} by optimizing plan tier`);
    }

    return {
      currentTotalPremium,
      premiumToIncomeRatio,
      affordabilityLevel,
      isSustainable,
      sustainabilityRationale,
      potentialSavingsMonthly,
      downgradeFeasible,
      recommendations,
    };
  }

  /**
   * 4.5 Generate Overall Recommendation
   */
  private static generateOverallRecommendation(inputs: MedicalFNAInputs): OverallRecommendation {
    // Run all assessments
    const hospitalCover = this.assessHospitalCover(inputs);
    const dayToDayCare = this.assessDayToDayCare(inputs);
    const chronicCover = this.assessChronicCover(inputs);
    const affordability = this.assessAffordability(inputs);

    // Determine overall verdict
    let verdict: OverallRecommendation['verdict'];
    let verdictRationale: string;

    if (affordability.affordabilityLevel === 'unsustainable') {
      verdict = 'consider-downgrade';
      verdictRationale = 'Current plan is financially unsustainable. Priority is reducing premium while maintaining essential hospital cover.';
    } else if (hospitalCover.currentTier < hospitalCover.requiredTier) {
      verdict = 'upgrade-required';
      verdictRationale = 'Your health needs require a higher tier of hospital cover than your current plan provides.';
    } else if (hospitalCover.gapCoverNecessity === 'essential' && !inputs.currentPlan.hasGapCover) {
      verdict = 'add-gap-cover';
      verdictRationale = 'Gap cover is essential to protect against significant specialist shortfall risk.';
    } else if (dayToDayCare.projectedOutOfPocketCost > 12000 && !inputs.currentPlan.hasMedicalSavingsAccount) {
      verdict = 'consider-saver';
      verdictRationale = 'Your day-to-day medical usage justifies a saver plan with medical savings account for better value.';
    } else if (hospitalCover.currentTier > hospitalCover.requiredTier && affordability.premiumToIncomeRatio > 12) {
      verdict = 'consider-downgrade';
      verdictRationale = 'Current plan tier exceeds your health needs - downgrading could reduce costs without compromising essential cover.';
    } else if (
      hospitalCover.hospitalBenefitAdequacy === 'adequate' &&
      dayToDayCare.adequacyScore === 'adequate' &&
      affordability.affordabilityLevel === 'affordable'
    ) {
      verdict = 'keep-current';
      verdictRationale = 'Current plan appropriately matches your health needs and budget. No immediate changes required.';
    } else {
      verdict = 'comprehensive-review';
      verdictRationale = 'Multiple areas require attention - comprehensive review recommended to optimize coverage and costs.';
    }

    // Generate priority actions
    const priorityActions: OverallRecommendation['priorityActions'] = [];

    if (hospitalCover.gapCoverNecessity === 'essential' && !inputs.currentPlan.hasGapCover) {
      priorityActions.push({
        action: 'Add gap cover to protect against specialist shortfalls',
        priority: 'high',
        impact: 'Protects against potential R20,000-R100,000+ shortfalls per hospital admission'
      });
    }

    if (hospitalCover.currentTier < hospitalCover.requiredTier) {
      priorityActions.push({
        action: `Upgrade from Tier ${hospitalCover.currentTier} to Tier ${hospitalCover.requiredTier}`,
        priority: 'high',
        impact: 'Ensures adequate hospital and health coverage for your needs'
      });
    }

    if (chronicCover.chronicCoverAdequacy === 'inadequate' || chronicCover.chronicCoverAdequacy === 'poor') {
      priorityActions.push({
        action: 'Upgrade chronic cover to full CDL',
        priority: 'high',
        impact: 'Ensures chronic medication is covered without formulary restrictions'
      });
    }

    if (affordability.affordabilityLevel === 'unsustainable') {
      priorityActions.push({
        action: 'Immediate plan restructure to reduce premium',
        priority: 'high',
        impact: `Save approximately R${affordability.potentialSavingsMonthly.toFixed(0)}/month`
      });
    }

    if (dayToDayCare.adequacyScore === 'poor') {
      priorityActions.push({
        action: 'Add day-to-day benefits or medical savings account',
        priority: 'medium',
        impact: `Reduce projected R${dayToDayCare.projectedOutOfPocketCost.toFixed(0)} out-of-pocket costs`
      });
    }

    if (priorityActions.length === 0) {
      priorityActions.push({
        action: 'Annual review to ensure continued adequacy',
        priority: 'low',
        impact: 'Proactive monitoring of changing health and financial needs'
      });
    }

    // Calculate overall score (0-100)
    const scores = {
      hospital: this.scoreToNumber(hospitalCover.hospitalBenefitAdequacy),
      dayToDayCare: this.scoreToNumber(dayToDayCare.adequacyScore),
      chronic: this.scoreToNumber(chronicCover.chronicCoverAdequacy),
      affordability: this.affordabilityToNumber(affordability.affordabilityLevel),
    };

    const overallScore = Math.round(
      (scores.hospital * 0.4 + 
       scores.dayToDayCare * 0.25 + 
       scores.chronic * 0.2 + 
       scores.affordability * 0.15) 
    );

    // Identify strengths and weaknesses
    const strengthsIdentified: string[] = [];
    const weaknessesIdentified: string[] = [];

    if (hospitalCover.hospitalBenefitAdequacy === 'excellent' || hospitalCover.hospitalBenefitAdequacy === 'good') {
      strengthsIdentified.push('Strong hospital cover protection');
    } else {
      weaknessesIdentified.push('Hospital cover may be inadequate for needs');
    }

    if (dayToDayCare.adequacyScore === 'excellent' || dayToDayCare.adequacyScore === 'good') {
      strengthsIdentified.push('Day-to-day benefits align with usage');
    } else if (dayToDayCare.adequacyScore === 'inadequate' || dayToDayCare.adequacyScore === 'poor') {
      weaknessesIdentified.push('Significant day-to-day out-of-pocket exposure');
    }

    if (inputs.currentPlan.hasGapCover) {
      strengthsIdentified.push('Gap cover provides specialist shortfall protection');
    }

    if (affordability.affordabilityLevel === 'affordable') {
      strengthsIdentified.push('Premium is sustainable and affordable');
    } else if (affordability.affordabilityLevel === 'stretching' || affordability.affordabilityLevel === 'unsustainable') {
      weaknessesIdentified.push('Premium may be financially unsustainable');
    }

    if (chronicCover.chronicCoverAdequacy === 'good' || chronicCover.chronicCoverAdequacy === 'excellent') {
      strengthsIdentified.push('Comprehensive chronic disease cover');
    } else if (chronicCover.hasChronicConditions) {
      weaknessesIdentified.push('Chronic cover may have gaps or restrictions');
    }

    return {
      verdict,
      verdictRationale,
      priorityActions,
      overallScore,
      strengthsIdentified,
      weaknessesIdentified,
    };
  }

  /**
   * Helper: Convert suitability score to number (0-100)
   */
  private static scoreToNumber(score: SuitabilityScore): number {
    const mapping: Record<SuitabilityScore, number> = {
      'excellent': 100,
      'good': 80,
      'adequate': 60,
      'inadequate': 40,
      'poor': 20,
    };
    return mapping[score];
  }

  /**
   * Helper: Convert affordability to number (0-100)
   */
  private static affordabilityToNumber(level: AffordabilityLevel): number {
    const mapping: Record<AffordabilityLevel, number> = {
      'affordable': 100,
      'marginal': 70,
      'stretching': 40,
      'unsustainable': 10,
    };
    return mapping[level];
  }
}