import React from 'react';
import { Table as TableIcon, Plus, Trash2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { CheckboxTableData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';

export const CheckboxTableBlock: BlockDefinition = {
  type: 'checkbox_table',
  label: 'Checkbox Table',
  icon: TableIcon,
  category: 'data_entry',
  description: 'Matrix of checkboxes',
  initialData: {
    columns: ['Yes', 'No', 'N/A'],
    rows: ['Item 1', 'Item 2', 'Item 3']
  },
  render: ({ block }) => {
    const data = block.data as CheckboxTableData;
    const columns = data.columns || [];
    const rows = data.rows || [];

    return (
      <div className="w-full border border-gray-300 rounded-sm bg-white overflow-hidden">
         <table className="w-full text-[9.5px] border-collapse">
            <thead>
               <tr>
                  <th className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] w-1/3"></th>
                  {columns.map((col, i) => (
                    <th key={i} className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-center" style={{ textAlign: 'center' }}>
                       {col}
                    </th>
                  ))}
               </tr>
            </thead>
            <tbody>
               {rows.map((row, i) => (
                 <tr key={i}>
                    <td className="border border-gray-200 px-[6px] py-[5px] font-medium text-gray-700">
                       {row}
                    </td>
                    {columns.map((_, j) => (
                      <td key={j} className="border border-gray-200 px-[6px] py-[5px] text-center">
                         <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px', margin: '0 auto' }}></div>
                      </td>
                    ))}
                 </tr>
               ))}
            </tbody>
         </table>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as CheckboxTableData;
    const columns = data.columns || [];
    const rows = data.rows || [];

    return (
       <div className="space-y-6">
          {/* Columns Editor */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-gray-500">Columns</Label>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 w-6 p-0"
                   onClick={() => {
                      const newCols = [...columns, 'New Column'];
                      onChange('columns', newCols);
                   }}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
             <div className="space-y-2">
                {columns.map((col, idx) => (
                   <div key={idx} className="flex gap-2">
                      <Input 
                         value={col}
                         onChange={(e) => {
                            const newCols = [...columns];
                            newCols[idx] = e.target.value;
                            onChange('columns', newCols);
                         }}
                         className="h-8 text-xs"
                         placeholder="Column Header"
                      />
                      <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-8 w-8 shrink-0 text-red-400 hover:text-red-500"
                         onClick={() => {
                            const newCols = [...columns];
                            newCols.splice(idx, 1);
                            onChange('columns', newCols);
                         }}
                      >
                         <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                ))}
             </div>
          </div>

          <div className="h-px bg-gray-200" />

          {/* Rows Editor */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-gray-500">Rows</Label>
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 w-6 p-0"
                   onClick={() => {
                      const newRows = [...rows, 'New Row'];
                      onChange('rows', newRows);
                   }}
                >
                   <Plus className="h-4 w-4" />
                </Button>
             </div>
             <div className="space-y-2">
                {rows.map((row, idx) => (
                   <div key={idx} className="flex gap-2">
                      <Input 
                         value={row}
                         onChange={(e) => {
                            const newRows = [...rows];
                            newRows[idx] = e.target.value;
                            onChange('rows', newRows);
                         }}
                         className="h-8 text-xs"
                         placeholder="Row Label"
                      />
                      <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-8 w-8 shrink-0 text-red-400 hover:text-red-500"
                         onClick={() => {
                            const newRows = [...rows];
                            newRows.splice(idx, 1);
                            onChange('rows', newRows);
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