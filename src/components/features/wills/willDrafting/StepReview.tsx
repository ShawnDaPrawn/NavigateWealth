/**
 * Step 6 — read-only review of everything gathered.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import { Badge } from '../../../ui/badge';
import { User, Shield, Users, Heart, Gift, FileText, AlertCircle } from 'lucide-react';
import {
  type Beneficiary,
  type Executor,
  type Guardian,
  type PersonalInfo,
  type SpecialBequest,
} from './model';

interface StepReviewProps {
  personalInfo: PersonalInfo;
  executor: Executor;
  alternateExecutor: Executor;
  beneficiaries: Beneficiary[];
  hasMinorChildren: boolean | null;
  guardians: Guardian[];
  specialBequests: SpecialBequest[];
  residualInstructions: string;
  funeralWishes: string;
}

export function StepReview({
  personalInfo,
  executor,
  alternateExecutor,
  beneficiaries,
  hasMinorChildren,
  guardians,
  specialBequests,
  residualInstructions,
  funeralWishes,
}: StepReviewProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          Please review all details below before submitting. This will be saved as a
          <strong> draft</strong> for professional review by a Navigate Wealth adviser.
        </p>
      </div>

      {/* Personal details summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Personal Details
        </h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <p className="text-gray-900 font-medium">
            {personalInfo.firstName} {personalInfo.surname}
          </p>
          {personalInfo.idNumber && (
            <p className="text-gray-600 text-xs">ID: {personalInfo.idNumber}</p>
          )}
          <p className="text-gray-600 text-xs">{personalInfo.email}</p>
          {personalInfo.maritalStatus && (
            <p className="text-gray-600 text-xs">
              {personalInfo.maritalStatus}
              {personalInfo.spouseName && ` - Spouse: ${personalInfo.spouseName}`}
            </p>
          )}
        </div>
      </div>

      {/* Executor summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Executor
        </h3>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <p className="text-gray-900 font-medium">{executor.fullName || 'Not specified'}</p>
          {executor.relationship && (
            <p className="text-gray-600 text-xs">{executor.relationship}</p>
          )}
          {alternateExecutor.fullName && (
            <p className="text-gray-500 text-xs">Alternate: {alternateExecutor.fullName}</p>
          )}
        </div>
      </div>

      {/* Beneficiaries summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Beneficiaries
        </h3>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          {beneficiaries
            .filter((b) => !b.isAlternate)
            .map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">
                  {b.fullName || 'Unnamed'}
                  {b.relationship && (
                    <span className="text-gray-500 text-xs ml-1">({b.relationship})</span>
                  )}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs bg-primary/10 text-primary border-primary/25"
                >
                  {b.sharePercentage}%
                </Badge>
              </div>
            ))}
          {beneficiaries.filter((b) => b.isAlternate).length > 0 && (
            <div className="pt-1 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Alternates:</p>
              {beneficiaries
                .filter((b) => b.isAlternate)
                .map((b) => (
                  <p key={b.id} className="text-xs text-gray-600">
                    {b.fullName || 'Unnamed'}
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Guardianship summary */}
      {hasMinorChildren && guardians.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Guardianship
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            {guardians.map((g) => (
              <p key={g.id} className="text-sm text-gray-900">
                {g.fullName}
                {g.isAlternate && <span className="text-xs text-gray-500 ml-1">(alternate)</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Special bequests summary */}
      {specialBequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Special Bequests
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            {specialBequests.map((b) => (
              <div key={b.id} className="text-sm">
                <span className="text-gray-900">{b.description}</span>
                <span className="text-gray-500 text-xs ml-1">&rarr; {b.beneficiaryName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Residual estate / funeral */}
      {(residualInstructions || funeralWishes) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Additional Instructions
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            {residualInstructions && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Residual Estate</p>
                <p className="text-gray-800">{residualInstructions}</p>
              </div>
            )}
            {funeralWishes && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Funeral Wishes</p>
                <p className="text-gray-800">{funeralWishes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal disclaimer */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg">
        <FileText className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
        <div className="text-xs text-gray-600 space-y-1">
          <p>
            By submitting this draft, I acknowledge that it is a{' '}
            <strong>preliminary document</strong> and does not constitute a legally binding will
            until:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Reviewed and finalised by a qualified professional</li>
            <li>Signed by the testator in the presence of two competent witnesses</li>
            <li>
              All parties have signed in compliance with the Wills Act 7 of 1953 (South Africa)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
