import React from 'react';
import { Columns } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { CombInputData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { KeySelector } from '../components/KeySelector';

export const CombInputBlock: BlockDefinition = {
  type: 'comb_input',
  label: 'Comb Input',
  icon: Columns,
  category: 'data_entry',
  description: 'Character boxes (ID/Tax)',
  initialData: {
    label: 'Identity Number',
    charCount: 13,
    value: ''
  },
  render: ({ block }) => {
    const data = block.data as CombInputData;
    const count = data.charCount || 13;
    const value = data.value || '';
    
    return (
      <div className="mb-2">
        <div className="text-[9.5px] font-bold text-gray-700 mb-1">{data.label || "Identity Number"}</div>
        <div className="flex">
           {Array.from({ length: count }).map((_, i) => (
             <div key={i} className="w-[5mm] h-[6mm] border border-gray-400 border-r-0 last:border-r flex items-center justify-center text-[10px] font-mono bg-white first:rounded-l-sm last:rounded-r-sm">
               {value[i] || ''}
             </div>
           ))}
        </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Label</Label>
             <Input 
                value={(block.data as CombInputData).label || ''}
                onChange={(e) => onChange('label', e.target.value)}
             />
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Map to Key (Optional)</Label>
             <KeySelector 
                value={(block.data as CombInputData).key || ''}
                onChange={(val) => onChange('key', val)}
                placeholder="Select variable key..."
             />
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Character Count</Label>
             <Input 
                type="number"
                value={(block.data as CombInputData).charCount || 13}
                onChange={(e) => onChange('charCount', parseInt(e.target.value))}
             />
             <p className="text-[10px] text-gray-400">Default: 13 (SA ID Number)</p>
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Pre-filled Value (Optional)</Label>
             <Input 
                value={(block.data as CombInputData).value || ''}
                onChange={(e) => onChange('value', e.target.value)}
                maxLength={(block.data as CombInputData).charCount || 13}
                className="font-mono"
             />
          </div>
       </div>
    );
  }
};