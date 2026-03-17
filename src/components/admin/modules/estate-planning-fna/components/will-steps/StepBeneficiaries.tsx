/**
 * Step: Beneficiaries (Last Will only)
 * Designate heirs and their shares.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Plus, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { StepSectionHeader, ItemCard, EmptyState, FieldRow, FormField } from '../WillDraftingUI';
import type { StepBeneficiariesProps } from './types';

export function StepBeneficiaries({
  beneficiaries,
  beneficiaryTotal,
  onAdd,
  onUpdate,
  onRemove,
}: StepBeneficiariesProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Beneficiaries"
        description="Specify who will inherit the residue of the estate and their proportional shares. Percentages should total 100%."
        action={
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Beneficiary
          </Button>
        }
      />

      {beneficiaries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No beneficiaries designated"
          description="Add beneficiaries who will inherit from the estate."
        />
      ) : (
        <div className="space-y-4">
          {beneficiaries.map((beneficiary, idx) => (
            <ItemCard
              key={beneficiary.id}
              index={idx + 1}
              title={beneficiary.name || 'Unnamed Beneficiary'}
              badge={
                beneficiary.percentage > 0 ? (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {beneficiary.percentage}%
                  </Badge>
                ) : undefined
              }
              onRemove={() => onRemove(beneficiary.id)}
            >
              <div className="space-y-4">
                <FieldRow>
                  <FormField label="Full Name">
                    <Input
                      value={beneficiary.name}
                      onChange={(e) => onUpdate(beneficiary.id, 'name', e.target.value)}
                      placeholder="Full legal name"
                    />
                  </FormField>
                  <FormField label="ID Number">
                    <Input
                      value={beneficiary.idNumber}
                      onChange={(e) => onUpdate(beneficiary.id, 'idNumber', e.target.value)}
                      placeholder="ID number"
                    />
                  </FormField>
                </FieldRow>
                <FieldRow>
                  <FormField label="Relationship">
                    <Input
                      value={beneficiary.relationship}
                      onChange={(e) => onUpdate(beneficiary.id, 'relationship', e.target.value)}
                      placeholder="e.g., Son, Daughter, Spouse"
                    />
                  </FormField>
                  <FormField label="Percentage (%)">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={beneficiary.percentage}
                      onChange={(e) =>
                        onUpdate(beneficiary.id, 'percentage', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0-100"
                    />
                  </FormField>
                </FieldRow>
              </div>
            </ItemCard>
          ))}

          {/* Percentage total indicator */}
          <div className={`flex items-center justify-between px-5 py-3 rounded-lg border-2 ${
            beneficiaryTotal === 100
              ? 'border-green-200 bg-green-50'
              : beneficiaryTotal > 100
              ? 'border-red-200 bg-red-50'
              : 'border-amber-200 bg-amber-50'
          }`}>
            <span className="text-sm font-medium text-gray-700">Total Allocation</span>
            <div className="flex items-center gap-2">
              {beneficiaryTotal === 100 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              {beneficiaryTotal > 100 && <AlertCircle className="h-4 w-4 text-red-600" />}
              <span className={`text-lg font-bold ${
                beneficiaryTotal === 100 ? 'text-green-600' : beneficiaryTotal > 100 ? 'text-red-600' : 'text-amber-600'
              }`}>
                {beneficiaryTotal}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
