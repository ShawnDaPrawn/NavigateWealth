import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Checkbox } from '../../../../ui/checkbox';
import { TaxPlanningInputs, TaxCalculationResults, AdjustmentLog, TaxRecommendation } from '../types';
import { TaxPlanningCalculationService } from '../services/taxPlanningCalculationService';
import { ArrowLeft, CheckCircle, FileText, Printer, Lock, Save } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import { toast } from "sonner@2.0.3";

interface Step4Props {
  finalInputs: TaxPlanningInputs;
  finalResults: TaxCalculationResults;
  adjustments: AdjustmentLog[];
  onPublish: (finalRecommendations: TaxRecommendation[], adviserNotes: string) => void;
  onBack: () => void;
}

export function Step4Finalise({ finalInputs, finalResults, adjustments, onPublish, onBack }: Step4Props) {
  
  const [recommendations, setRecommendations] = useState<TaxRecommendation[]>([]);
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [adviserNotes, setAdviserNotes] = useState('');

  useEffect(() => {
    const recs = TaxPlanningCalculationService.generateRecommendations(finalResults);
    // Map to full type
    const typedRecs: TaxRecommendation[] = recs.map(r => ({
      ...r,
      status: 'pending'
    }));
    setRecommendations(typedRecs);
    // Auto-select all by default? No, let adviser choose.
  }, [finalResults]);

  const toggleRec = (id: string) => {
    if (selectedRecIds.includes(id)) {
      setSelectedRecIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedRecIds(prev => [...prev, id]);
    }
  };

  const handlePublish = () => {
    if (selectedRecIds.length === 0 && recommendations.length > 0) {
      toast.warning("You haven't selected any recommendations. Are you sure?");
      // allow proceed, but maybe prompt?
    }
    
    // Mark selected as accepted
    const finalRecs = recommendations.map(r => ({
      ...r,
      status: selectedRecIds.includes(r.id) ? 'accepted' : 'rejected'
    })) as TaxRecommendation[];

    onPublish(finalRecs, adviserNotes);
  };

  const formatMoney = (val: number) => `R ${Math.round(val).toLocaleString()}`;

  return (
    <div className="space-y-8">
      
      <div className="text-center py-6">
        <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4 border border-green-200">
          <FileText className="h-8 w-8 text-green-700" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Finalise & Publish</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Review generated recommendations. Select the ones you want to include in the Record of Advice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: SUMMARY */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="bg-slate-50 border-slate-200">
             <CardHeader>
               <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Analysis Summary</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Gross Income</span>
                  <span className="font-medium">{formatMoney(finalResults.grossIncome)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                  <span>Taxable Income</span>
                  <span className="font-medium">{formatMoney(finalResults.taxableIncome)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                  <span>Medical Credits</span>
                  <span className="font-medium text-green-600">- {formatMoney(finalResults.medicalTaxCredits)}</span>
                </div>
                 <div className="flex justify-between text-sm">
                  <span>Net Tax Payable</span>
                  <span className="font-medium">{formatMoney(finalResults.totalTaxLiability)}</span>
                </div>
                <div className="pt-4 border-t border-slate-200">
                   <div className="flex justify-between text-sm font-bold text-slate-900">
                    <span>Effective Rate</span>
                    <span>{(finalResults.effectiveTaxRate * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {adjustments.length > 0 && (
                  <div className="bg-amber-100/50 p-3 rounded text-xs text-amber-800 border border-amber-200 mt-4">
                    <Lock className="w-3 h-3 inline mr-1 mb-0.5" />
                    Includes {adjustments.length} manual adjustment(s).
                  </div>
                )}
             </CardContent>
          </Card>
        </div>

        {/* RIGHT: RECOMMENDATIONS */}
        <div className="space-y-6 lg:col-span-2">
           <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>Select items to include in the client report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic">
                  No specific tax planning opportunities identified based on these inputs.
                </div>
              ) : (
                recommendations.map(rec => (
                  <div 
                    key={rec.id} 
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${selectedRecIds.includes(rec.id) ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                  >
                    <Checkbox 
                      id={rec.id} 
                      checked={selectedRecIds.includes(rec.id)}
                      onCheckedChange={() => toggleRec(rec.id)}
                      className="mt-1"
                    />
                    <div className="space-y-1 flex-1">
                      <div className="flex justify-between items-start">
                         <label htmlFor={rec.id} className="font-semibold text-slate-900 cursor-pointer select-none">
                           {rec.title}
                         </label>
                         {rec.impactValue > 0 && (
                           <Badge variant="outline" className="bg-white text-green-700 border-green-200">
                             Save {formatMoney(rec.impactValue)}
                           </Badge>
                         )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ADVISER NOTES */}
      <Card>
        <CardHeader>
          <CardTitle>Adviser Notes</CardTitle>
          <CardDescription>
            Optional notes to accompany this tax planning record. These are visible to the client in the published report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="adviser-notes" className="sr-only">Adviser Notes</Label>
            <Textarea
              id="adviser-notes"
              placeholder="Add any additional context, caveats, or follow-up actions for the client..."
              value={adviserNotes}
              onChange={(e) => setAdviserNotes(e.target.value)}
              rows={4}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {adviserNotes.length > 0 ? `${adviserNotes.length} characters` : 'No notes added'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Adjustments
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" disabled>
            <Printer className="h-4 w-4 mr-2" /> Draft Preview
          </Button>
          <Button onClick={handlePublish} size="lg" className="bg-green-700 hover:bg-green-800">
            <Save className="h-4 w-4 mr-2" /> Publish Record
          </Button>
        </div>
      </div>

    </div>
  );
}