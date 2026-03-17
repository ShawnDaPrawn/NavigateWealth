/**
 * Step: Funeral Wishes & Additional Clauses (Last Will only)
 */

import React from 'react';
import { Textarea } from '../../../../../ui/textarea';
import { StepSectionHeader, FormField } from '../WillDraftingUI';
import type { StepFuneralWishesProps } from './types';

export function StepFuneralWishes({ funeralWishes, additionalClauses, onUpdate }: StepFuneralWishesProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Funeral Wishes & Additional Clauses"
        description="Record any funeral or burial wishes and additional legal clauses to be included in the will."
      />

      <FormField label="Funeral Wishes">
        <Textarea
          value={funeralWishes}
          onChange={(e) => onUpdate('funeralWishes', e.target.value)}
          placeholder="e.g., I wish to be cremated and my ashes scattered at..."
          rows={5}
        />
      </FormField>

      <FormField label="Additional Clauses (Optional)">
        <Textarea
          value={additionalClauses}
          onChange={(e) => onUpdate('additionalClauses', e.target.value)}
          placeholder="Any other specific instructions or legal clauses to include in the will"
          rows={5}
        />
      </FormField>
    </div>
  );
}
