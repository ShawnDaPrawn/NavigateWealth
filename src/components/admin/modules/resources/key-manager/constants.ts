/**
 * Key Manager Constants
 * Central constants for icons, colors, and key usage mapping
 */

import { 
  Shield, 
  Heart, 
  PiggyBank, 
  TrendingUp, 
  Users, 
  FileText, 
  Calculator,
  UserCircle,
  Phone,
  Fingerprint,
  MapPin,
  Briefcase,
  Activity,
  Home,
  Building,
  Target,
  DollarSign,
  Coins,
  Gem,
  Lock
} from 'lucide-react';
import { ProductKeyCategory } from './types';

// Category icons mapping
export const CATEGORY_ICONS: Record<ProductKeyCategory, React.ElementType> = {
  risk: Shield,
  medical_aid: Heart,
  retirement_pre: PiggyBank,
  retirement_post: Coins,
  invest_voluntary: TrendingUp,
  invest_guaranteed: Lock,
  employee_benefits: Users,
  employee_benefits_risk: Shield,
  employee_benefits_retirement: PiggyBank,
  estate_planning: FileText,
  tax: Calculator,
  profile_personal: UserCircle,
  profile_contact: Phone,
  profile_identity: Fingerprint,
  profile_address: MapPin,
  profile_employment: Briefcase,
  profile_health: Activity,
  profile_family: Home,
  profile_banking: Building,
  profile_risk: Target,
  profile_financial: DollarSign,
};

// Data type color mappings
export const DATA_TYPE_COLORS: Record<string, string> = {
  currency: 'bg-green-100 text-green-700 border-green-200',
  number: 'bg-blue-100 text-blue-700 border-blue-200',
  percentage: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  text: 'bg-gray-100 text-gray-700 border-gray-200',
  date: 'bg-purple-100 text-purple-700 border-purple-200',
  boolean: 'bg-amber-100 text-amber-700 border-amber-200',
};

// Module names - used across the platform
export const KEY_MODULES = {
  // FNA Modules
  RISK_FNA: 'Risk Planning FNA',
  MEDICAL_FNA: 'Medical FNA',
  RETIREMENT_FNA: 'Retirement FNA',
  INVESTMENT_INA: 'Investment INA',
  EMPLOYEE_BENEFITS: 'Employee Benefits',
  ESTATE_PLANNING_FNA: 'Estate Planning FNA',
  TAX_PLANNING_FNA: 'Tax Planning FNA',
  
  // Core Modules
  CLIENT_DASHBOARD: 'Client Portfolio Dashboard',
  POLICY_MANAGEMENT: 'Policy Management',
  ADVICE_ENGINE: 'Advice Engine AI',
  
  // Reports & Compliance
  FINANCIAL_REPORTS: 'Financial Reports',
  INVESTMENT_REPORTS: 'Investment Reports',
  COMPLIANCE: 'Compliance',
  
  // Record of Advice
  ROA_GENERATOR: 'Record of Advice Generator',
  
  // Admin Tools
  FORM_BUILDER: 'Form Builder',
  PRODUCT_CONFIG: 'Product Configuration',
} as const;

export type KeyModuleName = typeof KEY_MODULES[keyof typeof KEY_MODULES];

// Key usage mapping - which modules use which keys
// This defines the relationships between keys and where they are consumed
export const KEY_USAGE_MAP: Record<string, KeyModuleName[]> = {
  // Risk keys
  'risk_life_cover': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_severe_illness': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_disability': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_temporary_icb': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_permanent_icb': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_icb_waiting_period': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'risk_monthly_premium': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'risk_life_cover_total': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.ADVICE_ENGINE
  ],
  'risk_severe_illness_total': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD
  ],
  'risk_disability_total': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD
  ],
  'risk_temporary_icb_total': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD
  ],
  'risk_permanent_icb_total': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD
  ],
  'risk_total_premium': [
    KEY_MODULES.RISK_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  
  // Medical Aid keys
  'medical_aid_monthly_premium': [
    KEY_MODULES.MEDICAL_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'medical_aid_msa': [
    KEY_MODULES.POLICY_MANAGEMENT,
    KEY_MODULES.MEDICAL_FNA
  ],
  'medical_aid_late_joiner_penalty': [
    KEY_MODULES.POLICY_MANAGEMENT,
    KEY_MODULES.MEDICAL_FNA
  ],
  'medical_aid_hospital_tariff': [
    KEY_MODULES.POLICY_MANAGEMENT,
    KEY_MODULES.MEDICAL_FNA
  ],
  'medical_aid_plan_type': [
    KEY_MODULES.MEDICAL_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'medical_aid_dependents': [
    KEY_MODULES.MEDICAL_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'medical_aid_total_premium': [
    KEY_MODULES.MEDICAL_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  
  // Retirement keys
  'retirement_fund_value': [
    KEY_MODULES.RETIREMENT_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'retirement_monthly_contribution': [
    KEY_MODULES.RETIREMENT_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'retirement_fund_type': [
    KEY_MODULES.RETIREMENT_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'retirement_total_contribution': [
    KEY_MODULES.RETIREMENT_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'retirement_fund_value_total': [
    KEY_MODULES.RETIREMENT_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  
  // Post-Retirement keys
  'post_retirement_capital_value': [
    KEY_MODULES.RETIREMENT_FNA,
    KEY_MODULES.CLIENT_DASHBOARD,
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'post_retirement_drawdown_amount': [
    KEY_MODULES.RETIREMENT_FNA,
    KEY_MODULES.CLIENT_DASHBOARD,
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'post_retirement_capital_total': [
    KEY_MODULES.RETIREMENT_FNA,
    KEY_MODULES.CLIENT_DASHBOARD,
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'post_retirement_income_total': [
    KEY_MODULES.RETIREMENT_FNA,
    KEY_MODULES.CLIENT_DASHBOARD,
    KEY_MODULES.FINANCIAL_REPORTS
  ],

  // Investment keys
  'invest_current_value': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'invest_monthly_contribution': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'invest_product_type': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'invest_maturity_value': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.POLICY_MANAGEMENT,
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'invest_maturity_date': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.POLICY_MANAGEMENT,
    KEY_MODULES.INVESTMENT_REPORTS
  ],
  'invest_total_contribution': [
    KEY_MODULES.INVESTMENT_INA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  
  // Employee Benefits keys
  'eb_group_life_cover': [
    KEY_MODULES.EMPLOYEE_BENEFITS, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'eb_group_disability': [
    KEY_MODULES.EMPLOYEE_BENEFITS, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'eb_group_ip_monthly': [
    KEY_MODULES.EMPLOYEE_BENEFITS, 
    KEY_MODULES.POLICY_MANAGEMENT
  ],
  'eb_monthly_premium': [
    KEY_MODULES.EMPLOYEE_BENEFITS, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'eb_total_premium': [
    KEY_MODULES.EMPLOYEE_BENEFITS, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  
  // Estate Planning keys
  'estate_will_date': [
    KEY_MODULES.ESTATE_PLANNING_FNA, 
    KEY_MODULES.COMPLIANCE
  ],
  'estate_executor_appointed': [
    KEY_MODULES.ESTATE_PLANNING_FNA, 
    KEY_MODULES.COMPLIANCE
  ],
  'estate_trust_value': [
    KEY_MODULES.ESTATE_PLANNING_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD
  ],
  'estate_annual_fee': [
    KEY_MODULES.ESTATE_PLANNING_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'estate_total_annual_fee': [
    KEY_MODULES.ESTATE_PLANNING_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  
  // Tax keys
  'tax_annual_income': [
    KEY_MODULES.TAX_PLANNING_FNA, 
    KEY_MODULES.FINANCIAL_REPORTS, 
    KEY_MODULES.COMPLIANCE
  ],
  'tax_retirement_contributions': [
    KEY_MODULES.TAX_PLANNING_FNA, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'tax_medical_aid_credits': [
    KEY_MODULES.TAX_PLANNING_FNA, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'tax_annual_fee': [
    KEY_MODULES.TAX_PLANNING_FNA, 
    KEY_MODULES.POLICY_MANAGEMENT, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
  'tax_total_annual_fee': [
    KEY_MODULES.TAX_PLANNING_FNA, 
    KEY_MODULES.CLIENT_DASHBOARD, 
    KEY_MODULES.FINANCIAL_REPORTS
  ],
};

// Profile categories - for filtering client keys
export const PROFILE_CATEGORIES: ProductKeyCategory[] = [
  'profile_personal',
  'profile_contact',
  'profile_identity',
  'profile_address',
  'profile_employment',
  'profile_health',
  'profile_family',
  'profile_banking',
  'profile_risk',
  'profile_financial',
];

// Product categories - for filtering product keys
export const PRODUCT_CATEGORIES: ProductKeyCategory[] = [
  'risk',
  'medical_aid',
  'retirement_pre',
  'retirement_post',
  'invest_voluntary',
  'invest_guaranteed',
  'employee_benefits',
  'employee_benefits_risk',
  'employee_benefits_retirement',
  'estate_planning',
  'tax',
];