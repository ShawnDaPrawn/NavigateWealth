/**
 * Step: Guardians (Last Will only)
 * Guardians for minor children.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Textarea } from '../../../../../ui/textarea';
import { Button } from '../../../../../ui/button';
import { Plus, Shield } from 'lucide-react';
import { StepSectionHeader, ItemCard, EmptyState, FieldRow, FormField } from '../WillDraftingUI';
import type { StepGuardiansProps } from './types';

export function StepGuardians({ guardians, onAdd, onUpdate, onRemove }: StepGuardiansProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Guardians for Minor Children"
        description="Appoint guardians who will care for minor children in the event of both parents' death. Skip this step if not applicable."
        action={
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Guardian
          </Button>
        }
      />

      {guardians.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No guardians appointed"
          description="If you have minor children, appoint one or more guardians. Otherwise, you may skip this step."
        />
      ) : (
        <div className="space-y-4">
          {guardians.map((guardian, idx) => (
            <ItemCard
              key={guardian.id}
              index={idx + 1}
              title={guardian.name || 'Unnamed Guardian'}
              onRemove={() => onRemove(guardian.id)}
            >
              <div className="space-y-4">
                <FieldRow>
                  <FormField label="Full Name">
                    <Input
                      value={guardian.name}
                      onChange={(e) => onUpdate(guardian.id, 'name', e.target.value)}
                      placeholder="Full legal name"
                    />
                  </FormField>
                  <FormField label="ID Number">
                    <Input
                      value={guardian.idNumber}
                      onChange={(e) => onUpdate(guardian.id, 'idNumber', e.target.value)}
                      placeholder="ID number"
                    />
                  </FormField>
                </FieldRow>
                <FormField label="Relationship">
                  <Input
                    value={guardian.relationship}
                    onChange={(e) => onUpdate(guardian.id, 'relationship', e.target.value)}
                    placeholder="e.g., Brother, Sister, Friend"
                  />
                </FormField>
                <FormField label="Address">
                  <Textarea
                    value={guardian.address}
                    onChange={(e) => onUpdate(guardian.id, 'address', e.target.value)}
                    placeholder="Full residential address"
                    rows={2}
                  />
                </FormField>
              </div>
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}
