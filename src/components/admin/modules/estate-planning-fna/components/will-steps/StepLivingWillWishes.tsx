/**
 * Step: Funeral & End-of-Life Wishes (Living Will only)
 */

import React from 'react';
import { Textarea } from '../../../../../ui/textarea';
import { StepSectionHeader, FormField } from '../WillDraftingUI';
import type { StepLivingWillWishesProps } from './types';

export function StepLivingWillWishes({ funeralWishes, additionalDirectives, onUpdate }: StepLivingWillWishesProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Funeral & End-of-Life Wishes"
        description="Record any funeral, burial, or other end-of-life wishes and additional advance directives."
      />

      <FormField label="Funeral Wishes">
        <Textarea
          value={funeralWishes}
          onChange={(e) => onUpdate('funeralWishes', e.target.value)}
          placeholder="e.g., I wish to be cremated and my ashes scattered at..."
          rows={5}
        />
      </FormField>

      <FormField label="Additional Directives">
        <Textarea
          value={additionalDirectives}
          onChange={(e) => onUpdate('additionalDirectives', e.target.value)}
          placeholder="Any additional advance directives or instructions..."
          rows={5}
        />
      </FormField>
    </div>
  );
}
