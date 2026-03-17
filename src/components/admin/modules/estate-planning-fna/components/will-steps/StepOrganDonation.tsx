/**
 * Step: Organ & Tissue Donation (Living Will only)
 */

import React from 'react';
import { Textarea } from '../../../../../ui/textarea';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import { Separator } from '../../../../../ui/separator';
import { Card, CardContent } from '../../../../../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { StepSectionHeader, FormField } from '../WillDraftingUI';
import type { StepOrganDonationProps } from './types';

export function StepOrganDonation({
  organDonation,
  onDonorChange,
  onTypeChange,
  onSpecificOrgansChange,
  onInstructionsChange,
}: StepOrganDonationProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Organ & Tissue Donation"
        description="Indicate your preferences regarding organ and tissue donation after death."
      />

      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="isDonor"
              checked={organDonation.isDonor}
              onCheckedChange={(checked) => onDonorChange(!!checked)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="isDonor" className="text-sm font-medium cursor-pointer">
                I wish to be an organ and tissue donor
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upon my death, I consent to the donation of my organs and/or tissues
              </p>
            </div>
          </div>

          {organDonation.isDonor && (
            <div className="contents">
              <Separator />
              <FormField label="Donation Type">
                <Select
                  value={organDonation.donationType}
                  onValueChange={(value) => onTypeChange(value as 'all' | 'specific' | 'none')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organs and tissues</SelectItem>
                    <SelectItem value="specific">Specific organs only</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {organDonation.donationType === 'specific' && (
                <FormField label="Specify Organs">
                  <Textarea
                    value={organDonation.specificOrgans}
                    onChange={(e) => onSpecificOrgansChange(e.target.value)}
                    placeholder="e.g., Kidneys, Heart, Corneas, Liver"
                    rows={2}
                  />
                </FormField>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <FormField label="Additional Organ Donation Instructions">
        <Textarea
          value={organDonation.additionalInstructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Any additional organ donation instructions or conditions..."
          rows={3}
        />
      </FormField>
    </div>
  );
}
