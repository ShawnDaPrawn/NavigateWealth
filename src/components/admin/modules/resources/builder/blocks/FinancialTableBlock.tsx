import React from 'react';
import { Calculator, Plus, Trash2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { FinancialTableData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Switch } from '../../../../../ui/switch';
import { Button } from '../../../../../ui/button';

export const FinancialTableBlock: BlockDefinition = {
  type: 'financial_table',
  label: 'Financial Table',
  icon: Calculator,
  category: 'tables',
  description: 'Assets/Liabilities with totals',
  initialData: {
    items: [{ description: 'Example Asset', value: '100000' }],
    currencySymbol: 'R',
    showTotal: true
  },
  render: ({ block }) => {
    const data = block.data as FinancialTableData;
    const items = data.items || [{ description: 'Example Asset', value: '100000' }];
    return (
      <div className="w-full border border-gray-300 rounded-sm bg-white">
        <table className="w-full text-[9.5px] border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">Description</th>
              <th className="border border-gray-200 px-2 py-1 text-right font-bold text-gray-700 w-32">Value ({data.currencySymbol || 'R'})</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-200 px-2 py-1">{item.description}</td>
                <td className="border border-gray-200 px-2 py-1 text-right">{item.value}</td>
              </tr>
            ))}
            {/* Empty rows filler */}
            {[1,2,3].map(i => (
              <tr key={`empty-${i}`}>
                <td className="border border-gray-200 px-2 py-1 h-6"></td>
                <td className="border border-gray-200 px-2 py-1 h-6"></td>
              </tr>
            ))}
          </tbody>
          {data.showTotal && (
            <tfoot>
              <tr className="bg-gray-50 font-bold">
                <td className="border border-gray-200 px-2 py-1 text-right">Total</td>
                <td className="border border-gray-200 px-2 py-1 text-right">0.00</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as FinancialTableData;
    return (
       <div className="space-y-6">
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="text-xs">Currency Symbol</Label>
                   <Input 
                      value={data.currencySymbol || 'R'}
                      onChange={(e) => onChange('currencySymbol', e.target.value)}
                      className="h-8 text-xs"
                   />
                </div>
                <div className="flex items-end pb-2">
                   <div className="flex items-center gap-2">
                      <Label className="text-xs">Show Total Row</Label>
                      <Switch 
                         checked={data.showTotal ?? true}
                         onCheckedChange={(c) => onChange('showTotal', c)}
                      />
                   </div>
                </div>
             </div>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-gray-500">Items</Label>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 w-6 p-0"
                   onClick={() => {
                      const newItems = [...(data.items || []), { description: 'New Item', value: '0' }];
                      onChange('items', newItems);
                   }}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
             <div className="space-y-2">
                {(data.items || []).map((item, idx) => (
                   <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                         <Input 
                            value={item.description}
                            onChange={(e) => {
                               const newItems = [...(data.items || [])];
                               newItems[idx] = { ...newItems[idx], description: e.target.value };
                               onChange('items', newItems);
                            }}
                            className="h-7 text-xs"
                            placeholder="Description"
                         />
                         <Input 
                            value={item.value}
                            onChange={(e) => {
                               const newItems = [...(data.items || [])];
                               newItems[idx] = { ...newItems[idx], value: e.target.value };
                               onChange('items', newItems);
                            }}
                            className="h-7 text-xs font-mono"
                            placeholder="Value"
                         />
                      </div>
                      <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-7 w-7 shrink-0 text-red-400 hover:text-red-500 mt-1"
                         onClick={() => {
                            const newItems = [...(data.items || [])];
                            newItems.splice(idx, 1);
                            onChange('items', newItems);
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