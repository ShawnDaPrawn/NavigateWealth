import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Switch } from '../../../../ui/switch';
import { TaxPlanningInputs, TaxCalculationResults, AdjustmentLog } from '../types';
import { ArrowLeft, ArrowRight, RefreshCw, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { Badge } from '../../../../ui/badge';

interface Step3Props {
  baselineInputs: TaxPlanningInputs;
  baselineResults: TaxCalculationResults;
  
  // The Wizard provides a way to run the calc engine on demand
  onCalculate: (inputs: TaxPlanningInputs) => TaxCalculationResults;
  
  onNext: (adjustedInputs: TaxPlanningInputs, adjustments: AdjustmentLog[]) => void;
  onBack: () => void;
}

export function Step3ManualAdjustment({ baselineInputs, baselineResults, onCalculate, onNext, onBack }: Step3Props) {
  
  // Local state for the scenario
  const [adjustedInputs, setAdjustedInputs] = useState<TaxPlanningInputs>({ ...baselineInputs });
  const [adjustedResults, setAdjustedResults] = useState<TaxCalculationResults>(baselineResults);
  const [adjustments, setAdjustments] = useState<AdjustmentLog[]>([]);
  
  // Temp state for the "Reason" dialog or field
  const [activeOverrideField, setActiveOverrideField] = useState<keyof TaxPlanningInputs | null>(null);

  // Re-run calculation whenever adjustedInputs changes
  useEffect(() => {
    const results = onCalculate(adjustedInputs);
    setAdjustedResults(results);
  }, [adjustedInputs, onCalculate]);

  const handleOverride = (field: keyof TaxPlanningInputs, newValue: number, reason: string) => {
    // 1. Update Inputs
    setAdjustedInputs(prev => ({ ...prev, [field]: newValue }));
    
    // 2. Log Adjustment
    const newLog: AdjustmentLog = {
      id: Math.random().toString(36).substr(2, 9),
      field,
      originalValue: baselineInputs[field] as number,
      newValue,
      reason,
      timestamp: new Date()
    };
    
    setAdjustments(prev => [...prev.filter(a => a.field !== field), newLog]);
  };

  const handleReset = (field: keyof TaxPlanningInputs) => {
    setAdjustedInputs(prev => ({ ...prev, [field]: baselineInputs[field] }));
    setAdjustments(prev => prev.filter(a => a.field !== field));
  };

  const formatMoney = (val: number) => `R ${Math.round(val).toLocaleString()}`;

  // Helper to render an override row
  const RenderOverrideRow = ({ label, field }: { label: string, field: keyof TaxPlanningInputs }) => {
    const isModified = adjustments.some(a => a.field === field);
    const original = baselineInputs[field] as number;
    const current = adjustedInputs[field] as number;

    return (
      <div className={`grid grid-cols-12 gap-4 items-center p-3 rounded-md ${isModified ? 'bg-amber-50 border border-amber-100' : 'hover:bg-slate-50'}`}>
        <div className="col-span-4 text-sm font-medium text-slate-700">{label}</div>
        
        <div className="col-span-3 text-sm text-slate-500">
          {formatMoney(original)}
        </div>

        <div className="col-span-4">
          <Input 
            className={`h-8 bg-white ${isModified ? 'border-amber-400 text-amber-700 font-semibold' : ''}`}
            type="number"
            value={current}
            onChange={(e) => handleOverride(field, Number(e.target.value), "Manual override")}
          />
        </div>

        <div className="col-span-1 flex justify-end">
           {isModified && (
             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReset(field)} aria-label={`Reset ${String(field)} to calculated value`}>
               <RefreshCw className="h-3 w-3 text-slate-400" />
             </Button>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3 items-center text-amber-900">
           <ArrowRightLeft className="w-5 h-5" />
           <div>
             <h4 className="font-semibold text-sm">Adviser Adjustment Mode</h4>
             <p className="text-sm text-amber-800">
               Modify inputs below to create an "Adjusted Scenario". All changes are logged for compliance.
             </p>
           </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-700 font-semibold uppercase">Adjustments Active</div>
          <div className="text-xl font-bold text-amber-900">{adjustments.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT: INPUT OVERRIDES */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Income Adjustments</CardTitle>
              <CardDescription>Exclude once-off income or normalize earnings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <RenderOverrideRow label="Employment Income" field="employmentIncome" />
              <RenderOverrideRow label="Variable (Bonus)" field="variableIncome" />
              <RenderOverrideRow label="Business Income" field="businessIncome" />
              <RenderOverrideRow label="Capital Gains" field="capitalGainsRealised" />
              <RenderOverrideRow label="Foreign Income" field="foreignIncome" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Deduction Planning</CardTitle>
              <CardDescription>Test impact of contribution changes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <RenderOverrideRow label="RA Contributions" field="raContributions" />
              <RenderOverrideRow label="Medical Members" field="medicalSchemeMembers" />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: LIVE COMPARISON */}
        <div className="space-y-6">
          <Card className="border-2 border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-100 py-3">
               <CardTitle className="text-base flex justify-between items-center">
                 <span>Impact Analysis</span>
                 {adjustments.length > 0 ? <Badge variant="default" className="bg-amber-600">Modified</Badge> : <Badge variant="outline">Baseline</Badge>}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                  <tr>
                    <th className="text-left p-3 pl-6">Metric</th>
                    <th className="text-right p-3">Baseline</th>
                    <th className="text-right p-3 bg-amber-50/50">Adjusted</th>
                    <th className="text-right p-3 pr-6">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3 pl-6 font-medium">Taxable Income</td>
                    <td className="text-right p-3">{formatMoney(baselineResults.taxableIncome)}</td>
                    <td className="text-right p-3 bg-amber-50/50 font-semibold">{formatMoney(adjustedResults.taxableIncome)}</td>
                    <td className="text-right p-3 pr-6 text-slate-400">
                      {formatMoney(adjustedResults.taxableIncome - baselineResults.taxableIncome)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 pl-6 font-medium">Net Tax Payable</td>
                    <td className="text-right p-3">{formatMoney(baselineResults.totalTaxLiability)}</td>
                    <td className="text-right p-3 bg-amber-50/50 font-bold text-slate-900">{formatMoney(adjustedResults.totalTaxLiability)}</td>
                    <td className={`text-right p-3 pr-6 font-medium ${adjustedResults.totalTaxLiability < baselineResults.totalTaxLiability ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoney(adjustedResults.totalTaxLiability - baselineResults.totalTaxLiability)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 pl-6 font-medium">Effective Rate</td>
                    <td className="text-right p-3">{(baselineResults.effectiveTaxRate * 100).toFixed(1)}%</td>
                    <td className="text-right p-3 bg-amber-50/50 font-semibold">{(adjustedResults.effectiveTaxRate * 100).toFixed(1)}%</td>
                    <td className="text-right p-3 pr-6 text-slate-400">-</td>
                  </tr>
                   <tr>
                    <td className="p-3 pl-6 font-medium">RA Gap</td>
                    <td className="text-right p-3">{formatMoney(baselineResults.raGap)}</td>
                    <td className="text-right p-3 bg-amber-50/50">{formatMoney(adjustedResults.raGap)}</td>
                    <td className="text-right p-3 pr-6 text-slate-400">
                       {formatMoney(adjustedResults.raGap - baselineResults.raGap)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 pl-6 font-medium">Medical Credits</td>
                    <td className="text-right p-3">{formatMoney(baselineResults.medicalTaxCredits)}</td>
                    <td className="text-right p-3 bg-amber-50/50">{formatMoney(adjustedResults.medicalTaxCredits)}</td>
                    <td className="text-right p-3 pr-6 text-slate-400">
                       {formatMoney(adjustedResults.medicalTaxCredits - baselineResults.medicalTaxCredits)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {adjustments.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
               <CardHeader className="pb-2">
                 <CardTitle className="text-sm text-amber-900">Audit Trail ({adjustments.length} changes)</CardTitle>
               </CardHeader>
               <CardContent>
                 <ul className="space-y-2">
                   {adjustments.map(adj => (
                     <li key={adj.id} className="text-xs text-amber-800 flex justify-between border-b border-amber-200 pb-1">
                       <span>Changed <b>{adj.field}</b> from {formatMoney(Number(adj.originalValue))} to {formatMoney(Number(adj.newValue))}</span>
                     </li>
                   ))}
                 </ul>
               </CardContent>
            </Card>
          )}
        </div>

      </div>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button onClick={() => onNext(adjustedInputs, adjustments)} size="lg" className="bg-primary hover:bg-primary/90">
          Finalise & Generate Recommendations <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

    </div>
  );
}