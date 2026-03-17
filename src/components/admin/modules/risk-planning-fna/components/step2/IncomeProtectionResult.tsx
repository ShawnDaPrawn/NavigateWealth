import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../ui/card';
import { Separator } from '../../../../../ui/separator';
import { Badge } from '../../../../../ui/badge';
import { Alert, AlertDescription } from '../../../../../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils';
import type { IncomeProtectionCalculation } from '../../types';

interface IncomeProtectionResultProps {
  calculation: IncomeProtectionCalculation;
}

export function IncomeProtectionResult({ calculation }: IncomeProtectionResultProps) {
  const { temporary, permanent, assumptions } = calculation;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Protection</CardTitle>
        <CardDescription>Temporary and permanent income replacement</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Temporary IP */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            Temporary Income Protection
            <Badge variant="secondary">{temporary.benefitPeriod}</Badge>
          </h4>
          
          {temporary.exceedsLimit && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Calculated need exceeds typical insurer limits and may be restricted by underwriting.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Calculated Need (100% Net)</span>
              <span>{formatCurrency(temporary.calculatedNeed)}/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurable Maximum</span>
              <span>{formatCurrency(temporary.insurableMaximum)}/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Existing Cover</span>
              <span>{formatCurrency(temporary.existingCover.total)}/month</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Net Shortfall</span>
              <span className={temporary.netShortfall > 0 ? 'text-destructive' : 'text-green-600'}>
                {formatCurrency(temporary.netShortfall)}/month
              </span>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Permanent IP */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            Permanent Income Protection
            <Badge variant="secondary">{permanent.escalation}</Badge>
            <Badge variant="outline">{permanent.benefitTerm} years</Badge>
          </h4>
          
          {permanent.exceedsLimit && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Calculated need exceeds typical insurer limits and may be restricted by underwriting.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Calculated Need (100% Net)</span>
              <span>{formatCurrency(permanent.calculatedNeed)}/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurable Maximum</span>
              <span>{formatCurrency(permanent.insurableMaximum)}/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Existing Cover</span>
              <span>{formatCurrency(permanent.existingCover.total)}/month</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Net Shortfall</span>
              <span className={permanent.netShortfall > 0 ? 'text-destructive' : 'text-green-600'}>
                {formatCurrency(permanent.netShortfall)}/month
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs font-medium mb-2">Assumptions:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {assumptions.map((assumption, idx) => (
              <li key={idx}>• {assumption}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
