import React from 'react';
import { CreditCard } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { BankDetailsData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Switch } from '../../../../../ui/switch';

export const BankDetailsBlock: BlockDefinition = {
  type: 'bank_details',
  label: 'Bank Details',
  icon: CreditCard,
  category: 'client_data',
  description: 'Debit order/Payouts',
  initialData: {
    title: 'Banking Details',
    showAuthorization: false
  },
  render: ({ block }) => {
    const data = block.data as BankDetailsData;
    return (
      <div className="border border-gray-300 rounded-sm p-4 bg-gray-50/50">
         <div className="font-bold text-[10px] uppercase tracking-wider text-gray-800 mb-3 border-b border-gray-200 pb-1">
           {data.title || "Banking Details"}
         </div>
         <div className="grid grid-cols-2 gap-4 mb-3">
           <div>
             <div className="text-[8px] text-gray-500 uppercase">Bank Name</div>
             <div className="border border-gray-300 bg-white h-7 w-full"></div>
           </div>
           <div>
             <div className="text-[8px] text-gray-500 uppercase">Branch Code</div>
             <div className="border border-gray-300 bg-white h-7 w-full"></div>
           </div>
           <div>
             <div className="text-[8px] text-gray-500 uppercase">Account Number</div>
             <div className="border border-gray-300 bg-white h-7 w-full"></div>
           </div>
           <div>
             <div className="text-[8px] text-gray-500 uppercase">Account Type</div>
             <div className="flex gap-3 mt-1.5">
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-400 rounded-full"></div><span className="text-[9px]">Current</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-400 rounded-full"></div><span className="text-[9px]">Savings</span></div>
             </div>
           </div>
         </div>
         <div>
           <div className="text-[8px] text-gray-500 uppercase">Account Holder Name</div>
           <div className="border border-gray-300 bg-white h-7 w-full"></div>
         </div>
         {data.showAuthorization && (
           <div className="mt-3 text-[8px] text-gray-500 text-justify leading-tight">
             I/We hereby authorise the Financial Services Provider to deduct the agreed amount from my/our bank account. This authority may be cancelled by me/us by giving thirty days notice in writing.
           </div>
         )}
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Title</Label>
             <Input 
                value={(block.data as BankDetailsData).title || ''}
                onChange={(e) => onChange('title', e.target.value)}
             />
          </div>
          <div className="flex items-center justify-between border p-3 rounded-md">
             <Label className="text-xs">Show Authorization Disclaimer</Label>
             <Switch 
                checked={(block.data as BankDetailsData).showAuthorization ?? false}
                onCheckedChange={(c) => onChange('showAuthorization', c)}
             />
          </div>
       </div>
    );
  }
};