import { Calculator } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { SoonBadge } from '../../../layout/page';

interface CalculatorsListProps {
  onSelectCalculator: (id: string) => void;
}

const SOON = [{ title: 'Tax calculator' }, { title: 'Estate duty estimator' }];

export function CalculatorsList({ onSelectCalculator }: CalculatorsListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-3 rounded-xl border border-nw-line bg-white p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-nw-bg">
          <Calculator className="h-5 w-5 text-nw-text-2" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-nw-ink">Retirement planner</h2>
          <p className="mt-1 text-sm text-nw-text-3">
            Retirement capital and income projection with real-return adjustments.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => onSelectCalculator('retirement')}
          aria-label="Launch retirement planner"
        >
          Launch
        </Button>
      </div>

      {SOON.map((entry) => (
        <div
          key={entry.title}
          className="flex flex-col gap-3 rounded-xl border border-dashed border-nw-line bg-white p-5 opacity-70"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-nw-bg">
            <Calculator className="h-5 w-5 text-nw-text-3" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-nw-text-2">
              {entry.title} <SoonBadge />
            </h2>
            <p className="mt-1 text-sm text-nw-text-3">Coming soon</p>
          </div>
        </div>
      ))}
    </div>
  );
}
