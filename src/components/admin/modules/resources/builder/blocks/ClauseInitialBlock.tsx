import React from 'react';
import { PenLine } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { ClauseInitialData } from '../types';
import { Textarea } from '../../../../../ui/textarea';
import { Label } from '../../../../../ui/label';

export const ClauseInitialBlock: BlockDefinition = {
  type: 'clause_initial',
  label: 'Clause Initial',
  icon: PenLine,
  category: 'signatures',
  description: 'Text with initial box',
  initialData: {
    text: 'I acknowledge that I have read and understood the terms and conditions set out in this agreement.'
  },
  render: ({ block }) => {
    const data = block.data as ClauseInitialData;
    return (
      <div className="flex gap-4 items-stretch">
         <div className="flex-1 text-[9.5px] text-justify leading-relaxed">
           {data.text || "I acknowledge that I have read and understood the terms and conditions set out in this agreement."}
         </div>
         <div className="w-[18mm] flex-shrink-0 border border-gray-400 rounded-sm flex flex-col justify-end items-center p-1 bg-white min-h-[12mm]">
            <span className="text-[7px] text-gray-400 uppercase tracking-tighter">Initial</span>
         </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as ClauseInitialData;
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Clause Text</Label>
             <Textarea 
                value={data.text || ''}
                onChange={(e) => onChange('text', e.target.value)}
                className="min-h-[100px] text-xs"
             />
          </div>
       </div>
    );
  }
};