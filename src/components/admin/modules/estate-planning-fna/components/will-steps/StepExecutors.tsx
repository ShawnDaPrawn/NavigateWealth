/**
 * Step: Executors (Last Will only)
 * Appoint estate administrators.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Plus, Briefcase } from 'lucide-react';
import { StepSectionHeader, ItemCard, EmptyState, FieldRow, FormField } from '../WillDraftingUI';
import type { StepExecutorsProps } from './types';

export function StepExecutors({ executors, onAdd, onUpdate, onRemove }: StepExecutorsProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Executors"
        description="Appoint one or more executors to administer the estate after death. You may appoint individuals or professional executor companies."
        action={
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Executor
          </Button>
        }
      />

      {executors.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No executors appointed"
          description="Add at least one executor who will be responsible for administering the estate."
        />
      ) : (
        <div className="space-y-4">
          {executors.map((executor, idx) => (
            <ItemCard
              key={executor.id}
              index={idx + 1}
              title={executor.name || 'Unnamed Executor'}
              badge={
                <Badge variant="outline" className="text-xs">
                  {executor.type === 'professional' ? 'Professional' : 'Individual'}
                </Badge>
              }
              onRemove={() => onRemove(executor.id)}
            >
              <div className="space-y-4">
                <FormField label="Executor Type">
                  <Select
                    value={executor.type}
                    onValueChange={(value) => onUpdate(executor.id, 'type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="professional">Professional Executor</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FieldRow>
                  <FormField label="Full Name">
                    <Input
                      value={executor.name}
                      onChange={(e) => onUpdate(executor.id, 'name', e.target.value)}
                      placeholder="Full legal name"
                    />
                  </FormField>
                  {executor.type === 'individual' ? (
                    <FormField label="ID Number">
                      <Input
                        value={executor.idNumber || ''}
                        onChange={(e) => onUpdate(executor.id, 'idNumber', e.target.value)}
                        placeholder="ID number"
                      />
                    </FormField>
                  ) : (
                    <FormField label="Company">
                      <Input
                        value={executor.company || ''}
                        onChange={(e) => onUpdate(executor.id, 'company', e.target.value)}
                        placeholder="Company name"
                      />
                    </FormField>
                  )}
                </FieldRow>
                <FormField label="Contact Details">
                  <Input
                    value={executor.contactDetails}
                    onChange={(e) => onUpdate(executor.id, 'contactDetails', e.target.value)}
                    placeholder="Phone number and email address"
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
