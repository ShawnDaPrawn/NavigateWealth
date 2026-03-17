import React from 'react';
import { Users, Plus, Minus } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { BeneficiaryTableData } from '../types';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';

export const BeneficiaryTableBlock: BlockDefinition = {
  type: 'beneficiary_table',
  label: 'Beneficiary Table',
  icon: Users,
  category: 'tables',
  description: 'Nomination table',
  initialData: {
    rowCount: 3
  },
  render: ({ block }) => {
    const data = block.data as BeneficiaryTableData;
    const rows = data.rowCount || 3;
    return (
      <div className="w-full border border-gray-300 rounded-sm bg-white">
        <table className="w-full text-[9.5px] border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">Surname & Initials</th>
              <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-32">ID Number</th>
              <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-24">Relationship</th>
              <th className="border border-gray-200 px-2 py-1 text-center font-bold text-gray-700 w-16">Share %</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="border border-gray-200 px-2 py-1 h-8"></td>
                <td className="border border-gray-200 px-2 py-1 h-8"></td>
                <td className="border border-gray-200 px-2 py-1 h-8"></td>
                <td className="border border-gray-200 px-2 py-1 h-8"></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold">
              <td colSpan={3} className="border border-gray-200 px-2 py-1 text-right">Total Share</td>
              <td className="border border-gray-200 px-2 py-1 text-center">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Number of Rows</Label>
             <div className="flex items-center gap-2">
                <Button 
                   variant="outline" 
                   size="icon"
                   className="h-8 w-8"
                   onClick={() => onChange('rowCount', Math.max(1, ((block.data as BeneficiaryTableData).rowCount || 3) - 1))}
                >
                   <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-sm">{ (block.data as BeneficiaryTableData).rowCount || 3 }</span>
                <Button 
                   variant="outline" 
                   size="icon"
                   className="h-8 w-8"
                   onClick={() => onChange('rowCount', Math.min(10, ((block.data as BeneficiaryTableData).rowCount || 3) + 1))}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
          </div>
       </div>
    );
  }
};