import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../../ui/card';
import { Separator } from '../../../../../ui/separator';
import { formatCurrency } from '../../utils';
import type { DisabilityCoverCalculation } from '../../types';

interface DisabilityCoverResultProps {
  calculation: DisabilityCoverCalculation;
}

export function DisabilityCoverResult({ calculation }: DisabilityCoverResultProps) {
  const { capitalisedIncomeLoss, additionalDisabilityCosts, grossNeed, existingCover, netShortfall, assumptions } = calculation;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lump Sum Disability Cover</CardTitle>
        <CardDescription>Total and permanent disability calculation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capitalised Income Loss ({capitalisedIncomeLoss.disabilityMultiple}×)</span>
            <span>{formatCurrency(capitalisedIncomeLoss.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Additional Disability Costs</span>
            <span>{formatCurrency(additionalDisabilityCosts.total)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Gross Disability Need</span>
            <span className="text-primary">{formatCurrency(grossNeed)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Existing Cover (Personal + Group)</span>
            <span>{formatCurrency(existingCover.total)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Net Shortfall</span>
            <span className={netShortfall > 0 ? 'text-destructive' : 'text-green-600'}>
              {formatCurrency(netShortfall)}
            </span>
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
