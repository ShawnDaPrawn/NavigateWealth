import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { ComplianceQuestionData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { Switch } from '../../../../../ui/switch';

export const ComplianceQuestionBlock: BlockDefinition = {
  type: 'compliance_question',
  label: 'Compliance Question',
  icon: ShieldCheck,
  category: 'compliance',
  description: 'Question + Yes/No + Details',
  initialData: {
    question: 'New Compliance Question',
    showDetails: false,
    detailsLabel: 'If Yes, provide details:'
  },
  render: ({ block }) => {
    const data = block.data as ComplianceQuestionData;
    return (
      <div className="mb-2">
        <div className="flex justify-between items-start gap-4">
           <div className="flex-1 text-[9.5px] font-medium leading-normal text-gray-800">
             {data.question || "New Compliance Question"}
           </div>
           <div className="flex gap-4 flex-shrink-0 ml-4">
              <div className="flex items-center gap-1.5">
                <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px' }}></div>
                <span className="text-[9px]">Yes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px' }}></div>
                <span className="text-[9px]">No</span>
              </div>
           </div>
        </div>
        {data.showDetails && (
           <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-100">
              <div className="text-[8px] text-gray-500 uppercase mb-1">{data.detailsLabel || "If Yes, provide details:"}</div>
              <div className="border-b border-gray-300 h-5 mb-1 bg-gray-50/30"></div>
              <div className="border-b border-gray-300 h-5 bg-gray-50/30"></div>
           </div>
        )}
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as ComplianceQuestionData;
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Question Text</Label>
             <Textarea 
                value={data.question || ''}
                onChange={(e) => onChange('question', e.target.value)}
                className="min-h-[80px] text-xs"
             />
          </div>
          <div className="space-y-4 border rounded p-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs">Show Details Section</Label>
                <Switch 
                   checked={data.showDetails ?? false}
                   onCheckedChange={(c) => onChange('showDetails', c)}
                />
             </div>
             {data.showDetails && (
                <div className="space-y-2">
                   <Label className="text-xs">Details Label</Label>
                   <Input 
                      value={data.detailsLabel || ''}
                      onChange={(e) => onChange('detailsLabel', e.target.value)}
                      placeholder="If Yes, provide details:"
                   />
                </div>
             )}
          </div>
       </div>
    );
  }
};