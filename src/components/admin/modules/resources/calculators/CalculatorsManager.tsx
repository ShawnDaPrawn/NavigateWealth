import React, { useState } from 'react';
import { CalculatorsList } from './CalculatorsList';
import { RetirementCalculator } from './RetirementCalculator';

export function CalculatorsManager() {
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

  if (activeCalculator === 'retirement') {
    return <RetirementCalculator onBack={() => setActiveCalculator(null)} />;
  }

  return <CalculatorsList onSelectCalculator={setActiveCalculator} />;
}
