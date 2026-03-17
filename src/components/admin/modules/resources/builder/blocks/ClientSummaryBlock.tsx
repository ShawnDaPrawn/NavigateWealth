import React from 'react';
import { User } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { ClientSummaryData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';

export const ClientSummaryBlock: BlockDefinition = {
  type: 'client_summary',
  label: 'Client Summary',
  icon: User,
  category: 'client_data',
  description: 'Auto-filled client details',
  initialData: {
    title: 'Client Details'
  },
  render: ({ block }) => {
    const data = block.data as ClientSummaryData;
    return (
      <div className="border border-gray-200 rounded p-4 bg-gray-50/50">
        <div className="font-bold text-[10px] mb-3 text-purple-800 uppercase tracking-wider border-b border-gray-200 pb-1">
          {data.title || "Client Details"}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[9.5px]">
          {[
            { l: 'Full Name', v: '{{client.firstName}} {{client.lastName}}' },
            { l: 'ID Number', v: '{{client.idNumber}}' },
            { l: 'Email', v: '{{client.email}}' },
            { l: 'Address', v: '{{client.address}}' }
          ].map((item, i) => (
            <div key={i}>
              <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-0.5">{item.l}</div>
              <div className="font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
                 <span className="text-blue-600 font-mono bg-blue-50/50 px-1 rounded">{item.v}</span>
              </div>
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
             <Label className="text-xs">Title</Label>
             <Input 
                value={(block.data as ClientSummaryData).title || ''}
                onChange={(e) => onChange('title', e.target.value)}
             />
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
             Values are automatically populated from the client's profile during generation.
          </div>
       </div>
    );
  }
};