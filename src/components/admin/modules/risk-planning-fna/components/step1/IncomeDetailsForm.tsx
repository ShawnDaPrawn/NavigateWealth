import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form@7.55.0';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '../../../../../ui/form';
import { Separator } from '../../../../../ui/separator';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { formatCurrency } from '../../utils';
import { EMPLOYMENT_TYPE_LABELS } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';

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
  const calculatedEstateValue = (watchAssets ? Number(watchAssets) : 0) - (watchDebts ? Number(watchDebts) : 0);
  
  // Auto-sync estate worth field with calculated value when assets/debts change
  // But allow manual override by user
  useEffect(() => {
    const currentEstateWorth = Number(watchEstateWorth || 0);
    // Only auto-update if the field is empty or equals zero
    if (currentEstateWorth === 0 || watchEstateWorth === '' || watchEstateWorth === '0') {
      form.setValue('estateWorth', calculatedEstateValue.toString());
    }
  }, [watchAssets, watchDebts, calculatedEstateValue, form, watchEstateWorth]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Income Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="grossMonthlyIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Gross Monthly Income</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Gross Annual Income (Derived)</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                {formatCurrency(grossAnnual)}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="netMonthlyIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Net Monthly Income</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Net Annual Income (Derived)</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                {formatCurrency(netAnnual)}
              </div>
            </div>
          </div>
          
          <FormField
            control={form.control}
            name="incomeEscalationAssumption"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Annual Income Escalation Assumption (%)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="6" className="text-sm" {...field} />
                </FormControl>
                <FormDescription className="text-xs">Expected annual income increase percentage</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="currentAge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Current Age</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="35" className="text-sm" {...field} />
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
                  <FormLabel className="text-sm font-medium">Retirement Age</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="65" className="text-sm" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Employment Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Financial Position</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="totalOutstandingDebts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Total Outstanding Debts</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">All liabilities (home loan, car finance, credit cards, etc.)</FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalCurrentAssets"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Total Current Assets</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">All assets (property, investments, savings, etc.)</FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="estateWorth"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Estate Worth / Net Worth</FormLabel>
                <FormControl>
                  <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                </FormControl>
                <FormDescription className="text-xs">
                  Auto-calculated as Assets - Debts ({formatCurrency(calculatedEstateValue)}). You can manually override this value if needed.
                </FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
          
          <Separator />
          
          <FormField
            control={form.control}
            name="totalHouseholdMonthlyExpenditure"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Total Household Monthly Expenditure</FormLabel>
                <FormControl>
                  <CurrencyInputField placeholder="0" className="text-sm" {...field} />
                </FormControl>
                <FormDescription className="text-xs">Monthly household expenses</FormDescription>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
