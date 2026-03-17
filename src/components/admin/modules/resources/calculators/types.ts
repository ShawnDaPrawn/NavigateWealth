export interface RetirementScenario {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  inputs: RetirementInputs;
  results: RetirementResults;
}

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  lifeExpectancyAge: number;
  currentSavings: number;
  contributionAmount: number;
  contributionFrequency: 'monthly' | 'annually';
  contributionGrowthRate: number; // Percentage
  nominalReturn: number; // Percentage
  inflation: number; // Percentage
  annualFee: number; // Percentage
  taxRate: number; // Percentage (optional)
  drawdownTargetMode: 'fixed' | 'replacement' | 'solve';
  drawdownTargetValue: number; // Value depends on mode (amount or percentage)
  isNominal: boolean; // Toggle for display
}

export interface RetirementResults {
  realReturn: number;
  netRealReturn: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  fvCurrentSavings: number;
  fvContributions: number;
  totalCapital: number;
  sustainableIncomeAnnual: number;
  sustainableIncomeMonthly: number;
  replacementRatio: number;
  fundsLastToAge: number | 'Forever' | 'Never';
  projectionData: ProjectionYear[];
}

export interface ProjectionYear {
  age: number;
  year: number; // Relative year 1, 2, 3...
  openingBalance: number;
  contributionsOrIncome: number; // Positive for contrib, negative for income
  growth: number;
  closingBalance: number;
  phase: 'accumulation' | 'drawdown';
}
