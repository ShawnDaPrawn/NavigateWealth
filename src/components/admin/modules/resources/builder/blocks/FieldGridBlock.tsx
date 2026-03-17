import React from 'react';
import { Grid3x3, Plus, Trash2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { FieldGridData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Button } from '../../../../../ui/button';
import { KeySelector } from '../components/KeySelector';

export const FieldGridBlock: BlockDefinition = {
  type: 'field_grid',
  label: 'Field Grid',
  icon: Grid3x3,
  category: 'data_entry',
  description: 'Label-Input pairs',
  initialData: {
    columns: 2,
    fields: [{ label: 'First Name' }, { label: 'Last Name' }]
  },
  render: ({ block }) => {
    const data = block.data as FieldGridData;
    const gridCols = data.columns === 3 ? 'grid-cols-3' : data.columns === 4 ? 'grid-cols-4' : 'grid-cols-2';
    return (
        <div className={`grid ${gridCols} gap-4`}>
            {data.fields.map((field, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="font-bold text-[9px] bg-gray-50 p-1 border border-gray-200">{field.label}</div>
                    <div className="min-h-8 border border-gray-200 p-1 text-[9.5px]">
                        {field.key ? (
                            <span className="text-purple-600 font-mono text-[8.5px] bg-purple-50 px-1 rounded">{`{{${field.key}}}`}</span>
                        ) : ''}
                    </div>
                </div>
            ))}
        </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
      <div className="contents">
        <div className="space-y-2">
          <Label className="text-xs">Columns</Label>
          <Select 
            value={String((block.data as FieldGridData).columns)} 
            onValueChange={(v) => onChange('columns', parseInt(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
              <SelectItem value="4">4 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-3">
          <Label className="text-xs">Fields</Label>
          {(block.data as FieldGridData).fields.map((field, idx) => (
            <div key={idx} className="flex flex-col gap-2 p-2 border rounded-md bg-gray-50">
              <div className="flex gap-2">
                <Input 
                  value={field.label} 
                  onChange={(e) => {
                    const newFields = [...(block.data as FieldGridData).fields];
                    newFields[idx] = { ...newFields[idx], label: e.target.value };
                    // Auto-generate key if empty
                    if (!newFields[idx].key) {
                        newFields[idx].key = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    }
                    onChange('fields', newFields);
                  }}
                  placeholder="Label"
                  className="flex-1 h-8 text-xs"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 shrink-0 text-red-400 hover:text-red-500"
                  onClick={() => {
                    const newFields = [...(block.data as FieldGridData).fields];
                    newFields.splice(idx, 1);
                    onChange('fields', newFields);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                 <KeySelector 
                  value={field.key || ''} 
                  onChange={(val) => {
                    const newFields = [...(block.data as FieldGridData).fields];
                    newFields[idx] = { ...newFields[idx], key: val };
                    onChange('fields', newFields);
                  }}
                  placeholder="Select Variable Key..."
                  className="flex-1 h-7 text-[10px]"
                />
                <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        id={`req-${idx}`}
                        checked={field.required || false}
                        onChange={(e) => {
                            const newFields = [...(block.data as FieldGridData).fields];
                            newFields[idx] = { ...newFields[idx], required: e.target.checked };
                            onChange('fields', newFields);
                        }}
                        className="h-3 w-3"
                    />
                    <label htmlFor={`req-${idx}`} className="text-[10px]">Req.</label>
                </div>
              </div>
            </div>
          ))}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => {
              const newFields = [...(block.data as FieldGridData).fields, { label: 'New Field' }];
              onChange('fields', newFields);
            }}
          >
            <Plus className="h-3 w-3 mr-2" /> Add Field
          </Button>
        </div>
      </div>
    );
  }
};