/**
 * Step 2 dispatch — routes to the product-specific form.
 *
 * Split out of `RetirementQuoteWizard.tsx` (1,407 lines) on the same pattern as
 * the medical aid wizard: each step was already a self-contained function with
 * its own props; only its address changed.
 */
import { type NotSureState, type PreservationState, type RAContributionState } from './model';
import { Step2RAContribution } from './Step2RAContribution';
import { Step2Preservation } from './Step2Preservation';
import { Step2NotSure } from './Step2NotSure';

export function Step2Funding({
  selectedProduct,
  raContribution,
  preservation,
  notSureContext,
  onChangeRA,
  onChangePreservation,
  onChangeNotSure,
}: {
  selectedProduct: string;
  raContribution: RAContributionState;
  preservation: PreservationState;
  notSureContext: NotSureState;
  onChangeRA: (s: RAContributionState) => void;
  onChangePreservation: (s: PreservationState) => void;
  onChangeNotSure: (s: NotSureState) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">How will this be funded?</h2>
        <p className="text-sm text-gray-500">
          {selectedProduct === 'ra'
            ? 'Tell us about your planned contributions.'
            : selectedProduct === 'provident_preservation' ||
                selectedProduct === 'pension_preservation'
              ? 'Tell us about the transfer from your previous employer fund.'
              : 'A few questions to help your adviser recommend the right approach.'}
        </p>
      </div>

      {selectedProduct === 'ra' && (
        <Step2RAContribution state={raContribution} onChange={onChangeRA} />
      )}
      {selectedProduct === 'provident_preservation' && (
        <Step2Preservation
          fundType="provident"
          state={preservation}
          onChange={onChangePreservation}
        />
      )}
      {selectedProduct === 'pension_preservation' && (
        <Step2Preservation
          fundType="pension"
          state={preservation}
          onChange={onChangePreservation}
        />
      )}
      {selectedProduct === 'not_sure' && (
        <Step2NotSure state={notSureContext} onChange={onChangeNotSure} />
      )}
    </div>
  );
}

// ── Step 3: Retirement Timeline ─────────────────────────────────────────────────
