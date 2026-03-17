import React from 'react';
import { useFormContext } from 'react-hook-form@7.55.0';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Alert, AlertDescription } from '../../../../../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '../../../../../ui/form';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { AlertCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import { INCOME_PROTECTION } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';

interface ExistingCoverFormProps {
  clientId?: string;
  isRecalculating: boolean;
  onRecalculate: () => void;
  hasClientKeys: boolean;
  isClientKeysError: boolean;
}

export function ExistingCoverForm({ 
  clientId, 
  isRecalculating, 
  onRecalculate, 
  hasClientKeys, 
  isClientKeysError 
}: ExistingCoverFormProps) {
  const form = useFormContext<InformationGatheringFormValues>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Existing Cover Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Manually enter existing cover or sync from saved policies.
          </p>
        </div>
        {clientId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRecalculate}
            disabled={isRecalculating}
            className="flex-shrink-0"
          >
            {isRecalculating ? (
              <div className="contents">
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Syncing...
              </div>
            ) : (
              <div className="contents">
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Load from Policies
              </div>
            )}
          </Button>
        )}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Mandatory Fix #3: Separate Personal and Group cover for accurate offset calculations.
          Do not cross-offset temporary and permanent income protection benefits.
        </AlertDescription>
      </Alert>
      
      {!hasClientKeys && !isClientKeysError && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-900">
            <strong>Note:</strong> Existing cover totals will auto-populate from saved policies once they are entered in the Product Configuration section.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Life Cover</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="existingCoverLifePersonal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Auto-populated from client key: risk_life_cover_total
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="existingCoverLifeGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Disability Cover</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="existingCoverDisabilityPersonal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Auto-populated from client key: risk_disability_total
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="existingCoverDisabilityGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Severe Illness Cover</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="existingCoverSevereIllnessPersonal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Auto-populated from client key: risk_severe_illness_total
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="existingCoverSevereIllnessGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Policies</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Income Protection - Temporary</CardTitle>
          <CardDescription>Offsets only against short-term benefits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="existingCoverIPTemporaryPersonal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Policies (monthly)</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="existingCoverIPTemporaryGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Policies (monthly)</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="ipTemporaryBenefitPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Benefit Period</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INCOME_PROTECTION.BENEFIT_PERIODS.map((period) => (
                      <SelectItem key={period.value} value={period.value}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Income Protection - Permanent</CardTitle>
          <CardDescription>Offsets only against benefits payable to retirement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="existingCoverIPPermanentPersonal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Policies (monthly)</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="existingCoverIPPermanentGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Policies (monthly)</FormLabel>
                  <FormControl>
                    <CurrencyInputField placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="ipPermanentEscalation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Escalation Option</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INCOME_PROTECTION.ESCALATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}