import React from 'react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { DollarSign, Plus } from 'lucide-react';
import { Personnel } from '../../types';

interface TabCommissionProps {
  selectedPersonnel: Personnel;
}

export function TabCommission({ selectedPersonnel }: TabCommissionProps) {
  return (
    <Card>
      <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Commission Structure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Standard Split (%)</Label>
            <div className="flex items-center gap-2">
                <Input type="number" defaultValue={(selectedPersonnel.commissionSplit || 0) * 100} />
                <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">Base percentage of revenue retained by adviser.</p>
          </div>
          <div className="space-y-2">
            <Label>Commission Entity</Label>
            <Select defaultValue={selectedPersonnel.commissionEntity || 'personal'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Personal Name</SelectItem>
                <SelectItem value="company">Registered Company (Pty Ltd)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Referral Codes</h4>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono">REF-{selectedPersonnel.lastName?.toUpperCase() || '001'}</Badge>
            <Button size="sm" variant="ghost"><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
