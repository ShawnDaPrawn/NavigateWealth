/**
 * Step: Review (both Last Will and Living Will)
 * Read-only summary cards for final review before saving.
 */

import React from 'react';
import { Badge } from '../../../../../ui/badge';
import { Separator } from '../../../../../ui/separator';
import {
  User,
  Briefcase,
  Users,
  Shield,
  Home,
  FileText,
  Activity,
  Stethoscope,
  HandHeart,
} from 'lucide-react';
import { MARITAL_STATUS_LABELS, TREATMENT_LABELS, TREATMENT_OPTION_LABELS } from '../WillDraftingConstants';
import { StepSectionHeader, ReviewSection, ReviewRow } from '../WillDraftingUI';
import type { StepReviewLastWillProps, StepReviewLivingWillProps } from './types';

// ═══════════════════════════════════════════════════════
// Living Will Review
// ═══════════════════════════════════════════════════════

export function StepReviewLivingWill({ personalDetails: pd, livingWillData }: StepReviewLivingWillProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Review Living Will"
        description="Please review all details carefully before saving. You can go back to any step to make changes."
      />

      <ReviewSection icon={User} title="Personal Details" iconColor="text-[#6d28d9]">
        <div className="space-y-0.5">
          <ReviewRow label="Full Name" value={pd.fullName} />
          <ReviewRow label="ID Number" value={pd.idNumber} />
          <ReviewRow label="Date of Birth" value={pd.dateOfBirth} />
          <ReviewRow label="Marital Status" value={MARITAL_STATUS_LABELS[pd.maritalStatus] || pd.maritalStatus} />
          <ReviewRow label="Address" value={pd.physicalAddress} />
        </div>
      </ReviewSection>

      <ReviewSection icon={Shield} title={`Healthcare Agents (${livingWillData.healthcareAgents.length})`} iconColor="text-blue-600">
        {livingWillData.healthcareAgents.length === 0 ? (
          <p className="text-muted-foreground italic">No healthcare agents appointed</p>
        ) : (
          <div className="space-y-3">
            {livingWillData.healthcareAgents.map((agent, idx) => (
              <div key={agent.id} className="flex items-start gap-3 py-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    {agent.name}
                    {agent.isPrimary && (
                      <Badge className="ml-2 text-xs bg-[#6d28d9] hover:bg-[#5b21b6]">Primary</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {agent.relationship}{agent.contactDetails ? ` | ${agent.contactDetails}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      <ReviewSection icon={Activity} title="Treatment Preferences" iconColor="text-amber-600">
        <div className="space-y-2">
          {(['ventilator', 'cpr', 'artificialNutrition', 'dialysis', 'antibiotics'] as const).map((treatment) => {
            const value = livingWillData.lifeSustainingTreatment[treatment];
            const colorMap = { accept: 'text-green-700 bg-green-50', refuse: 'text-red-700 bg-red-50', limited: 'text-amber-700 bg-amber-50' };
            return (
              <div key={treatment} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">{TREATMENT_LABELS[treatment]}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colorMap[value]}`}>
                  {TREATMENT_OPTION_LABELS[value]}
                </span>
              </div>
            );
          })}
        </div>
      </ReviewSection>

      <ReviewSection icon={Stethoscope} title="Pain Management" iconColor="text-teal-600">
        <div className="space-y-0.5">
          <ReviewRow label="Comfort Care Only" value={livingWillData.painManagement.comfortCareOnly ? 'Yes' : 'No'} />
          <ReviewRow label="Maximum Pain Relief" value={livingWillData.painManagement.maximumPainRelief ? 'Yes' : 'No'} />
        </div>
      </ReviewSection>

      <ReviewSection icon={HandHeart} title="Organ Donation" iconColor="text-pink-600">
        <div className="space-y-0.5">
          <ReviewRow label="Organ Donor" value={livingWillData.organDonation.isDonor ? 'Yes' : 'No'} />
          {livingWillData.organDonation.isDonor && (
            <ReviewRow
              label="Donation Type"
              value={livingWillData.organDonation.donationType === 'all' ? 'All organs and tissues' : 'Specific organs'}
            />
          )}
        </div>
      </ReviewSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Last Will Review
// ═══════════════════════════════════════════════════════

export function StepReviewLastWill({
  personalDetails: pd,
  executors,
  beneficiaries,
  beneficiaryTotal,
  guardians,
  specificBequests,
  funeralWishes,
  additionalClauses,
}: StepReviewLastWillProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Review Will Draft"
        description="Please review all details carefully before saving. You can go back to any step to make changes."
      />

      <ReviewSection icon={User} title="Personal Details" iconColor="text-[#6d28d9]">
        <div className="space-y-0.5">
          <ReviewRow label="Full Name" value={pd.fullName} />
          <ReviewRow label="ID Number" value={pd.idNumber} />
          <ReviewRow label="Date of Birth" value={pd.dateOfBirth} />
          <ReviewRow label="Marital Status" value={MARITAL_STATUS_LABELS[pd.maritalStatus] || pd.maritalStatus} />
          {pd.spouseName && <ReviewRow label="Spouse" value={pd.spouseName} />}
          <ReviewRow label="Address" value={pd.physicalAddress} />
        </div>
      </ReviewSection>

      <ReviewSection icon={Briefcase} title={`Executors (${executors.length})`} iconColor="text-amber-600">
        {executors.length === 0 ? (
          <p className="text-muted-foreground italic">No executors appointed</p>
        ) : (
          <div className="space-y-2">
            {executors.map((exec, idx) => (
              <div key={exec.id} className="flex items-center gap-3 py-1">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <span className="font-medium text-gray-900">{exec.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {exec.type === 'professional' ? exec.company : 'Individual'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      <ReviewSection icon={Users} title={`Beneficiaries (${beneficiaries.length})`} iconColor="text-green-600">
        {beneficiaries.length === 0 ? (
          <p className="text-muted-foreground italic">No beneficiaries designated</p>
        ) : (
          <div className="space-y-2">
            {beneficiaries.map((ben, idx) => (
              <div key={ben.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{ben.name}</span>
                    {ben.relationship && (
                      <span className="text-xs text-muted-foreground ml-2">({ben.relationship})</span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-gray-700">{ben.percentage}%</span>
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className={`font-mono ${beneficiaryTotal === 100 ? 'text-green-600' : 'text-red-600'}`}>
                {beneficiaryTotal}%
              </span>
            </div>
          </div>
        )}
      </ReviewSection>

      {guardians.length > 0 && (
        <ReviewSection icon={Shield} title={`Guardians (${guardians.length})`} iconColor="text-blue-600">
          <div className="space-y-2">
            {guardians.map((guard, idx) => (
              <div key={guard.id} className="flex items-center gap-3 py-1">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <span className="font-medium text-gray-900">{guard.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({guard.relationship})</span>
                </div>
              </div>
            ))}
          </div>
        </ReviewSection>
      )}

      {specificBequests.length > 0 && (
        <ReviewSection icon={Home} title={`Specific Bequests (${specificBequests.length})`} iconColor="text-purple-600">
          <div className="space-y-2">
            {specificBequests.map((beq, idx) => (
              <div key={beq.id} className="py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-sm text-gray-900">{beq.itemDescription}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">To: {beq.beneficiaryName}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ReviewSection>
      )}

      {(funeralWishes || additionalClauses) && (
        <ReviewSection icon={FileText} title="Final Wishes & Clauses" iconColor="text-gray-600">
          {funeralWishes && (
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Funeral Wishes</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{funeralWishes}</p>
            </div>
          )}
          {additionalClauses && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Additional Clauses</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{additionalClauses}</p>
            </div>
          )}
        </ReviewSection>
      )}
    </div>
  );
}
