import React from 'react';
import { PenTool } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { WitnessSignatureData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Switch } from '../../../../../ui/switch';

export const WitnessSignatureBlock: BlockDefinition = {
  type: 'witness_signature',
  label: 'Witness Signature',
  icon: PenTool,
  category: 'signatures',
  description: 'Sign + 2 Witnesses',
  initialData: {
    mainLabel: 'Signature of Client',
    showWitnesses: true
  },
  render: ({ block }) => {
    const data = block.data as WitnessSignatureData;
    return (
      <div className="mt-4 break-inside-avoid">
         <div className="flex justify-between items-end text-[9px] mb-2 text-gray-600">
            <div>Signed at ____________________</div>
            <div>on ____________________</div>
         </div>
         
         <div className="border border-gray-400 h-24 rounded-sm relative bg-gray-50/20 mb-2">
            <div className="absolute bottom-2 left-2 text-[8px] text-gray-500 uppercase">
              {data.mainLabel || "Signature of Client"}
            </div>
         </div>

         {data.showWitnesses && (
           <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <div className="border-b border-black h-8 mb-1"></div>
                <div className="text-[9px] text-gray-500">Witness 1</div>
              </div>
              <div className="flex-1">
                <div className="border-b border-black h-8 mb-1"></div>
                <div className="text-[9px] text-gray-500">Witness 2</div>
              </div>
           </div>
         )}
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Main Signatory Label</Label>
             <Input 
                value={(block.data as WitnessSignatureData).mainLabel || ''}
                onChange={(e) => onChange('mainLabel', e.target.value)}
             />
          </div>
          <div className="flex items-center justify-between border p-3 rounded-md">
             <Label className="text-xs">Include Witness Lines</Label>
             <Switch 
                checked={(block.data as WitnessSignatureData).showWitnesses ?? false}
                onCheckedChange={(c) => onChange('showWitnesses', c)}
             />
          </div>
       </div>
    );
  }
};