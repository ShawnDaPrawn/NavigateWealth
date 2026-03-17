/**
 * Step 3: Manual Adjustment
 * 
 * Behaviour Rules:
 * - Adviser can override system recommendations
 * - All overrides must include justification notes
 * - Side-by-side view of system calculation vs override
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Shield, Users, Wallet, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Switch } from '../../../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { MedicalFNAResults, MedicalFNAAdjustments } from '../types';

interface Step3Props {
  calculations: MedicalFNAResults;
  initialAdjustments: MedicalFNAAdjustments;
  onNext: (adjustments: MedicalFNAAdjustments) => void;
  onBack: () => void;
}

export function Step3ManualAdjustment({ calculations, initialAdjustments, onNext, onBack }: Step3Props) {
  const [adjustments, setAdjustments] = useState<MedicalFNAAdjustments>(initialAdjustments);

  const handleOverrideChange = (field: keyof MedicalFNAAdjustments, value: string | number | boolean) => {
    setAdjustments(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const AdjustmentCard = ({ 
    title, 
    icon: Icon, 
    systemValue, 
    overrideValue, 
    onOverrideChange,
    options,
    type = 'select' 
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    systemValue: string;
    overrideValue: string | number | boolean | undefined;
    onOverrideChange: (value: string) => void;
    options?: Array<{ value: string; label: string }>;
    type?: string;
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1 block">
            System Calculation
          </Label>
          <div className="p-2 bg-muted/50 rounded text-foreground font-medium">
            {systemValue}
          </div>
        </div>
        <div>
          <Label className="text-xs text-primary uppercase font-semibold tracking-wider mb-1 block">
            Adviser Override
          </Label>
          {type === 'select' ? (
            <Select 
              value={overrideValue || systemValue} 
              onValueChange={onOverrideChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select override..." />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt: { value: string; label: string }) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : type === 'switch' ? (
            <div className="flex items-center space-x-2 pt-2">
               <Switch 
                 checked={overrideValue !== undefined ? overrideValue : (systemValue === 'Recommended')} 
                 onCheckedChange={onOverrideChange}
               />
               <span className="text-sm">
                 {(overrideValue !== undefined ? overrideValue : (systemValue === 'Recommended')) ? 'Yes' : 'No'}
               </span>
            </div>
          ) : (
            <Input 
              value={overrideValue || systemValue}
              onChange={(e) => onOverrideChange(e.target.value)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          You can override any system recommendations below. All overrides should be documented in the notes section for compliance.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdjustmentCard
          title="In-Hospital Cover"
          icon={Shield}
          systemValue={calculations.recommendedInHospitalCover}
          overrideValue={adjustments.hospitalCoverOverride}
          onOverrideChange={(val: string) => handleOverrideChange('hospitalCoverOverride', val)}
          options={['100%', '200%']}
        />
        
        <AdjustmentCard
          title="Medical Savings Account"
          icon={Wallet}
          systemValue={calculations.msaRecommended ? "Recommended" : "Not Recommended"}
          overrideValue={adjustments.msaOverride}
          onOverrideChange={(val: boolean) => handleOverrideChange('msaOverride', val)}
          type="switch"
        />

        <AdjustmentCard
          title="Dependents"
          icon={Users}
          systemValue={calculations.recommendedDependents}
          overrideValue={adjustments.dependentsOverride}
          onOverrideChange={(val: string) => handleOverrideChange('dependentsOverride', val)}
          type="text"
        />

        <AdjustmentCard
          title="Late Joiner Penalty"
          icon={Clock}
          systemValue={calculations.ljpBand}
          overrideValue={adjustments.ljpBandOverride}
          onOverrideChange={(val: string) => handleOverrideChange('ljpBandOverride', val)}
          options={['0%', '5%', '25%', '50%', '75%']}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adviser Notes / Justification</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea 
            placeholder="Explain any adjustments made to the system recommendations..."
            className="min-h-[100px]"
            value={adjustments.notes || ''}
            onChange={(e) => handleOverrideChange('notes', e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 2
        </Button>
        <Button type="button" onClick={() => onNext(adjustments)} size="lg">
          Continue to Finalise
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}