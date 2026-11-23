import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../../ui/form';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { NumberInputField } from '../../../../../ui/number-input';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { RELATIONSHIP_OPTIONS } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';
import { FNAFormPanel, FNAFormSection } from '../../../fna';

export function DependantsForm() {
  const form = useFormContext<InformationGatheringFormValues>();

  const {
    fields: dependantFields,
    append: appendDependant,
    remove: removeDependant,
  } = useFieldArray({
    control: form.control,
    name: 'dependants',
  });

  const handleAddDependant = () => {
    appendDependant({
      id: `dep-${Date.now()}`,
      relationship: '',
      dependencyTerm: '',
      monthlyEducationCost: '',
    });
  };

  const watchGrossMonthly = form.watch('grossMonthlyIncome');
  const watchSpouseIncome = form.watch('spouseAverageMonthlyIncome');

  const spouseIncome = watchSpouseIncome ? Number(watchSpouseIncome) : 0;
  const combinedHousehold = (watchGrossMonthly ? Number(watchGrossMonthly) : 0) + spouseIncome;
  const clientIncomePercentage =
    combinedHousehold > 0
      ? ((watchGrossMonthly ? Number(watchGrossMonthly) : 0) / combinedHousehold) * 100
      : 100;

  const hint = 'text-[13px] leading-[18px] text-nw-muted tabular-nums';

  return (
    <FNAFormPanel>
      <FNAFormSection
        title="Dependants"
        description="Everyone who relies on the client financially."
        actions={
          dependantFields.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={handleAddDependant}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add dependant
            </Button>
          ) : undefined
        }
      >
        {dependantFields.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-nw-line-heavy bg-nw-paper-3 px-4 py-8 text-center">
            <p className="font-medium text-nw-ink">No dependants yet</p>
            <p className="text-[13px] text-nw-muted">
              Add a child, spouse or anyone else the client supports.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleAddDependant}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add dependant
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {dependantFields.map((field, index) => (
              <li
                key={field.id}
                className="rounded-lg border border-nw-line p-4"
                aria-label={`Dependant ${index + 1}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-nw-ink">Dependant {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDependant(index)}
                    aria-label={`Remove dependant ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name={`dependants.${index}.relationship`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RELATIONSHIP_OPTIONS.map((rel) => (
                              <SelectItem key={rel} value={rel}>
                                {rel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`dependants.${index}.dependencyTerm`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dependency term (years)</FormLabel>
                        <FormControl>
                          <NumberInputField placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`dependants.${index}.monthlyEducationCost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly cost</FormLabel>
                        <FormControl>
                          <CurrencyInputField {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </FNAFormSection>

      <FNAFormSection title="Spouse" description="Optional. Leave blank if not applicable.">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="spouseFullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spouse full name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="spouseAverageMonthlyIncome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spouse average monthly income</FormLabel>
                <FormControl>
                  <CurrencyInputField {...field} />
                </FormControl>
                <FormDescription className={hint}>
                  Household {formatCurrency(combinedHousehold * 12)} a year · client earns{' '}
                  {clientIncomePercentage.toFixed(1)}%
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </FNAFormSection>
    </FNAFormPanel>
  );
}
