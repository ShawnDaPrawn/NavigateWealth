/**
 * Step 4: Finalise & Publish
 * 
 * Behaviour Rules:
 * - Lock calculations and generate final FNA output
 * - Display all final recommended cover amounts
 * - Show compliance disclaimers (mandatory)
 * - Allow publish or save as draft
 * - Generate RoA-ready output
 */

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Download, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { Separator } from '../../../../ui/separator';
import { Badge } from '../../../../ui/badge';
import { formatCurrency } from '../utils';
import { COMPLIANCE_DISCLAIMERS } from '../constants';
import type { RiskCalculations, Adjustments, FinalRiskNeed } from '../types';
import { RiskPlanningFNAPdfExport } from './RiskPlanningFNAPdfExport';
import { exportComponentToPdf } from '../utils/pdfExport';
import { toast } from 'sonner@2.0.3';

interface Step4Props {
  calculations: RiskCalculations;
  adjustments: Adjustments;
  onPublish: (finalNeeds: FinalRiskNeed[]) => void;
  onBack: () => void;
  clientName?: string;
  clientId?: string;
}

export function Step4Finalise({ calculations, adjustments, onPublish, onBack, clientName = 'Client', clientId }: Step4Props) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  // Build final risk needs array
  const buildFinalNeeds = (): FinalRiskNeed[] => {
    const needs: FinalRiskNeed[] = [];
    
    // Life Cover
    needs.push({
      riskType: 'life',
      label: 'Life Cover (Death)',
      grossNeed: calculations.life.grossNeed,
      existingCoverPersonal: calculations.life.existingCover.personal,
      existingCoverGroup: calculations.life.existingCover.group,
      existingCoverTotal: calculations.life.existingCover.total,
      netShortfall: calculations.life.netShortfall,
      isOverinsured: calculations.life.netShortfall < 0,
      overinsuredAmount: calculations.life.netShortfall < 0 ? Math.abs(calculations.life.netShortfall) : 0,
      advisorOverride: adjustments.life,
      finalRecommendedCover: adjustments.life?.overrideValue ?? calculations.life.netShortfall,
      assumptions: calculations.life.assumptions,
      riskNotes: calculations.life.riskNotes,
    });
    
    // Disability Cover
    needs.push({
      riskType: 'disability',
      label: 'Lump Sum Disability Cover',
      grossNeed: calculations.disability.grossNeed,
      existingCoverPersonal: calculations.disability.existingCover.personal,
      existingCoverGroup: calculations.disability.existingCover.group,
      existingCoverTotal: calculations.disability.existingCover.total,
      netShortfall: calculations.disability.netShortfall,
      isOverinsured: calculations.disability.netShortfall < 0,
      overinsuredAmount: calculations.disability.netShortfall < 0 ? Math.abs(calculations.disability.netShortfall) : 0,
      advisorOverride: adjustments.disability,
      finalRecommendedCover: adjustments.disability?.overrideValue ?? calculations.disability.netShortfall,
      assumptions: calculations.disability.assumptions,
      riskNotes: calculations.disability.riskNotes,
    });
    
    // Severe Illness Cover
    needs.push({
      riskType: 'severeIllness',
      label: 'Severe Illness Cover',
      grossNeed: calculations.severeIllness.grossNeed,
      existingCoverPersonal: calculations.severeIllness.existingCover.personal,
      existingCoverGroup: calculations.severeIllness.existingCover.group,
      existingCoverTotal: calculations.severeIllness.existingCover.total,
      netShortfall: calculations.severeIllness.netShortfall,
      isOverinsured: calculations.severeIllness.netShortfall < 0,
      overinsuredAmount: calculations.severeIllness.netShortfall < 0 ? Math.abs(calculations.severeIllness.netShortfall) : 0,
      advisorOverride: adjustments.severeIllness,
      finalRecommendedCover: adjustments.severeIllness?.overrideValue ?? calculations.severeIllness.netShortfall,
      assumptions: calculations.severeIllness.assumptions,
      riskNotes: calculations.severeIllness.riskNotes,
    });
    
    // Income Protection - Temporary
    needs.push({
      riskType: 'incomeProtectionTemporary',
      label: 'Income Protection (Temporary)',
      grossNeed: calculations.incomeProtection.temporary.calculatedNeed,
      existingCoverPersonal: calculations.incomeProtection.temporary.existingCover.personal,
      existingCoverGroup: calculations.incomeProtection.temporary.existingCover.group,
      existingCoverTotal: calculations.incomeProtection.temporary.existingCover.total,
      netShortfall: calculations.incomeProtection.temporary.netShortfall,
      isOverinsured: calculations.incomeProtection.temporary.netShortfall < 0,
      overinsuredAmount: calculations.incomeProtection.temporary.netShortfall < 0 ? Math.abs(calculations.incomeProtection.temporary.netShortfall) : 0,
      advisorOverride: adjustments.incomeProtectionTemporary,
      finalRecommendedCover: adjustments.incomeProtectionTemporary?.overrideValue ?? calculations.incomeProtection.temporary.netShortfall,
      assumptions: calculations.incomeProtection.assumptions,
      riskNotes: calculations.incomeProtection.riskNotes,
    });
    
    // Income Protection - Permanent
    needs.push({
      riskType: 'incomeProtectionPermanent',
      label: 'Income Protection (Permanent)',
      grossNeed: calculations.incomeProtection.permanent.calculatedNeed,
      existingCoverPersonal: calculations.incomeProtection.permanent.existingCover.personal,
      existingCoverGroup: calculations.incomeProtection.permanent.existingCover.group,
      existingCoverTotal: calculations.incomeProtection.permanent.existingCover.total,
      netShortfall: calculations.incomeProtection.permanent.netShortfall,
      isOverinsured: calculations.incomeProtection.permanent.netShortfall < 0,
      overinsuredAmount: calculations.incomeProtection.permanent.netShortfall < 0 ? Math.abs(calculations.incomeProtection.permanent.netShortfall) : 0,
      advisorOverride: adjustments.incomeProtectionPermanent,
      finalRecommendedCover: adjustments.incomeProtectionPermanent?.overrideValue ?? calculations.incomeProtection.permanent.netShortfall,
      assumptions: calculations.incomeProtection.assumptions,
      riskNotes: calculations.incomeProtection.riskNotes,
    });
    
    return needs;
  };
  
  const finalNeeds = buildFinalNeeds();
  const hasAnyOverrides = Object.keys(adjustments).length > 0;
  
  // Handle publish
  const handlePublish = () => {
    onPublish(finalNeeds);
  };
  
  // Handle PDF export
  const handlePdfExport = async () => {
    setIsExportingPdf(true);
    try {
      const pdfComponent = <RiskPlanningFNAPdfExport calculations={calculations} adjustments={adjustments} clientName={clientName} clientId={clientId} />;
      await exportComponentToPdf(pdfComponent, {
        filename: `RiskPlanningFNA_${clientName}_${new Date().toISOString().split('T')[0]}.pdf`
      });
      // Toast AFTER print dialog closes, not before
      toast.success('PDF export complete');
    } catch (error) {
      toast.error('Failed to export FNA. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription>
          Review the final risk planning analysis below. Once published, this FNA will be locked and available for client review.
        </AlertDescription>
      </Alert>
      
      {/* Final Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Final Risk Planning Analysis Summary</CardTitle>
          <CardDescription>
            Recommended cover amounts {hasAnyOverrides && '(including adviser overrides)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {finalNeeds.map((need) => {
              const isMonthly = need.riskType.includes('incomeProtection');
              const hasOverride = !!need.advisorOverride;
              const isOverinsured = need.isOverinsured ?? false;
              
              return (
                <div key={need.riskType} className={`p-4 border rounded-lg ${isOverinsured ? 'border-amber-300 bg-amber-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{need.label}</h4>
                    <div className="flex gap-2">
                      {isOverinsured && <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Overinsured</Badge>}
                      {hasOverride && <Badge variant="secondary">Overridden</Badge>}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gross Need</p>
                      <p className="font-medium">{formatCurrency(need.grossNeed)}{isMonthly && '/mo'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Existing Cover</p>
                      <p className="font-medium">{formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'}</p>
                    </div>
                    {isOverinsured ? (
                      <div>
                        <p className="text-muted-foreground">Overinsured Amount</p>
                        <p className="font-medium text-amber-700">{formatCurrency(need.overinsuredAmount ?? 0)}{isMonthly && '/mo'}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-muted-foreground">Shortfall</p>
                        <p className="font-medium">{formatCurrency(need.netShortfall)}{isMonthly && '/mo'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Final Recommended</p>
                      <p className="font-semibold text-primary text-base">
                        {formatCurrency(need.finalRecommendedCover)}{isMonthly && '/mo'}
                      </p>
                    </div>
                  </div>
                  
                  {isOverinsured && (
                    <Alert className="mt-3 border-amber-300 bg-amber-100">
                      <AlertDescription className="text-amber-900 text-xs">
                        <strong>Overinsurance detected:</strong> Existing cover ({formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'}) exceeds calculated need by {formatCurrency(need.overinsuredAmount ?? 0)}{isMonthly && '/mo'}. Consider reducing cover to avoid unnecessary premium expenditure.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {hasOverride && (
                    <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                      <p><strong>Override Reason:</strong> {need.advisorOverride!.reason}</p>
                      <p><strong>Classification:</strong> {need.advisorOverride!.classification}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Existing Cover Breakdown */}
      {finalNeeds.some(need => (need.existingCoverPersonal || 0) > 0 || (need.existingCoverGroup || 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Cover Offset Summary</CardTitle>
            <CardDescription>Personal vs Group cover breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {finalNeeds.map((need) => {
                const isMonthly = need.riskType.includes('incomeProtection');
                const totalExisting = (need.existingCoverPersonal || 0) + (need.existingCoverGroup || 0);
                
                if (totalExisting === 0) return null;
                
                return (
                  <div key={need.riskType} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{need.label}</span>
                    <div className="flex gap-4">
                      <span>
                        Personal: {formatCurrency(need.existingCoverPersonal)}{isMonthly && '/mo'}
                      </span>
                      <span>
                        Group: {formatCurrency(need.existingCoverGroup)}{isMonthly && '/mo'}
                      </span>
                      <span className="font-medium">
                        Total: {formatCurrency(totalExisting)}{isMonthly && '/mo'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Compliance Disclaimers */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900">FAIS Compliance Disclaimers</CardTitle>
          <CardDescription className="text-amber-700">
            These disclaimers will be included in the published FNA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-amber-900">
            {COMPLIANCE_DISCLAIMERS.map((disclaimer, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{disclaimer}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      
      {/* Assumptions & Risk Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Assumptions & Risk Notes</CardTitle>
          <CardDescription>RoA-ready documentation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {finalNeeds.map((need) => (
            <div key={need.riskType}>
              <h4 className="font-medium mb-2">{need.label}</h4>
              
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Assumptions:</p>
                <ul className="text-xs space-y-1">
                  {need.assumptions.map((assumption, idx) => (
                    <li key={idx}>• {assumption}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Risk Notes:</p>
                <ul className="text-xs space-y-1">
                  {need.riskNotes.map((note, idx) => (
                    <li key={idx}>• {note}</li>
                  ))}
                </ul>
              </div>
              
              {need !== finalNeeds[finalNeeds.length - 1] && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Metadata */}
      <div className="text-xs text-muted-foreground">
        <p>Calculated: {new Date(calculations.metadata.calculatedAt).toLocaleString()}</p>
        <p>System Version: {calculations.metadata.systemVersion}</p>
        <p>Calculated By: {calculations.metadata.calculatedBy}</p>
      </div>
      
      {/* Actions */}
      <div className="flex justify-between pt-6 border-t gap-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Adjustments
        </Button>
        
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handlePdfExport} disabled={isExportingPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button type="button" onClick={handlePublish}>
            <FileText className="mr-2 h-4 w-4" />
            Publish FNA
          </Button>
        </div>
      </div>
    </div>
  );
}