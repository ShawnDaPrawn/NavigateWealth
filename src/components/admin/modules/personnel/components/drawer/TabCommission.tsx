import { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { NumberInputField } from '../../../../../ui/number-input';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Tabs } from '../../../../../ui/tabs';
import { DollarSign, Plus } from 'lucide-react';
import { SegmentedList, SegmentedTrigger } from '../../../../layout/page';
import { Personnel } from '../../types';

interface TabCommissionProps {
  selectedPersonnel: Personnel;
}

type CommissionEntity = 'personal' | 'company';

export function TabCommission({ selectedPersonnel }: TabCommissionProps) {
  const [entity, setEntity] = useState<CommissionEntity>(
    selectedPersonnel.commissionEntity === 'company' ? 'company' : 'personal',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-green-600" aria-hidden="true" />
          Commission structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Standard split (%)</Label>
            <div className="flex items-center gap-2">
              <NumberInputField
                decimals={2}
                value={(selectedPersonnel.commissionSplit || 0) * 100}
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Base percentage of revenue retained by adviser.
            </p>
          </div>
          <div className="space-y-2">
            <Label id="commission-entity-label">Commission entity</Label>
            <Tabs value={entity} onValueChange={(v) => setEntity(v as CommissionEntity)}>
              <SegmentedList aria-labelledby="commission-entity-label">
                <SegmentedTrigger value="personal">Personal name</SegmentedTrigger>
                <SegmentedTrigger value="company">Registered company (Pty) Ltd</SegmentedTrigger>
              </SegmentedList>
            </Tabs>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="mb-3 font-medium">Referral codes</h4>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono">
              REF-{selectedPersonnel.lastName?.toUpperCase() || '001'}
            </Badge>
            <Button size="sm" variant="ghost" disabled aria-label="Add a reference (coming soon)">
              <Plus className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
