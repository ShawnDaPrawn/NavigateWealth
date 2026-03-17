/**
 * ConditionalLogicEditor — Phase 2 block visibility rules.
 *
 * Allows admins to configure show/hide rules for blocks based on
 * field values in the form. Renders in the PropertiesPanel.
 *
 * Guidelines §7.1 — Pure utility for condition evaluation.
 * Guidelines §8.3 — Consistent form patterns.
 */

import React from 'react';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { Button } from '../../../../../ui/button';
import { Switch } from '../../../../../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import type {
  BlockVisibilityRule,
  VisibilityCondition,
  ConditionOperator,
} from '../constants';

interface ConditionalLogicEditorProps {
  rule: BlockVisibilityRule | undefined;
  onChange: (rule: BlockVisibilityRule | undefined) => void;
}

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_empty', label: 'Is not empty' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
];

/** Does this operator need a comparison value? */
function operatorNeedsValue(op: ConditionOperator): boolean {
  return !['not_empty', 'is_empty'].includes(op);
}

export function ConditionalLogicEditor({
  rule,
  onChange,
}: ConditionalLogicEditorProps) {
  const isEnabled = !!rule;
  const conditions = rule?.conditions ?? [];

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        matchAny: false,
        conditions: [{ fieldKey: '', operator: 'not_empty' }],
      });
    } else {
      onChange(undefined);
    }
  };

  const handleUpdateCondition = (
    index: number,
    updates: Partial<VisibilityCondition>,
  ) => {
    if (!rule) return;
    const updated = rule.conditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c,
    );
    onChange({ ...rule, conditions: updated });
  };

  const handleAddCondition = () => {
    if (!rule) return;
    onChange({
      ...rule,
      conditions: [
        ...rule.conditions,
        { fieldKey: '', operator: 'not_empty' },
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    if (!rule) return;
    const updated = rule.conditions.filter((_, i) => i !== index);
    if (updated.length === 0) {
      onChange(undefined);
    } else {
      onChange({ ...rule, conditions: updated });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isEnabled ? (
            <Eye className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-gray-400" />
          )}
          <Label className="text-xs font-semibold text-gray-700">
            Conditional Visibility
          </Label>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          className="data-[state=checked]:bg-blue-600"
        />
      </div>

      {isEnabled && rule && (
        <div className="space-y-2">
          {/* Match mode */}
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-500">Show block when</span>
            <button
              onClick={() => onChange({ ...rule, matchAny: !rule.matchAny })}
              className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              {rule.matchAny ? 'ANY' : 'ALL'}
            </button>
            <span className="text-gray-500">
              condition{conditions.length !== 1 ? 's' : ''} match
            </span>
          </div>

          {/* Conditions */}
          {conditions.map((condition, index) => (
            <div
              key={index}
              className="bg-blue-50/50 border border-blue-100 rounded-md p-2 space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                <Input
                  value={condition.fieldKey}
                  onChange={(e) =>
                    handleUpdateCondition(index, { fieldKey: e.target.value })
                  }
                  placeholder="Field key (e.g. smoker)"
                  className="h-7 text-[11px] flex-1 bg-white border-gray-200"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => handleRemoveCondition(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Select
                  value={condition.operator}
                  onValueChange={(val: ConditionOperator) =>
                    handleUpdateCondition(index, {
                      operator: val,
                      // Clear value if switching to operator that doesn't need it
                      ...(operatorNeedsValue(val)
                        ? {}
                        : { value: undefined }),
                    })
                  }
                >
                  <SelectTrigger className="h-7 text-[11px] flex-1 bg-white border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {operatorNeedsValue(condition.operator) && (
                  <Input
                    value={condition.value ?? ''}
                    onChange={(e) =>
                      handleUpdateCondition(index, { value: e.target.value })
                    }
                    placeholder="Value"
                    className="h-7 text-[11px] flex-1 bg-white border-gray-200"
                  />
                )}
              </div>
            </div>
          ))}

          {/* Add condition button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-dashed border-blue-200"
            onClick={handleAddCondition}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Condition
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Utility — Evaluate visibility conditions against form responses
// Guidelines §7.1 — Pure utility function, no UI dependencies
// ============================================================================

export function evaluateVisibility(
  rule: BlockVisibilityRule | undefined,
  responses: Record<string, unknown>,
): boolean {
  if (!rule || rule.conditions.length === 0) return true;

  const evaluateCondition = (condition: VisibilityCondition): boolean => {
    const fieldValue = responses[condition.fieldKey];
    const stringValue = fieldValue != null ? String(fieldValue) : '';

    switch (condition.operator) {
      case 'equals':
        return stringValue === String(condition.value ?? '');
      case 'not_equals':
        return stringValue !== String(condition.value ?? '');
      case 'contains':
        return stringValue.toLowerCase().includes(String(condition.value ?? '').toLowerCase());
      case 'not_empty':
        return stringValue.trim().length > 0;
      case 'is_empty':
        return stringValue.trim().length === 0;
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value ?? 0);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value ?? 0);
      default:
        return true;
    }
  };

  return rule.matchAny
    ? rule.conditions.some(evaluateCondition)
    : rule.conditions.every(evaluateCondition);
}
