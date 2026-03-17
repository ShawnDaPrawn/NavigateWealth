/**
 * ValidationConfig — Phase 2 field validation rules editor.
 *
 * Renders in the PropertiesPanel when a field_grid block is selected.
 * Allows admins to attach validation rules to individual fields.
 *
 * Guidelines §8.3 — Form patterns, field labels.
 * Guidelines §5.3 — Config-driven from constants.
 */

import React, { useState } from 'react';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Plus, Trash2, ShieldCheck, Wand2 } from 'lucide-react';
import {
  type ValidationRule,
  type ValidationRuleType,
  VALIDATION_RULE_PRESETS,
} from '../constants';

interface ValidationConfigProps {
  rules: ValidationRule[];
  onChange: (rules: ValidationRule[]) => void;
}

const RULE_TYPE_OPTIONS: { value: ValidationRuleType; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'min_length', label: 'Min Length' },
  { value: 'max_length', label: 'Max Length' },
  { value: 'min_value', label: 'Min Value' },
  { value: 'max_value', label: 'Max Value' },
  { value: 'pattern', label: 'Regex Pattern' },
  { value: 'email', label: 'Email Format' },
  { value: 'phone', label: 'Phone Format' },
  { value: 'id_number', label: 'SA ID Number' },
];

/** Does this rule type require a value parameter? */
function ruleNeedsValue(type: ValidationRuleType): boolean {
  return ['min_length', 'max_length', 'min_value', 'max_value', 'pattern'].includes(type);
}

export function ValidationConfig({ rules, onChange }: ValidationConfigProps) {
  const [showPresets, setShowPresets] = useState(false);

  const handleAddRule = () => {
    onChange([
      ...rules,
      { type: 'required', message: 'This field is required' },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (
    index: number,
    key: keyof ValidationRule,
    value: string | number,
  ) => {
    const updated = rules.map((rule, i) =>
      i === index ? { ...rule, [key]: value } : rule,
    );
    onChange(updated);
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = VALIDATION_RULE_PRESETS[presetKey];
    if (preset) {
      onChange([...preset.rules]);
    }
    setShowPresets(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
          <Label className="text-xs font-semibold text-gray-700">Validation Rules</Label>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setShowPresets(!showPresets)}
          >
            <Wand2 className="h-3 w-3 mr-1" />
            Presets
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 text-purple-600"
            onClick={handleAddRule}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Preset Quick-Apply */}
      {showPresets && (
        <div className="bg-purple-50 border border-purple-100 rounded-md p-2 space-y-1">
          <p className="text-[10px] font-medium text-purple-700 mb-1">Quick Presets</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(VALIDATION_RULE_PRESETS).map(([key, preset]) => (
              <Badge
                key={key}
                variant="outline"
                className="cursor-pointer text-[10px] border-purple-200 text-purple-600 hover:bg-purple-100 transition-colors"
                onClick={() => handleApplyPreset(key)}
              >
                {preset.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <p className="text-[10px] text-gray-400 italic py-2">
          No validation rules configured. Click "Add" to add rules.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-100 rounded-md p-2 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <Select
                  value={rule.type}
                  onValueChange={(val: ValidationRuleType) =>
                    handleUpdateRule(index, 'type', val)
                  }
                >
                  <SelectTrigger className="h-7 text-[11px] flex-1 bg-white border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => handleRemoveRule(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {ruleNeedsValue(rule.type) && (
                <Input
                  value={rule.value ?? ''}
                  onChange={(e) =>
                    handleUpdateRule(
                      index,
                      'value',
                      rule.type.includes('value')
                        ? Number(e.target.value) || 0
                        : e.target.value,
                    )
                  }
                  placeholder={
                    rule.type === 'pattern'
                      ? 'Regex pattern (e.g. ^\\d{13}$)'
                      : 'Value'
                  }
                  className="h-7 text-[11px] bg-white border-gray-200"
                />
              )}

              <Input
                value={rule.message}
                onChange={(e) => handleUpdateRule(index, 'message', e.target.value)}
                placeholder="Error message"
                className="h-7 text-[11px] bg-white border-gray-200"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
