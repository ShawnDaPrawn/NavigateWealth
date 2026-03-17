/**
 * Step: Specific Bequests (Last Will only)
 * Specific items to specific people.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Button } from '../../../../../ui/button';
import { Plus, Home } from 'lucide-react';
import { StepSectionHeader, ItemCard, EmptyState, FieldRow, FormField } from '../WillDraftingUI';
import type { StepBequestsProps } from './types';

export function StepBequests({ bequests, onAdd, onUpdate, onRemove }: StepBequestsProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Specific Bequests"
        description="Leave specific items or assets to named individuals. These bequests are distributed before the residue of the estate."
        action={
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Bequest
          </Button>
        }
      />

      {bequests.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No specific bequests"
          description="Add items you wish to leave to specific people, or skip this step if not applicable."
        />
      ) : (
        <div className="space-y-4">
          {bequests.map((bequest, idx) => (
            <ItemCard
              key={bequest.id}
              index={idx + 1}
              title={bequest.beneficiaryName ? `To ${bequest.beneficiaryName}` : 'Unnamed Bequest'}
              onRemove={() => onRemove(bequest.id)}
            >
              <div className="space-y-4">
                <FormField label="Item Description">
                  <Textarea
                    value={bequest.itemDescription}
                    onChange={(e) => onUpdate(bequest.id, 'itemDescription', e.target.value)}
                    placeholder="e.g., My gold watch, My property at 123 Main Street"
                    rows={2}
                  />
                </FormField>
                <FieldRow>
                  <FormField label="Beneficiary Name">
                    <Input
                      value={bequest.beneficiaryName}
                      onChange={(e) => onUpdate(bequest.id, 'beneficiaryName', e.target.value)}
                      placeholder="Who will receive this item"
                    />
                  </FormField>
                  <FormField label="Beneficiary ID Number">
                    <Input
                      value={bequest.beneficiaryIdNumber}
                      onChange={(e) => onUpdate(bequest.id, 'beneficiaryIdNumber', e.target.value)}
                      placeholder="ID number"
                    />
                  </FormField>
                </FieldRow>
              </div>
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}
