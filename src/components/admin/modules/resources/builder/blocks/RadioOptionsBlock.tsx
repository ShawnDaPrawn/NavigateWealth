import React from 'react';
import { CircleDot, Plus, Trash2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { RadioOptionsData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Button } from '../../../../../ui/button';
import { cn } from '../../../../../ui/utils';

export const RadioOptionsBlock: BlockDefinition = {
  type: 'radio_options',
  label: 'Radio Options',
  icon: CircleDot,
  category: 'data_entry',
  description: 'Single choice selection',
  initialData: {
    label: 'Select an option',
    options: ['Option 1', 'Option 2'],
    layout: 'vertical'
  },
  render: ({ block }) => {
    const data = block.data as RadioOptionsData;
    return (
      <div className="text-[9.5px]">
        {data.label && <div className="font-bold mb-2 text-gray-800">{data.label}</div>}
        <div className={cn(
          "flex gap-4",
          data.layout === 'vertical' ? "flex-col" : "flex-row flex-wrap"
        )}>
          {data.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div style={{ width: '3mm', height: '3mm', border: '1px solid #9ca3af', borderRadius: '50%', flexShrink: 0 }}></div>
              <span className="text-gray-700">{opt}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-xs">Label / Question</Label>
          <Input
            value={(block.data as RadioOptionsData).label}
            onChange={(e) => onChange('label', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-3">
          <Label className="text-xs">Layout</Label>
          <Select
            value={(block.data as RadioOptionsData).layout}
            onValueChange={(v) => onChange('layout', v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">Vertical</SelectItem>
              <SelectItem value="horizontal">Horizontal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-gray-200" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase text-gray-500">Options</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => {
                const newOpts = [...(block.data as RadioOptionsData).options, 'New Option'];
                onChange('options', newOpts);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {(block.data as RadioOptionsData).options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...(block.data as RadioOptionsData).options];
                    newOpts[idx] = e.target.value;
                    onChange('options', newOpts);
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-red-400 hover:text-red-500"
                  onClick={() => {
                    const newOpts = [...(block.data as RadioOptionsData).options];
                    newOpts.splice(idx, 1);
                    onChange('options', newOpts);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
};