/**
 * Step: Personal Details (shared between Last Will and Living Will)
 * Testator identification, marital status, and address.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Separator } from '../../../../../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { StepSectionHeader, FieldRow, FormField } from '../WillDraftingUI';
import type { StepPersonalDetailsProps } from './types';

export function StepPersonalDetails({ personalDetails: pd, onUpdate }: StepPersonalDetailsProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Personal Details"
        description="Enter the testator's legal identification details. These will appear on the official will document."
      />

      <FieldRow>
        <FormField label="Full Legal Name" required>
          <Input
            value={pd.fullName}
            onChange={(e) => onUpdate('fullName', e.target.value)}
            placeholder="Enter full legal name as per ID"
          />
        </FormField>
        <FormField label="ID / Passport Number" required>
          <Input
            value={pd.idNumber}
            onChange={(e) => onUpdate('idNumber', e.target.value)}
            placeholder="e.g., 8501015009087"
          />
        </FormField>
      </FieldRow>

      <FieldRow>
        <FormField label="Date of Birth" required>
          <Input
            type="date"
            value={pd.dateOfBirth}
            onChange={(e) => onUpdate('dateOfBirth', e.target.value)}
          />
        </FormField>
        <FormField label="Marital Status" required>
          <Select
            value={pd.maritalStatus}
            onValueChange={(value) => onUpdate('maritalStatus', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married_cop">Married in Community of Property</SelectItem>
              <SelectItem value="married_anc">Married ANC with Accrual</SelectItem>
              <SelectItem value="married_customary">Married under Customary Law</SelectItem>
              <SelectItem value="divorced">Divorced</SelectItem>
              <SelectItem value="widowed">Widowed</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FieldRow>

      {pd.maritalStatus.startsWith('married') && (
        <div className="contents">
          <Separator className="my-1" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Spouse Information</p>
          <FieldRow>
            <FormField label="Spouse Full Name">
              <Input
                value={pd.spouseName || ''}
                onChange={(e) => onUpdate('spouseName', e.target.value)}
                placeholder="Spouse's full legal name"
              />
            </FormField>
            <FormField label="Spouse ID Number">
              <Input
                value={pd.spouseIdNumber || ''}
                onChange={(e) => onUpdate('spouseIdNumber', e.target.value)}
                placeholder="Spouse's ID number"
              />
            </FormField>
          </FieldRow>
        </div>
      )}

      <FormField label="Physical Address" required>
        <Textarea
          value={pd.physicalAddress}
          onChange={(e) => onUpdate('physicalAddress', e.target.value)}
          placeholder="Enter full residential address"
          rows={3}
        />
      </FormField>
    </div>
  );
}
