import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { InstructionalCalloutData } from '../types';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { cn } from '../../../../../ui/utils';

export const InstructionalCalloutBlock: BlockDefinition = {
  type: 'instructional_callout',
  label: 'Instructional Callout',
  icon: AlertTriangle,
  category: 'content',
  description: 'Warning/Info box',
  initialData: {
    text: 'Important instruction for the client.',
    type: 'info'
  },
  render: ({ block }) => {
    const data = block.data as InstructionalCalloutData;
    const type = data.type || 'info';
    const colors = type === 'stop' 
      ? 'bg-red-50 border-red-500 text-red-900' 
      : type === 'warning' 
        ? 'bg-amber-50 border-amber-500 text-amber-900' 
        : 'bg-blue-50 border-blue-500 text-blue-900';
        
    return (
      <div className={cn("border-l-4 p-3 text-[9.5px] flex gap-3 rounded-r-sm", colors)}>
         <AlertTriangle className={cn("w-4 h-4 flex-shrink-0", 
            type === 'stop' ? 'text-red-500' : type === 'warning' ? 'text-amber-500' : 'text-blue-500'
         )} />
         <div className="font-medium leading-relaxed">
           {data.text || "Important instruction for the client."}
         </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Instruction Text</Label>
             <Textarea 
                value={(block.data as InstructionalCalloutData).text || ''}
                onChange={(e) => onChange('text', e.target.value)}
                className="min-h-[100px] text-xs"
             />
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Type / Severity</Label>
             <Select 
                value={(block.data as InstructionalCalloutData).type || 'info'} 
                onValueChange={(v) => onChange('type', v)}
             >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="info">Info (Blue)</SelectItem>
                   <SelectItem value="warning">Warning (Amber)</SelectItem>
                   <SelectItem value="stop">Stop / Danger (Red)</SelectItem>
                </SelectContent>
             </Select>
          </div>
       </div>
    );
  }
};
