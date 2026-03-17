import React from 'react';
import { PenLine } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { SignatureData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';

export const SignatureBlock: BlockDefinition = {
  type: 'signature',
  label: 'Signature',
  icon: PenLine,
  category: 'signatures',
  description: 'Signoff boxes',
  initialData: {
    signatories: [{ label: 'Client Signature' }],
    showDate: true
  },
  render: ({ block }) => {
    const data = block.data as SignatureData;
    return (
       <div className="mt-4 bg-[#eef2ff] p-4 border border-[#e0e7ff]">
          <div className="flex gap-8">
              {data.signatories.map((sig, i) => (
                   <div key={i} className="flex-1">
                      <div className="flex items-end gap-2 mb-2">
                          <span className="text-[9.5px] whitespace-nowrap">{sig.label}</span>
                          <div className="flex-1 border-b border-black h-6"></div>
                      </div>
                   </div>
              ))}
              {data.showDate && (
                   <div className="flex-1">
                      <div className="flex items-end gap-2 mb-2">
                          <span className="text-[9.5px] whitespace-nowrap">Date</span>
                          <div className="flex-1 border-b border-black h-6"></div>
                      </div>
                   </div>
              )}
          </div>
       </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-3">
         <Label className="text-xs">Signatories</Label>
         {(block.data as SignatureData).signatories.map((sig, idx) => (
           <div key={idx} className="flex gap-2">
             <Input 
               value={sig.label} 
               onChange={(e) => {
                 const newSigs = [...(block.data as SignatureData).signatories];
                 newSigs[idx] = { ...newSigs[idx], label: e.target.value };
                 onChange('signatories', newSigs);
               }}
             />
           </div>
         ))}
       </div>
    );
  }
};