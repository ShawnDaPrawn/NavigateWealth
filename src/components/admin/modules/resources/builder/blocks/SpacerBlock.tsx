import React from 'react';
import { SeparatorHorizontal } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { SpacerData } from '../types';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Switch } from '../../../../../ui/switch';

export const SpacerBlock: BlockDefinition = {
  type: 'spacer',
  label: 'Spacer/Divider',
  icon: SeparatorHorizontal,
  category: 'layout',
  description: 'Layout control',
  initialData: {
    height: '10mm',
    showLine: false
  },
  render: ({ block }) => {
    const data = block.data as SpacerData;
    const height = data.height || '10mm';
    return (
      <div style={{ height }} className="w-full flex items-center justify-center relative group">
         {data.showLine && <div className="w-full border-b border-gray-300"></div>}
         <div className="absolute inset-0 border border-dashed border-gray-200 opacity-0 group-hover:opacity-100 pointer-events-none flex items-center justify-center">
            <span className="text-[9px] text-gray-400 bg-white px-1">Spacer: {height}</span>
         </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Height</Label>
             <Select 
                value={(block.data as SpacerData).height || '10mm'} 
                onValueChange={(v) => onChange('height', v)}
             >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="5mm">5mm (Small)</SelectItem>
                   <SelectItem value="10mm">10mm (Medium)</SelectItem>
                   <SelectItem value="20mm">20mm (Large)</SelectItem>
                   <SelectItem value="40mm">40mm (Extra Large)</SelectItem>
                   <SelectItem value="1px">1px (Line Only)</SelectItem>
                </SelectContent>
             </Select>
          </div>
          <div className="flex items-center justify-between border p-3 rounded-md">
             <Label className="text-xs">Show Horizontal Line</Label>
             <Switch 
                checked={(block.data as SpacerData).showLine ?? false}
                onCheckedChange={(c) => onChange('showLine', c)}
             />
          </div>
       </div>
    );
  }
};
