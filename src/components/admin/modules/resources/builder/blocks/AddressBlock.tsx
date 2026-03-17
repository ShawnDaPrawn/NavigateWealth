import React from 'react';
import { MapPin } from 'lucide-react';
import { BlockDefinition } from '../registry';

export const AddressBlock: BlockDefinition = {
  type: 'address_block',
  label: 'Address Block',
  icon: MapPin,
  category: 'client_data',
  description: 'Physical & Postal',
  initialData: {},
  render: () => {
    return (
      <div className="grid grid-cols-2 gap-8">
         <div>
            <div className="font-bold text-[9.5px] text-gray-800 mb-2 border-b border-gray-200 pb-1">Physical Address</div>
            <div className="space-y-2">
               <div>
                 <div className="text-[8px] text-gray-500 uppercase">Unit / Complex</div>
                 <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
               </div>
               <div>
                 <div className="text-[8px] text-gray-500 uppercase">Street Name & Number</div>
                 <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
               </div>
               <div className="grid grid-cols-3 gap-2">
                 <div className="col-span-2">
                    <div className="text-[8px] text-gray-500 uppercase">Suburb / City</div>
                    <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
                 </div>
                 <div>
                    <div className="text-[8px] text-gray-500 uppercase">Code</div>
                    <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
                 </div>
               </div>
            </div>
         </div>
         <div>
            <div className="flex justify-between items-end mb-2 border-b border-gray-200 pb-1">
              <div className="font-bold text-[9.5px] text-gray-800">Postal Address</div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-gray-400 rounded-sm"></div>
                <span className="text-[8px] text-gray-500">Same as Physical</span>
              </div>
            </div>
            <div className="space-y-2">
               <div>
                 <div className="text-[8px] text-gray-500 uppercase">Box / Street</div>
                 <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
               </div>
               <div className="grid grid-cols-3 gap-2">
                 <div className="col-span-2">
                    <div className="text-[8px] text-gray-500 uppercase">City / Post Office</div>
                    <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
                 </div>
                 <div>
                    <div className="text-[8px] text-gray-500 uppercase">Code</div>
                    <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
                 </div>
               </div>
            </div>
         </div>
      </div>
    );
  },
  editor: () => {
    return (
       <div className="space-y-4">
          <div className="p-3 bg-gray-50 text-gray-500 text-xs rounded">
             Standard layout for Physical & Postal addresses. Includes "Same as Physical" checkbox.
          </div>
       </div>
    );
  }
};