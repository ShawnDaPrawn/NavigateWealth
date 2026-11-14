import { DsButton, SoonBadge } from '../../../layout/page';

interface CalculatorsListProps {
  onSelectCalculator: (id: string) => void;
}

const SOON = [{ title: 'Tax calculator' }, { title: 'Estate duty estimator' }];

/** RE-Calculators: three plain cards — the live one launches, the others say "Soon". */
export function CalculatorsList({ onSelectCalculator }: CalculatorsListProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      <section className="ds-card ds-card-b flex flex-col gap-2.5">
        <h2 className="text-[14px] font-semibold text-nw-ink">Retirement planner</h2>
        <span className="ds-meta">
          Retirement capital and income projection with real-return adjustments.
        </span>
        <DsButton
          size="sm"
          variant="primary"
          className="self-start"
          onClick={() => onSelectCalculator('retirement')}
          aria-label="Launch retirement planner"
        >
          Launch
        </DsButton>
      </section>

      {SOON.map((entry) => (
        <section key={entry.title} className="ds-card ds-card-b flex flex-col gap-2.5">
          <h2 className="text-[14px] font-semibold text-nw-ink">{entry.title}</h2>
          <span className="ds-meta">Coming soon</span>
          <span className="self-start">
            <SoonBadge />
          </span>
        </section>
      ))}
    </div>
  );
}
