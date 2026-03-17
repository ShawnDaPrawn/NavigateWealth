import React, { useState, useCallback } from 'react';
import { Boxes, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { BlockDefinition, getBlockDefinition } from '../block-store';
import { ContainerData, FormBlock, BlockType } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../../ui/popover';
import { cn } from '../../../../../ui/utils';
import { KeySelector } from '../components/KeySelector';

// ============================================================================
// Block types allowed inside a Container — excludes container itself,
// page_break (meaningless inside a container), and other structural blocks.
// ============================================================================
const ALLOWED_CHILD_TYPES: BlockType[] = [
  'text',
  'section_header',
  'field_grid',
  'table',
  'checkbox_table',
  'radio_options',
  'signature',
  'fine_print',
  'clause_initial',
  'compliance_question',
  'instructional_callout',
  'comb_input',
  'bank_details',
  'beneficiary_table',
  'address_block',
  'spacer',
  'image_asset',
  'smart_clause',
  'office_use',
  'witness_signature',
  'non_breaking_signature',
  'financial_table',
  'client_summary',
  'risk_profile',
  'attachment_placeholder',
];

type ConditionOperator = 'equals' | 'not_equals' | 'exists' | 'not_exists';

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

export const ContainerBlock: BlockDefinition = {
  type: 'container',
  label: 'Conditional Section',
  icon: Boxes,
  category: 'layout',
  description: 'Show/hide blocks based on conditions',
  initialData: {
    conditionVariable: '',
    conditionValue: '',
    conditionOperator: 'equals' as ConditionOperator,
    blocks: [],
  } as ContainerData & { conditionOperator?: ConditionOperator },

  // ==========================================================================
  // CANVAS RENDER — shows conditional header + recursively rendered children
  // ==========================================================================
  render: ({ block }) => {
    const data = block.data as ContainerData & { conditionOperator?: ConditionOperator };
    const operator = data.conditionOperator || 'equals';
    const childBlocks = data.blocks || [];

    const operatorLabel = {
      equals: '==',
      not_equals: '!=',
      exists: 'exists',
      not_exists: 'does not exist',
    }[operator];

    return (
      <div className="w-full my-1">
        {/* Condition badge */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center gap-1 text-[9px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
            <span className="font-bold text-purple-800">IF</span>
            <span className="bg-white px-1 border border-purple-100 rounded">
              {data.conditionVariable || '…'}
            </span>
            <span>{operatorLabel}</span>
            {(operator === 'equals' || operator === 'not_equals') && (
              <span className="bg-white px-1 border border-purple-100 rounded">
                "{data.conditionValue || '…'}"
              </span>
            )}
          </div>
        </div>

        {/* Children container */}
        <div className="border-l-[3px] border-purple-400 pl-3 py-1 rounded-r bg-purple-50/30">
          {childBlocks.length === 0 ? (
            <div className="py-4 text-center text-[10px] text-gray-400 border-2 border-dashed border-purple-200 rounded bg-white/50">
              Drag blocks here or add via the properties panel
            </div>
          ) : (
            <div className="space-y-1">
              {childBlocks.map((child) => {
                const childDef = getBlockDefinition(child.type);
                if (!childDef) {
                  return (
                    <div key={child.id} className="p-1 bg-red-50 text-red-500 text-[9px] rounded">
                      Unknown: {child.type}
                    </div>
                  );
                }
                return (
                  <div key={child.id} className="bg-white rounded border border-gray-100 p-1">
                    {childDef.render({ block: child })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* End indicator */}
        <div className="flex items-center gap-2 mt-1">
          <div className="text-[8px] font-mono text-purple-400 bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5">
            END IF
          </div>
          <div className="flex-1 border-t border-purple-100" />
        </div>
      </div>
    );
  },

  // ==========================================================================
  // EDITOR — condition fields + nested block manager
  // ==========================================================================
  editor: ({ block, onChange }) => {
    const data = block.data as ContainerData & { conditionOperator?: ConditionOperator };
    const operator: ConditionOperator = data.conditionOperator || 'equals';
    const childBlocks: FormBlock[] = data.blocks || [];

    const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
    const [addBlockOpen, setAddBlockOpen] = useState(false);

    // -- Nested block operations --
    const addChildBlock = useCallback((type: BlockType) => {
      const def = getBlockDefinition(type);
      if (!def) return;
      const newChild: FormBlock = {
        id: generateId(),
        type,
        data: { ...def.initialData },
      };
      onChange('blocks', [...childBlocks, newChild]);
      setExpandedChildId(newChild.id);
      setAddBlockOpen(false);
    }, [childBlocks, onChange]);

    const removeChildBlock = useCallback((childId: string) => {
      onChange('blocks', childBlocks.filter(c => c.id !== childId));
      if (expandedChildId === childId) setExpandedChildId(null);
    }, [childBlocks, onChange, expandedChildId]);

    const moveChildBlock = useCallback((childId: string, direction: 'up' | 'down') => {
      const idx = childBlocks.findIndex(c => c.id === childId);
      if (idx === -1) return;
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === childBlocks.length - 1) return;
      const updated = [...childBlocks];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
      onChange('blocks', updated);
    }, [childBlocks, onChange]);

    const updateChildBlock = useCallback((childId: string, key: string | Record<string, unknown>, value?: unknown) => {
      const updated = childBlocks.map(c => {
        if (c.id !== childId) return c;
        if (typeof key === 'object' && key !== null) {
          return { ...c, data: { ...c.data, ...key } };
        }
        return { ...c, data: { ...c.data, [key as string]: value } };
      });
      onChange('blocks', updated);
    }, [childBlocks, onChange]);

    const showValueField = operator === 'equals' || operator === 'not_equals';

    return (
      <div className="space-y-5">
        {/* CONDITION SECTION */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-purple-100 flex items-center justify-center">
              <Boxes className="h-3 w-3 text-purple-600" />
            </div>
            <Label className="text-xs font-semibold text-gray-700">Condition</Label>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-100 rounded-md space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-gray-600">Variable</Label>
              <KeySelector
                value={data.conditionVariable || ''}
                onChange={(key) => onChange('conditionVariable', key)}
                placeholder="Select variable…"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-gray-600">Operator</Label>
              <Select value={operator} onValueChange={(val) => onChange('conditionOperator', val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="exists">Exists (has value)</SelectItem>
                  <SelectItem value="not_exists">Does Not Exist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showValueField && (
              <div className="space-y-1.5">
                <Label className="text-[10px] text-gray-600">Expected Value</Label>
                <Input
                  value={data.conditionValue || ''}
                  onChange={(e) => onChange('conditionValue', e.target.value)}
                  placeholder='e.g. "married", "true", "Yes"'
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Blocks inside this container only appear in the rendered form when the condition is met.
          </p>
        </div>

        {/* NESTED BLOCKS SECTION */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-gray-700">
              Nested Blocks ({childBlocks.length})
            </Label>
          </div>

          {childBlocks.length === 0 ? (
            <div className="py-6 text-center border-2 border-dashed border-gray-200 rounded-md bg-gray-50">
              <p className="text-xs text-gray-400">No blocks yet</p>
              <p className="text-[10px] text-gray-400 mt-1">Add blocks that will appear when the condition is met</p>
            </div>
          ) : (
            <div className="space-y-1">
              {childBlocks.map((child, idx) => {
                const childDef = getBlockDefinition(child.type);
                const isExpanded = expandedChildId === child.id;

                return (
                  <div key={child.id} className="border border-gray-200 rounded-md overflow-hidden bg-white">
                    {/* Child block header */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors",
                        isExpanded && "bg-blue-50 border-b border-gray-200"
                      )}
                      onClick={() => setExpandedChildId(isExpanded ? null : child.id)}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 text-gray-400 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                      {childDef && <childDef.icon className="h-3.5 w-3.5 text-gray-500" />}
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {childDef?.label || child.type}
                      </span>

                      {/* Inline actions */}
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => moveChildBlock(child.id, 'up')}
                          disabled={idx === 0}
                          className={cn(
                            "h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100",
                            idx === 0 ? "text-gray-300" : "text-gray-500"
                          )}
                          title="Move up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveChildBlock(child.id, 'down')}
                          disabled={idx === childBlocks.length - 1}
                          className={cn(
                            "h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100",
                            idx === childBlocks.length - 1 ? "text-gray-300" : "text-gray-500"
                          )}
                          title="Move down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeChildBlock(child.id)}
                          className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Child block editor — expanded */}
                    {isExpanded && childDef && (
                      <div className="p-3 bg-gray-50 border-t border-gray-100">
                        {childDef.editor({
                          block: child,
                          onChange: (key: string | Record<string, unknown>, value?: unknown) => updateChildBlock(child.id, key, value),
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add block button */}
          <Popover open={addBlockOpen} onOpenChange={setAddBlockOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-dashed"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Add Block
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto" align="start">
              <div className="space-y-0.5">
                {ALLOWED_CHILD_TYPES.map((type) => {
                  const def = getBlockDefinition(type);
                  if (!def) return null;
                  return (
                    <button
                      key={type}
                      onClick={() => addChildBlock(type)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-gray-100 transition-colors"
                    >
                      <def.icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700">{def.label}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  },
};