/**
 * Step: Healthcare Agents (Living Will only)
 * Appoint healthcare decision-makers.
 */

import React from 'react';
import { Input } from '../../../../../ui/input';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import { Plus, Shield } from 'lucide-react';
import { StepSectionHeader, ItemCard, EmptyState, FieldRow, FormField } from '../WillDraftingUI';
import type { StepHealthcareAgentsProps } from './types';

export function StepHealthcareAgents({ agents, onAdd, onUpdate, onRemove }: StepHealthcareAgentsProps) {
  return (
    <div className="space-y-5">
      <StepSectionHeader
        title="Healthcare Agent / Proxy"
        description="Appoint one or more people to make healthcare decisions on your behalf when you are unable to do so. At least one primary agent is required."
        action={
          <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Agent
          </Button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No healthcare agents appointed"
          description="You must appoint at least one healthcare agent who will make medical decisions on your behalf."
        />
      ) : (
        <div className="space-y-4">
          {agents.map((agent, idx) => (
            <ItemCard
              key={agent.id}
              index={idx + 1}
              title={agent.name || 'Unnamed Agent'}
              badge={
                <Badge
                  variant={agent.isPrimary ? 'default' : 'outline'}
                  className={`text-xs ${agent.isPrimary ? 'bg-[#6d28d9] hover:bg-[#5b21b6]' : ''}`}
                >
                  {agent.isPrimary ? 'Primary' : 'Alternate'}
                </Badge>
              }
              onRemove={() => onRemove(agent.id)}
            >
              <div className="space-y-4">
                <FieldRow>
                  <FormField label="Full Name">
                    <Input
                      value={agent.name}
                      onChange={(e) => onUpdate(agent.id, 'name', e.target.value)}
                      placeholder="Full legal name"
                    />
                  </FormField>
                  <FormField label="ID Number">
                    <Input
                      value={agent.idNumber}
                      onChange={(e) => onUpdate(agent.id, 'idNumber', e.target.value)}
                      placeholder="ID number"
                    />
                  </FormField>
                </FieldRow>
                <FieldRow>
                  <FormField label="Relationship">
                    <Input
                      value={agent.relationship}
                      onChange={(e) => onUpdate(agent.id, 'relationship', e.target.value)}
                      placeholder="e.g., Spouse, Child, Sibling"
                    />
                  </FormField>
                  <FormField label="Contact Details">
                    <Input
                      value={agent.contactDetails}
                      onChange={(e) => onUpdate(agent.id, 'contactDetails', e.target.value)}
                      placeholder="Phone and email"
                    />
                  </FormField>
                </FieldRow>
                <div className="flex items-center gap-2.5 pt-1">
                  <Checkbox
                    id={`primary-${agent.id}`}
                    checked={agent.isPrimary}
                    onCheckedChange={(checked) => onUpdate(agent.id, 'isPrimary', !!checked)}
                  />
                  <Label htmlFor={`primary-${agent.id}`} className="text-sm font-normal cursor-pointer">
                    Designate as primary healthcare agent
                  </Label>
                </div>
              </div>
            </ItemCard>
          ))}
        </div>
      )}
    </div>
  );
}
