import { CalculatorsList } from './CalculatorsList';
import { RetirementCalculator } from './RetirementCalculator';
import { useBreadcrumbTrail, useUrlState } from '../../../layout/page';

const CALCULATORS = ['none', 'retirement'] as const;

/** Calculator cards; the retirement planner opens as a page of its own (?calculator=retirement). */
export function CalculatorsManager() {
  const [activeCalculator, setActiveCalculator] = useUrlState('calculator', 'none', CALCULATORS);

  useBreadcrumbTrail(
    activeCalculator === 'retirement'
      ? [
          { label: 'Calculators', onClick: () => setActiveCalculator('none') },
          { label: 'Retirement Planner' },
        ]
      : [{ label: 'Calculators' }],
  );

  if (activeCalculator === 'retirement') {
    return <RetirementCalculator onBack={() => setActiveCalculator('none')} />;
  }

  return (
    <CalculatorsList
      onSelectCalculator={(id) =>
        setActiveCalculator(
          (CALCULATORS as readonly string[]).includes(id) ? (id as 'retirement') : 'none',
        )
      }
    />
  );
}
