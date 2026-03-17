import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form@7.55.0';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../../../ui/form';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { RELATIONSHIP_OPTIONS } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';

export function DependantsForm() {
  const form = useFormContext<InformationGatheringFormValues>();
  
  const { fields: dependantFields, append: appendDependant, remove: removeDependant } = useFieldArray({
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
  const clientIncomePercentage = combinedHousehold > 0 
    ? ((watchGrossMonthly ? Number(watchGrossMonthly) : 0) / combinedHousehold) * 100 
    : 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dependants</CardTitle>
              <CardDescription>Add all financial dependants</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddDependant}>
              <Plus className="h-4 w-4 mr-1" />
              Add Dependant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {dependantFields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No dependants added. Click "Add Dependant" to begin.
            </div>
          ) : (
            dependantFields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Dependant {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDependant(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name={`dependants.${index}.relationship`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RELATIONSHIP_OPTIONS.map((rel) => (
                              <SelectItem key={rel} value={rel}>{rel}</SelectItem>
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
                        <FormLabel>Dependency Term (years) *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
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
                        <FormLabel>Monthly Cost *</FormLabel>
                        <FormControl>
                          <CurrencyInputField placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Spouse Information</CardTitle>
          <CardDescription>Optional - provide if married or in partnership</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="spouseFullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Spouse Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} />
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
                <FormLabel>Spouse Average Monthly Income</FormLabel>
                <FormControl>
                  <CurrencyInputField placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <Label className="text-sm">Combined Household Income (Derived)</Label>
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-medium">
              {formatCurrency(combinedHousehold * 12)}/year
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Client Income as % of Household (Derived)</Label>
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 font-medium">
              {clientIncomePercentage.toFixed(1)}%
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
