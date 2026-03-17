/**
 * Risk Planning FNA Results View
 * 
 * Displays published Risk Planning FNA in a read-only format
 * Compatible with the FNACard component interface
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Shield, DollarSign, HeartPulse, Briefcase } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../utils';
import type { PublishedFNA } from '../types';

interface RiskPlanningFNAResultsViewProps {
  fna: PublishedFNA;
}

export function RiskPlanningFNAResultsView({ fna }: RiskPlanningFNAResultsViewProps) {
  if (!fna || !fna.finalNeeds) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No FNA data available
        </CardContent>
      </Card>
    );
  }
  
  // Group final needs by risk type
  const lifeCover = fna.finalNeeds.find(n => n.riskType === 'life');
  const disabilityCover = fna.finalNeeds.find(n => n.riskType === 'disability');
  const severeIllnessCover = fna.finalNeeds.find(n => n.riskType === 'severeIllness');
  const ipTemporary = fna.finalNeeds.find(n => n.riskType === 'incomeProtectionTemporary');
  const ipPermanent = fna.finalNeeds.find(n => n.riskType === 'incomeProtectionPermanent');
  
  const renderNeedCard = (
    need: typeof lifeCover,
    icon: React.ElementType,
    iconColor: string,
    isMonthly: boolean = false
  ) => {
    if (!need) return null;
    
    const hasOverride = !!need.advisorOverride;
    
    return (
      <Card key={need.riskType}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {React.createElement(icon, { className: `h-5 w-5 ${iconColor}` })}
              <CardTitle className="text-lg">{need.label}</CardTitle>
            </div>
            {hasOverride && <Badge variant="secondary">Overridden</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Gross Need</p>
              <p className="text-lg font-semibold">{formatCurrency(need.grossNeed)}{isMonthly && '/mo'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Existing Cover</p>
              <p className="text-lg font-semibold">{formatCurrency(need.existingCoverTotal)}{isMonthly && '/mo'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">System Shortfall</p>
              <p className="text-lg font-semibold">{formatCurrency(need.netShortfall)}{isMonthly && '/mo'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recommended Cover</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(need.finalRecommendedCover)}{isMonthly && '/mo'}</p>
            </div>
          </div>
          
          {hasOverride && (
            <div className="contents">
              <Separator />
              <div className="p-3 bg-muted/50 rounded-md space-y-2 text-sm">
                <p><strong>Override Reason:</strong> {need.advisorOverride!.reason}</p>
                <p><strong>Classification:</strong> {need.advisorOverride!.classification}</p>
                <p className="text-xs text-muted-foreground">
                  Overridden by {need.advisorOverride!.overriddenBy} on {new Date(need.advisorOverride!.overriddenAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          
          {need.assumptions && need.assumptions.length > 0 && (
            <div className="contents">
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Assumptions:</p>
                <ul className="text-xs space-y-1">
                  {need.assumptions.map((assumption, idx) => (
                    <li key={idx} className="text-muted-foreground">• {assumption}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {need.riskNotes && need.riskNotes.length > 0 && (
            <div className="contents">
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Risk Notes:</p>
                <ul className="text-xs space-y-1">
                  {need.riskNotes.map((note, idx) => (
                    <li key={idx} className="text-muted-foreground">• {note}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-green-900">Risk Planning FNA - Published</CardTitle>
              <CardDescription className="text-green-700">
                Published on {new Date(fna.publishedAt!).toLocaleDateString()} by {fna.publishedBy}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              {fna.status}
            </Badge>
          </div>
        </CardHeader>
      </Card>
      
      {/* Life Cover */}
      {lifeCover && renderNeedCard(lifeCover, Shield, 'text-purple-600')}
      
      {/* Disability Cover */}
      {disabilityCover && renderNeedCard(disabilityCover, HeartPulse, 'text-red-600')}
      
      {/* Severe Illness Cover */}
      {severeIllnessCover && renderNeedCard(severeIllnessCover, HeartPulse, 'text-orange-600')}
      
      {/* Income Protection - Temporary */}
      {ipTemporary && renderNeedCard(ipTemporary, Briefcase, 'text-blue-600', true)}
      
      {/* Income Protection - Permanent */}
      {ipPermanent && renderNeedCard(ipPermanent, Briefcase, 'text-indigo-600', true)}
      
      {/* Existing Cover Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Cover Offset Summary</CardTitle>
          <CardDescription>Personal vs Group cover breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fna.finalNeeds.map((need) => {
              const isMonthly = need.riskType.includes('incomeProtection');
              const totalExisting = (need.existingCoverPersonal || 0) + (need.existingCoverGroup || 0);
              
              if (totalExisting === 0) return null;
              
              return (
                <div key={need.riskType} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{need.label}</span>
                  <div className="flex gap-4">
                    <span>
                      Personal: {formatCurrency(need.existingCoverPersonal || 0)}{isMonthly && '/mo'}
                    </span>
                    <span>
                      Group: {formatCurrency(need.existingCoverGroup || 0)}{isMonthly && '/mo'}
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
      
      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Lump Sum Cover</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(
                  (lifeCover?.finalRecommendedCover || 0) +
                  (disabilityCover?.finalRecommendedCover || 0) +
                  (severeIllnessCover?.finalRecommendedCover || 0)
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Income Protection (Permanent)</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(ipPermanent?.finalRecommendedCover || 0)}/month
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Compliance Disclaimers */}
      {fna.complianceDisclaimers && fna.complianceDisclaimers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">FAIS Compliance Disclaimers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-amber-900">
              {fna.complianceDisclaimers.map((disclaimer, idx) => (
                <li key={idx} className="flex gap-2">
                  <span>•</span>
                  <span>{disclaimer}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      
      {/* Metadata */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>FNA ID: {fna.id}</p>
        <p>Created: {new Date(fna.createdAt).toLocaleString()}</p>
        <p>Last Updated: {new Date(fna.updatedAt).toLocaleString()}</p>
        <p>Version: {fna.version}</p>
        {fna.calculations?.metadata && (
          <div className="contents">
            <p>Calculated: {new Date(fna.calculations.metadata.calculatedAt).toLocaleString()}</p>
            <p>System Version: {fna.calculations.metadata.systemVersion}</p>
            <p>Calculated By: {fna.calculations.metadata.calculatedBy}</p>
          </div>
        )}
      </div>
    </div>
  );
}