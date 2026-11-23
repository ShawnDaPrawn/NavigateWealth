import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '../../../../../ui/form';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { NumberInputField } from '../../../../../ui/number-input';
import { formatCurrency } from '../../utils';
import { EMPLOYMENT_TYPE_LABELS } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';
import { FNAFormPanel, FNAFormSection } from '../../../fna';

export function IncomeDetailsForm() {
  const form = useFormContext<InformationGatheringFormValues>();

  // Watch values for derived calculations
  const watchGrossMonthly = form.watch('grossMonthlyIncome');
  const watchNetMonthly = form.watch('netMonthlyIncome');
  const watchAssets = form.watch('totalCurrentAssets');
  const watchDebts = form.watch('totalOutstandingDebts');
  const watchEstateWorth = form.watch('estateWorth');

  const grossAnnual = watchGrossMonthly ? Number(watchGrossMonthly) * 12 : 0;
  const netAnnual = watchNetMonthly ? Number(watchNetMonthly) * 12 : 0;

  // Calculate estate value from assets - debts
  const calculatedEstateValue =
    (watchAssets ? Number(watchAssets) : 0) - (watchDebts ? Number(watchDebts) : 0);

  // Auto-sync estate worth field with calculated value when assets/debts change
  // But allow manual override by user
  useEffect(() => {
    const currentEstateWorth = Number(watchEstateWorth || 0);
    // Only auto-update if the field is empty or equals zero
    if (currentEstateWorth === 0 || watchEstateWorth === '' || watchEstateWorth === '0') {
      form.setValue('estateWorth', calculatedEstateValue.toString());
    }
  }, [watchAssets, watchDebts, calculatedEstateValue, form, watchEstateWorth]);

  const currentAge = Number(form.watch('currentAge') || 0);
  const retirementAge = Number(form.watch('retirementAge') || 0);
  const yearsToRetirement = retirementAge - currentAge;

  const hint = 'text-[13px] leading-[18px] text-nw-muted tabular-nums';

  return (
    <FNAFormPanel>
      <FNAFormSection title="Income">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="grossMonthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gross monthly income</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {formatCurrency(grossAnnual)} a year
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="netMonthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Net monthly income</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  {formatCurrency(netAnnual)} a year
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="incomeEscalationAssumption"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Annual income escalation (%)</FormLabel>
                <FormControl>
                  <NumberInputField
                    decimals={2}
                    placeholder="6"
                    className="sm:max-w-40"
                    {...field}
                  />
                </FormControl>
                <FormDescription className={hint}>Expected yearly increase</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      </FNAFormSection>

      <FNAFormSection title="Personal">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <FormField
            control={form.control}
            name="currentAge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current age</FormLabel>
                <FormControl>
                  <NumberInputField placeholder="35" {...field} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="retirementAge"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retirement age</FormLabel>
                <FormControl>
                  <NumberInputField placeholder="65" {...field} />
                </FormControl>
                {currentAge > 0 && yearsToRetirement > 0 && (
                  <FormDescription className={hint}>
                    {yearsToRetirement} year{yearsToRetirement === 1 ? '' : 's'} to go
                  </FormDescription>
                )}
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Employment type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      </FNAFormSection>

      <FNAFormSection title="Financial position">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="totalCurrentAssets"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total current assets</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>Property, investments, savings</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalOutstandingDebts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total outstanding debts</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  Home loan, vehicle finance, credit cards
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="estateWorth"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-2">
                  <FormLabel>Estate worth / net worth</FormLabel>
                  <span className="rounded-sm bg-nw-violet-tint px-1.5 py-0.5 text-[11px] font-semibold text-nw-violet-hover">
                    Calculated
                  </span>
                </div>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  Assets less debts ({formatCurrency(calculatedEstateValue)}). Type to override.
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalHouseholdMonthlyExpenditure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Household monthly expenditure</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>
      </FNAFormSection>
    </FNAFormPanel>
  );
}
