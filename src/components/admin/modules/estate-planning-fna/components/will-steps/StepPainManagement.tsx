/**
 * Step: Pain Management & Comfort Care (Living Will only)
 */

import React from 'react';
import { Textarea } from '../../../../../ui/textarea';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import { Separator } from '../../../../../ui/separator';
import { Card, CardContent } from '../../../../../ui/card';
import { StepSectionHeader, FormField } from '../WillDraftingUI';
import type { StepPainManagementProps } from './types';

export function StepPainManagement({ painManagement, onToggle, onInstructionsChange }: StepPainManagementProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Pain Management & Comfort Care"
        description="Specify your preferences for pain management and comfort care in end-of-life situations."
      />

      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="comfortCareOnly"
              checked={painManagement.comfortCareOnly}
              onCheckedChange={(checked) => onToggle('comfortCareOnly', !!checked)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="comfortCareOnly" className="text-sm font-medium cursor-pointer">
                Comfort Care Only
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                I request only comfort care measures — no curative or life-prolonging treatment
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <Checkbox
              id="maximumPainRelief"
              checked={painManagement.maximumPainRelief}
              onCheckedChange={(checked) => onToggle('maximumPainRelief', !!checked)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="maximumPainRelief" className="text-sm font-medium cursor-pointer">
                Maximum Pain Relief
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                I request maximum pain relief even if it may hasten death
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FormField label="Additional Pain Management Instructions">
        <Textarea
          value={painManagement.additionalInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Any additional pain management preferences or instructions..."
          rows={3}
        />
      </FormField>
    </div>
  );
}
