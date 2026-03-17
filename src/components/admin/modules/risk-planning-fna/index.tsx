/**
 * Risk Planning FNA Module
 * Entry point for the Financial Needs Analysis - Risk Planning tool
 * 
 * South African FAIS-compliant risk planning module
 * Implements deterministic, auditable calculations for:
 * - Life Cover (Death) – Capital Replacement Model
 * - Lump Sum Disability Cover
 * - Severe Illness Cover
 * - Temporary Income Protection
 * - Permanent Income Protection
 */

import { RiskPlanningFNAWizard } from './components/RiskPlanningFNAWizard';
import { RiskPlanningFNAResultsView } from './components/RiskPlanningFNAResultsView';

export { RiskPlanningFNAWizard, RiskPlanningFNAResultsView };
export default RiskPlanningFNAWizard;