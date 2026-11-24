/**
 * Step 1 — calculation assumptions for the capital needs analysis.
 *
 * Adviser-only: the client's own intake does not show this tab, so an intake
 * calculates with the defaults. Income escalation is captured on the Income
 * tab and is shown here for reference because the real return depends on it.
 */

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../../ui/form';
import { NumberInputField } from '../../../../../ui/number-input';
import type { InformationGatheringFormValues } from '../../schema';
import { FNAFormPanel, FNAFormSection } from '../../../fna';

const FIELDS: ReadonlyArray<{
  name: keyof Pick<
    InformationGatheringFormValues,
    | 'investmentReturnAssumption'
    | 'educationInflationAssumption'
    | 'incomeReplacementRatio'
    | 'disabilityIncomeReplacementRatio'
  >;
  label: string;
  description: string;
}> = [
  {
    name: 'investmentReturnAssumption',
    label: 'Investment return (% a year)',
    description: 'What the insured capital is assumed to earn once paid out',
  },
  {
    name: 'educationInflationAssumption',
    label: 'Education inflation (% a year)',
    description: 'Yearly increase in school and university costs',
  },
  {
    name: 'incomeReplacementRatio',
    label: 'Income replacement on death (% of net income)',
    description:
      'Used only when no household expenditure is given; the client’s own spending falls away',
  },
  {
    name: 'disabilityIncomeReplacementRatio',
    label: 'Income replacement on disability (% of net income)',
    description: 'Share of net income to capitalise to retirement age',
  },
];

export function AssumptionsForm() {
  const form = useFormContext<InformationGatheringFormValues>();
  const ret = Number(form.watch('investmentReturnAssumption') || 0) / 100;
  const esc = Number(form.watch('incomeEscalationAssumption') || 0) / 100;
  const real = (1 + ret) / (1 + esc) - 1;
  const hint = 'text-[13px] leading-[18px] text-nw-muted tabular-nums';

  return (
    <FNAFormPanel>
      <FNAFormSection title="Economic and planning assumptions">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <FormField
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{f.label}</FormLabel>
                  <FormControl>
                    <NumberInputField decimals={2} className="sm:max-w-40" {...field} />
                  </FormControl>
                  <FormDescription className={hint}>{f.description}</FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          ))}
        </div>
        <p className={`mt-5 ${hint}`}>
          Real return over income escalation ({(esc * 100).toFixed(2)}%):{' '}
          {Number.isFinite(real) ? `${(real * 100).toFixed(2)}%` : '—'} a year. Needs are valued as
          the present value of escalating yearly payments at this real rate.
        </p>
      </FNAFormSection>
    </FNAFormPanel>
  );
}
