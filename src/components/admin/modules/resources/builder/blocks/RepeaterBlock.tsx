import React from 'react';
import { List, Plus, Trash2, UserPlus } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { RepeaterData, RepeaterColumn } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import { KeySelector } from '../components/KeySelector';

// ============================================================================
// RepeaterBlock — data-bound table that iterates over an array variable.
//
// At design time, shows a header row + two sample placeholder rows.
// At render time (PDF / interactive), iterates over the bound array
// and produces one row per item.
//
// When `userPopulated` is true, the interactive renderer shows editable
// cells with inline add/delete row controls.
// ============================================================================

export const RepeaterBlock: BlockDefinition = {
  type: 'repeater',
  label: 'Repeater List',
  icon: List,
  category: 'tables',
  description: 'Data-bound repeating table rows',
  initialData: {
    title: 'Assets',
    variableName: 'assets_list',
    columns: [
      { header: 'Description', key: 'description', width: '60%' },
      { header: 'Value', key: 'value', width: '40%' },
    ],
    emptyMessage: 'No items listed.',
    userPopulated: false,
  } as RepeaterData,

  // ==========================================================================
  // CANVAS RENDER — header + sample rows + binding indicator
  // ==========================================================================
  render: ({ block }) => {
    const data = block.data as RepeaterData;
    const columns = data.columns || [];

    return (
      <div className="w-full my-1">
        {data.title && (
          <div className="flex items-center gap-2 mb-1">
            <div className="font-bold text-[10px] uppercase tracking-wider text-gray-800">
              {data.title}
            </div>
            {data.userPopulated && (
              <div className="flex items-center gap-0.5 text-[8px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                <UserPlus className="h-2.5 w-2.5" />
                User-editable
              </div>
            )}
          </div>
        )}

        <div className="border border-gray-300 w-full text-[9px]">
          {/* Header row */}
          <div className="flex bg-gray-100 border-b border-gray-300 font-bold">
            {columns.map((col, i) => (
              <div
                key={`hdr-${i}`}
                className="p-1.5 border-r last:border-r-0 border-gray-300 text-gray-700"
                style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
              >
                {col.header}
              </div>
            ))}
            {data.userPopulated && (
              <div className="w-8 p-1.5 text-center text-gray-400 flex-shrink-0">
                ×
              </div>
            )}
          </div>

          {/* Sample row 1 */}
          <div className="flex border-b border-gray-300 bg-yellow-50/40">
            {columns.map((col, i) => (
              <div
                key={`r1-${i}`}
                className="p-1.5 border-r last:border-r-0 border-gray-300 font-mono text-gray-500 italic"
                style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
              >
                {'{{'}
                {col.key}
                {'}}'}
              </div>
            ))}
            {data.userPopulated && (
              <div className="w-8 p-1.5 flex-shrink-0" />
            )}
          </div>

          {/* Sample row 2 — indicates repetition */}
          <div className="flex bg-yellow-50/40">
            {columns.map((col, i) => (
              <div
                key={`r2-${i}`}
                className="p-1.5 border-r last:border-r-0 border-gray-300 text-gray-400 italic text-center"
                style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
              >
                {i === 0 ? '… repeats per item' : '…'}
              </div>
            ))}
            {data.userPopulated && (
              <div className="w-8 p-1.5 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Add row indicator for user-populated repeaters */}
        {data.userPopulated && (
          <div className="flex items-center gap-1.5 mt-0.5 text-[8px] text-emerald-600 font-medium">
            <Plus className="h-2.5 w-2.5" />
            <span>Users can add rows in interactive mode</span>
          </div>
        )}

        {/* Binding indicator */}
        <div className="flex items-center justify-between mt-1">
          <div className="text-[8px] font-mono text-gray-400">
            Bound to: <span className="text-amber-600">{data.variableName || '(none)'}</span>
          </div>
          {data.emptyMessage && (
            <div className="text-[8px] text-gray-400 italic">
              Empty: "{data.emptyMessage}"
            </div>
          )}
        </div>
      </div>
    );
  },

  // ==========================================================================
  // EDITOR — title, variable binding, column definitions, empty message
  // ==========================================================================
  editor: ({ block, onChange }) => {
    const data = block.data as RepeaterData;
    const columns = data.columns || [];

    const addColumn = () => {
      const newCols = [
        ...columns,
        { header: 'New Column', key: 'new_col', width: '' },
      ];
      onChange('columns', newCols);
    };

    const updateColumn = (
      index: number,
      field: keyof RepeaterColumn,
      val: string
    ) => {
      const newCols = [...columns];
      newCols[index] = { ...newCols[index], [field]: val };
      onChange('columns', newCols);
    };

    const removeColumn = (index: number) => {
      onChange('columns', columns.filter((_: RepeaterColumn, i: number) => i !== index));
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === columns.length - 1) return;
      const newCols = [...columns];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      [newCols[index], newCols[targetIdx]] = [newCols[targetIdx], newCols[index]];
      onChange('columns', newCols);
    };

    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Section Title</Label>
          <Input
            value={data.title || ''}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="e.g. Assets, Beneficiaries"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Variable Name (Array)</Label>
          <KeySelector
            value={data.variableName || ''}
            onChange={(key) => onChange('variableName', key)}
            placeholder="Select array variable…"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-gray-400">
            This repeater iterates over each item in the bound array.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">
            Columns ({columns.length})
          </Label>
          {columns.map((col: RepeaterColumn, i: number) => (
            <div
              key={i}
              className="border border-gray-200 rounded-md p-2 bg-gray-50 space-y-2"
            >
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-mono w-5 text-center">
                  {i + 1}
                </span>
                <Input
                  placeholder="Header"
                  value={col.header}
                  onChange={(e) => updateColumn(i, 'header', e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <button
                  onClick={() => moveColumn(i, 'up')}
                  disabled={i === 0}
                  className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2L9 7H1z" fill="currentColor"/></svg>
                </button>
                <button
                  onClick={() => moveColumn(i, 'down')}
                  disabled={i === columns.length - 1}
                  className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 8L1 3h8z" fill="currentColor"/></svg>
                </button>
                <button
                  onClick={() => removeColumn(i)}
                  className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex gap-2 pl-6">
                <Input
                  placeholder="Key"
                  value={col.key}
                  onChange={(e) => updateColumn(i, 'key', e.target.value)}
                  className="h-7 text-xs font-mono flex-1"
                />
                <Input
                  placeholder="Width"
                  value={col.width || ''}
                  onChange={(e) => updateColumn(i, 'width', e.target.value)}
                  className="h-7 text-xs w-20"
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={addColumn}
            className="w-full text-xs h-8 border-dashed"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Column
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Empty State Message</Label>
          <Input
            value={data.emptyMessage || ''}
            onChange={(e) => onChange('emptyMessage', e.target.value)}
            placeholder="Shown when the array is empty"
            className="h-8 text-xs"
          />
        </div>

        {/* User-populated toggle */}
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-md space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                User-Populated Mode
              </Label>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Users can add, edit, and delete rows in interactive forms
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!data.userPopulated}
              onClick={() => onChange('userPopulated', !data.userPopulated)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                data.userPopulated ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${
                  data.userPopulated ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  },
};