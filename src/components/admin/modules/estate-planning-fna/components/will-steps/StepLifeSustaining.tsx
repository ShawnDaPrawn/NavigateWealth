/**
 * Step: Life-Sustaining Treatment Preferences (Living Will only)
 */

import React from 'react';
import { Textarea } from '../../../../../ui/textarea';
import { Card } from '../../../../../ui/card';
import { Activity } from 'lucide-react';
import { TREATMENT_LABELS, TREATMENT_OPTION_LABELS } from '../WillDraftingConstants';
import { StepSectionHeader, FormField } from '../WillDraftingUI';
import type { StepLifeSustainingProps } from './types';

const TREATMENT_KEYS = ['ventilator', 'cpr', 'artificialNutrition', 'dialysis', 'antibiotics'] as const;
const OPTION_KEYS = ['accept', 'refuse', 'limited'] as const;

export function StepLifeSustaining({ treatment, onTreatmentChange, onInstructionsChange }: StepLifeSustainingProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Life-Sustaining Treatment Preferences"
        description="Indicate your preferences for medical treatment in the event of a terminal condition, persistent vegetative state, or irreversible coma."
      />

      <div className="space-y-3">
        {TREATMENT_KEYS.map((key) => (
          <Card key={key} className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-800">{TREATMENT_LABELS[key]}</span>
              </div>
              <div className="flex gap-2 sm:gap-1">
                {OPTION_KEYS.map((option) => {
                  const isSelected = treatment[key] === option;
                  const colorMap = {
                    accept: isSelected ? 'bg-green-600 text-white hover:bg-green-700 border-green-600' : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50',
                    refuse: isSelected ? 'bg-red-600 text-white hover:bg-red-700 border-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50',
                    limited: isSelected ? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500' : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50',
                  };
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onTreatmentChange(key, option)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${colorMap[option]}`}
                    >
                      {TREATMENT_OPTION_LABELS[option]}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <FormField label="Additional Treatment Instructions">
        <Textarea
          value={treatment.additionalInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Any additional treatment instructions or conditions..."
          rows={3}
        />
      </FormField>
    </div>
  );
}
