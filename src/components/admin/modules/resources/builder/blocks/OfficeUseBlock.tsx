import React from 'react';
import { Archive, Plus, Trash2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { OfficeUseData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';

export const OfficeUseBlock: BlockDefinition = {
  type: 'office_use',
  label: 'Office Use',
  icon: Archive,
  category: 'admin',
  description: 'Internal admin section',
  initialData: {
    title: 'Office Use Only',
    fields: ["FICA Verified", "Risk Analyzed", "Loaded on CRM", "Manager Approved"]
  },
  render: ({ block }) => {
    const data = block.data as OfficeUseData;
    return (
      <div className="border-2 border-dashed border-gray-300 bg-gray-50/50 p-4 relative mt-4 rounded">
         <div className="absolute -top-2.5 right-4 bg-white text-gray-400 text-[9px] px-2 border border-gray-200 font-bold uppercase tracking-wider">
            {data.title || "Office Use Only"}
         </div>
         <div className="grid grid-cols-3 gap-4">
            {(data.fields || ["FICA Verified", "Risk Analyzed", "Loaded on CRM", "Manager Approved"]).map((field, i) => (
              <div key={i} className="flex items-center gap-2">
                 <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', background: 'white' }}></div>
                 <span className="text-[9px] text-gray-600 font-medium">{field}</span>
              </div>
            ))}
         </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as OfficeUseData;
    const fields = data.fields || ["FICA Verified", "Risk Analyzed", "Loaded on CRM", "Manager Approved"];

    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Section Title</Label>
             <Input 
                value={data.title || ''}
                onChange={(e) => onChange('title', e.target.value)}
             />
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-gray-500">Checkboxes</Label>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 w-6 p-0"
                   onClick={() => {
                      const newFields = [...fields, 'New Item'];
                      onChange('fields', newFields);
                   }}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
             <div className="space-y-2">
                {fields.map((field, idx) => (
                   <div key={idx} className="flex gap-2">
                      <Input 
                         value={field}
                         onChange={(e) => {
                            const newFields = [...fields];
                            newFields[idx] = e.target.value;
                            onChange('fields', newFields);
                         }}
                         className="h-8 text-xs"
                      />
                      <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-8 w-8 shrink-0 text-red-400 hover:text-red-500"
                         onClick={() => {
                            const newFields = [...fields];
                            newFields.splice(idx, 1);
                            onChange('fields', newFields);
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