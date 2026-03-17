/**
 * Step 3: Adviser Manual Adjustment
 * 
 * Behaviour Rules:
 * - Adviser may override Rand values ONLY
 * - System must retain both original calculated value AND override value
 * - Override reason is MANDATORY
 * - Override classification is MANDATORY (dropdown)
 * - Display warnings if override significantly differs from calculated need
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form@7.55.0';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Edit2, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Separator } from '../../../../ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { formatCurrency } from '../utils';
import { OVERRIDE_CLASSIFICATIONS } from '../constants';
import type { RiskCalculations, Adjustments, Override, OverrideClassification } from '../types';

interface Step3Props {
  calculations: RiskCalculations;
  initialAdjustments: Adjustments;
  onNext: (adjustments: Adjustments) => void;
  onBack: () => void;
}

type OverrideType = 'life' | 'disability' | 'severeIllness' | 'incomeProtectionTemporary' | 'incomeProtectionPermanent';

interface OverrideFormData {
  overrideValue: string;
  reason: string;
  classification: OverrideClassification | '';
}

export function Step3ManualAdjustment({ calculations, initialAdjustments, onNext, onBack }: Step3Props) {
  const [adjustments, setAdjustments] = useState<Adjustments>(initialAdjustments);
  const [editingType, setEditingType] = useState<OverrideType | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideFormData>({
    overrideValue: '',
    reason: '',
    classification: '',
  });
  
  // Open override dialog
  const handleOpenOverride = (type: OverrideType, originalValue: number) => {
    const existing = adjustments[type];
    setEditingType(type);
    setOverrideForm({
      overrideValue: existing ? existing.overrideValue.toString() : originalValue.toString(),
      reason: existing?.reason || '',
      classification: existing?.classification || '',
    });
  };
  
  // Save override
  const handleSaveOverride = () => {
    if (!editingType || !overrideForm.classification || !overrideForm.reason.trim()) {
      return;
    }
    
    const originalValue = getOriginalValue(editingType);
    const overrideValue = Number(overrideForm.overrideValue);
    
    const override: Override = {
      originalValue,
      overrideValue,
      reason: overrideForm.reason.trim(),
      classification: overrideForm.classification as OverrideClassification,
      overriddenAt: new Date().toISOString(),
      overriddenBy: 'Current User', // TODO: Get from auth context
    };
    
    setAdjustments({
      ...adjustments,
      [editingType]: override,
    });
    
    setEditingType(null);
    setOverrideForm({ overrideValue: '', reason: '', classification: '' });
  };
  
  // Remove override
  const handleRemoveOverride = (type: OverrideType) => {
    const newAdjustments = { ...adjustments };
    delete newAdjustments[type];
    setAdjustments(newAdjustments);
  };
  
  // Get original calculated value
  const getOriginalValue = (type: OverrideType): number => {
    switch (type) {
      case 'life':
        return calculations.life.netShortfall;
      case 'disability':
        return calculations.disability.netShortfall;
      case 'severeIllness':
        return calculations.severeIllness.netShortfall;
      case 'incomeProtectionTemporary':
        return calculations.incomeProtection.temporary.netShortfall;
      case 'incomeProtectionPermanent':
        return calculations.incomeProtection.permanent.netShortfall;
    }
  };
  
  // Get label for override type
  const getTypeLabel = (type: OverrideType): string => {
    switch (type) {
      case 'life':
        return 'Life Cover';
      case 'disability':
        return 'Disability Cover';
      case 'severeIllness':
        return 'Severe Illness Cover';
      case 'incomeProtectionTemporary':
        return 'Income Protection (Temporary)';
      case 'incomeProtectionPermanent':
        return 'Income Protection (Permanent)';
    }
  };
  
  // Handle proceed to next step
  const handleProceed = () => {
    onNext(adjustments);
  };
  
  // Calculate variance percentage
  const getVariancePercentage = (original: number, override: number): number => {
    if (original === 0) return 0;
    return ((override - original) / original) * 100;
  };
  
  // Render override card
  const renderOverrideCard = (
    type: OverrideType,
    title: string,
    originalValue: number,
    isMonthly: boolean = false
  ) => {
    const override = adjustments[type];
    const hasOverride = !!override;
    const finalValue = hasOverride ? override.overrideValue : originalValue;
    const variance = hasOverride ? getVariancePercentage(originalValue, override.overrideValue) : 0;
    const isSignificantVariance = Math.abs(variance) > 20;
    
    return (
      <Card key={type}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {hasOverride && (
                <CardDescription className="mt-1">
                  Override applied by {override.overriddenBy}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              {hasOverride && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOverride(type)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
              <Button
                variant={hasOverride ? "secondary" : "outline"}
                size="sm"
                onClick={() => handleOpenOverride(type, originalValue)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                {hasOverride ? 'Edit' : 'Override'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">System Calculated Need</span>
              <span>{formatCurrency(originalValue)}{isMonthly && '/month'}</span>
            </div>
            
            {hasOverride && (
              <div className="contents">
                <div className="flex justify-between font-medium">
                  <span className="text-primary">Adviser Override</span>
                  <span className="text-primary">{formatCurrency(override.overrideValue)}{isMonthly && '/month'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Variance</span>
                  <span className={variance > 0 ? 'text-green-600' : variance < 0 ? 'text-destructive' : ''}>
                    {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
                  </span>
                </div>
                <Separator />
                <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
                  <p><strong>Reason:</strong> {override.reason}</p>
                  <p><strong>Classification:</strong> {override.classification}</p>
                </div>
              </div>
            )}
          </div>
          
          {hasOverride && isSignificantVariance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Override differs significantly from calculated need. Ensure this is justified and documented.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Final Recommended Cover</span>
            <span className="text-primary">{formatCurrency(finalValue)}{isMonthly && '/month'}</span>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Override Rand values only if required. All overrides must include a detailed reason and classification.
          The system retains both the original calculated value and your override for audit purposes.
        </AlertDescription>
      </Alert>
      
      {/* Life Cover */}
      {renderOverrideCard('life', 'Life Cover', calculations.life.netShortfall)}
      
      {/* Disability Cover */}
      {renderOverrideCard('disability', 'Disability Cover', calculations.disability.netShortfall)}
      
      {/* Severe Illness Cover */}
      {renderOverrideCard('severeIllness', 'Severe Illness Cover', calculations.severeIllness.netShortfall)}
      
      {/* Income Protection Temporary */}
      {renderOverrideCard(
        'incomeProtectionTemporary', 
        'Income Protection (Temporary)', 
        calculations.incomeProtection.temporary.netShortfall,
        true
      )}
      
      {/* Income Protection Permanent */}
      {renderOverrideCard(
        'incomeProtectionPermanent', 
        'Income Protection (Permanent)', 
        calculations.incomeProtection.permanent.netShortfall,
        true
      )}
      
      {/* Next Step Preview */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Next Step:</strong> Review the final risk analysis summary and publish the FNA. 
          Once published, the FNA will be locked and ready for client review with full compliance documentation.
        </AlertDescription>
      </Alert>
      
      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Calculations
        </Button>
        <Button type="button" onClick={handleProceed} size="lg" className="bg-primary hover:bg-primary/90">
          Continue to Finalise
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      
      {/* Override Dialog */}
      <Dialog open={!!editingType} onOpenChange={() => setEditingType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Override {editingType && getTypeLabel(editingType)}</DialogTitle>
            <DialogDescription>
              Enter the override value and provide a mandatory reason and classification.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {editingType && (
              <div className="p-3 bg-muted/50 rounded text-sm">
                <p className="text-muted-foreground">System Calculated Need</p>
                <p className="font-semibold text-lg">{formatCurrency(getOriginalValue(editingType))}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="overrideValue">Override Value (Rand)</Label>
              <Input
                id="overrideValue"
                type="number"
                placeholder="0"
                value={overrideForm.overrideValue}
                onChange={(e) => setOverrideForm({ ...overrideForm, overrideValue: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="classification">Classification *</Label>
              <Select
                value={overrideForm.classification}
                onValueChange={(value) => setOverrideForm({ ...overrideForm, classification: value as OverrideClassification })}
              >
                <SelectTrigger id="classification">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDE_CLASSIFICATIONS.map((classification) => (
                    <SelectItem key={classification} value={classification}>
                      {classification}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Provide a detailed reason for this override (minimum 10 characters)"
                rows={4}
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {overrideForm.reason.length}/10 characters minimum
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveOverride}
              disabled={
                !overrideForm.classification ||
                overrideForm.reason.trim().length < 10 ||
                !overrideForm.overrideValue
              }
            >
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}