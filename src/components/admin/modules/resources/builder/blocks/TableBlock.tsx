import React from 'react';
import { Grid, Plus, Trash2, GripVertical, Settings2 } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { TableData, TableRow, TableCell } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Button } from '../../../../../ui/button';
import { Switch } from '../../../../../ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../../ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../ui/tabs";
import { Badge } from '../../../../../ui/badge';

const CLIENT_FIELDS = [
    // Personal Information
    { label: 'Title', value: 'personalInformation.title' },
    { label: 'First Name', value: 'personalInformation.firstName' },
    { label: 'Middle Name', value: 'personalInformation.middleName' },
    { label: 'Surname', value: 'personalInformation.lastName' },
    { label: 'Date of Birth', value: 'personalInformation.dateOfBirth' },
    { label: 'ID Country', value: 'personalInformation.idCountry' },
    { label: 'ID Number', value: 'personalInformation.idNumber' },
    { label: 'Passport Country', value: 'personalInformation.passportCountry' },
    { label: 'Passport Number', value: 'personalInformation.passportNumber' },
    { label: 'Tax Number', value: 'personalInformation.taxNumber' },
    { label: 'Country of Employment', value: 'personalInformation.employmentCountry' },
    { label: 'Work Permit Number', value: 'personalInformation.workPermitNumber' },
    { label: 'Nationality', value: 'personalInformation.nationality' },
    { label: 'Gender', value: 'personalInformation.gender' },
    { label: 'Marital Status', value: 'personalInformation.maritalStatus' },
    { label: 'Marital Regime', value: 'personalInformation.maritalRegime' },
    
    // Contact Details
    { label: 'Email', value: 'personalInformation.email' },
    { label: 'Secondary Email', value: 'personalInformation.secondaryEmail' },
    { label: 'Cellphone', value: 'personalInformation.cellphone' },
    { label: 'Alternative Phone', value: 'personalInformation.alternativePhone' },
    { label: 'Preferred Contact Method', value: 'personalInformation.preferredContactMethod' },

    // Physical Address
    { label: 'Physical Address Line 1', value: 'address.physicalLine1' },
    { label: 'Physical Address Line 2', value: 'address.physicalLine2' },
    { label: 'Physical Suburb', value: 'address.physicalSuburb' },
    { label: 'Physical City', value: 'address.physicalCity' },
    { label: 'Physical Province', value: 'address.physicalProvince' },
    { label: 'Physical Code', value: 'address.physicalCode' },
    { label: 'Physical Country', value: 'address.physicalCountry' },

    // Work Address
    { label: 'Work Address Line 1', value: 'address.workLine1' },
    { label: 'Work Address Line 2', value: 'address.workLine2' },
    { label: 'Work Suburb', value: 'address.workSuburb' },
    { label: 'Work City', value: 'address.workCity' },
    { label: 'Work Province', value: 'address.workProvince' },
    { label: 'Work Code', value: 'address.workCode' },
    { label: 'Work Country', value: 'address.workCountry' },

    // Employment
    { label: 'Employer', value: 'employment.employerName' },
    { label: 'Occupation', value: 'employment.occupation' },
    { label: 'Employment Status', value: 'employment.status' },
    { label: 'Gross Income', value: 'employment.grossIncome' },
    { label: 'Net Income', value: 'employment.netIncome' },

    // Emergency Contact
    { label: 'Emergency Contact Name', value: 'emergencyContact.name' },
    { label: 'Emergency Contact Relationship', value: 'emergencyContact.relationship' },
    { label: 'Emergency Contact Phone', value: 'emergencyContact.phone' },
    { label: 'Emergency Contact Email', value: 'emergencyContact.email' },

    // Banking (Primary)
    { label: 'Bank Name', value: 'banking.bankName' },
    { label: 'Account Number', value: 'banking.accountNumber' },
    { label: 'Branch Code', value: 'banking.branchCode' },
    { label: 'Account Type', value: 'banking.accountType' },
    { label: 'Account Holder', value: 'banking.accountHolderName' },
];

const createEmptyCell = (): TableCell => ({ type: 'static', value: '' });

export const TableBlock: BlockDefinition = {
  type: 'table',
  label: 'Data Table',
  icon: Grid,
  category: 'tables',
  description: 'Structured data rows',
  initialData: {
    hasColumnHeaders: true,
    hasRowHeaders: false,
    columnHeaders: ['Column 1', 'Column 2'],
    rowHeaders: ['Row 1', 'Row 2'],
    rows: [
      { id: 'r1', cells: [{ type: 'static', value: '' }, { type: 'static', value: '' }] },
      { id: 'r2', cells: [{ type: 'static', value: '' }, { type: 'static', value: '' }] }
    ]
  },
  render: ({ block }) => {
    const data = block.data as TableData;
    return (
        <div className="w-full border border-gray-300 rounded-sm bg-white">
            <table className="w-full table-fixed text-[9.5px] border-collapse">
                {data.hasColumnHeaders && (
                    <thead>
                        <tr>
                            {data.hasRowHeaders && <th className="bg-gray-50 border border-gray-200 p-1 w-24"></th>}
                            {data.columnHeaders.map((header, i) => (
                                <th key={i} className="bg-gray-100 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-left align-top break-words">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {data.rows.map((row, rowIndex) => (
                        <tr key={row.id}>
                            {data.hasRowHeaders && (
                                <th className="bg-gray-50 border border-gray-200 p-2 font-bold text-gray-700 text-left w-24 align-top break-words">
                                    {data.rowHeaders[rowIndex] || `Row ${rowIndex + 1}`}
                                </th>
                            )}
                            {row.cells.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border border-gray-200 px-[6px] py-[5px] text-gray-600 align-top break-words">
                                    {cell.type === 'field' ? (
                                        <span className="text-blue-600 font-mono bg-blue-50 px-1 rounded break-all">
                                            {`{{ ${cell.value} }}`}
                                        </span>
                                    ) : (
                                        cell.value || <span className="text-gray-300 italic">Empty</span>
                                    )}
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
    const data = block.data as TableData;
    const colCount = data.columnHeaders.length;

    const addColumn = () => {
      const newCols = [...data.columnHeaders, `Col ${colCount + 1}`];
      const newRows = data.rows.map(row => ({
        ...row,
        cells: [...row.cells, createEmptyCell()]
      }));
      onChange({ ...data, columnHeaders: newCols, rows: newRows });
    };

    const removeColumn = (index: number) => {
      if (colCount <= 1) return;
      const newCols = data.columnHeaders.filter((_, i) => i !== index);
      const newRows = data.rows.map(row => ({
        ...row,
        cells: row.cells.filter((_, i) => i !== index)
      }));
      onChange({ ...data, columnHeaders: newCols, rows: newRows });
    };

    const addRow = () => {
      const newRowId = Math.random().toString(36).substr(2, 9);
      const newCells = Array(colCount).fill(null).map(createEmptyCell);
      const newRows = [...data.rows, { id: newRowId, cells: newCells }];
      const newRowHeaders = [...data.rowHeaders, `Row ${data.rows.length + 1}`];
      onChange({ ...data, rows: newRows, rowHeaders: newRowHeaders });
    };

    const removeRow = (index: number) => {
      const newRows = data.rows.filter((_, i) => i !== index);
      const newRowHeaders = data.rowHeaders.filter((_, i) => i !== index);
      onChange({ ...data, rows: newRows, rowHeaders: newRowHeaders });
    };

    const updateCell = (rowIndex: number, cellIndex: number, updates: Partial<TableCell>) => {
      const newRows = [...data.rows];
      newRows[rowIndex] = {
        ...newRows[rowIndex],
        cells: newRows[rowIndex].cells.map((cell, i) => 
          i === cellIndex ? { ...cell, ...updates } : cell
        )
      };
      onChange('rows', newRows);
    };

    return (
      <Tabs defaultValue="structure" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-gray-100 p-1 rounded-md">
          <TabsTrigger value="structure" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Structure & Config</TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm">Cell Content</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Column Headers</Label>
              <Switch 
                checked={data.hasColumnHeaders}
                onCheckedChange={(c) => onChange('hasColumnHeaders', c)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Row Headers</Label>
              <Switch 
                checked={data.hasRowHeaders}
                onCheckedChange={(c) => onChange('hasRowHeaders', c)}
              />
            </div>
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <Label className="text-xs font-semibold uppercase text-gray-500">Columns ({colCount})</Label>
               <Button variant="outline" size="sm" onClick={addColumn} className="h-7 text-xs">
                 <Plus className="w-3 h-3 mr-1" /> Add
               </Button>
            </div>
            {data.hasColumnHeaders && (
              <div className="space-y-2">
                {data.columnHeaders.map((header, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      value={header}
                      onChange={(e) => {
                        const newCols = [...data.columnHeaders];
                        newCols[i] = e.target.value;
                        onChange('columnHeaders', newCols);
                      }}
                      className="h-8 text-xs"
                      placeholder={`Column ${i + 1}`}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0 text-red-400"
                      onClick={() => removeColumn(i)}
                      disabled={colCount <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-gray-200" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <Label className="text-xs font-semibold uppercase text-gray-500">Rows ({data.rows.length})</Label>
               <Button variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
                 <Plus className="w-3 h-3 mr-1" /> Add
               </Button>
            </div>
            {data.hasRowHeaders && (
              <div className="space-y-2">
                {data.rowHeaders.map((header, i) => (
                  <div key={i} className="flex gap-2">
                    <Input 
                      value={header}
                      onChange={(e) => {
                        const newHeaders = [...data.rowHeaders];
                        newHeaders[i] = e.target.value;
                        onChange('rowHeaders', newHeaders);
                      }}
                      className="h-8 text-xs"
                      placeholder={`Row ${i + 1}`}
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0 text-red-400"
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {!data.hasRowHeaders && (
               <div className="text-xs text-gray-400 italic">
                 Manage row count here. Content editing is in the "Cell Content" tab.
                 <div className="mt-2 space-y-2">
                   {data.rows.map((_, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                        <span className="text-xs font-mono">Row {i + 1}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-red-400"
                          onClick={() => removeRow(i)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                   ))}
                 </div>
               </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="content" className="pt-4">
           <Accordion type="single" collapsible className="w-full">
             {data.rows.map((row, rowIndex) => (
               <AccordionItem key={row.id} value={row.id}>
                 <AccordionTrigger className="text-xs py-2">
                    <span className="font-medium text-gray-700">
                      {data.hasRowHeaders ? (data.rowHeaders[rowIndex] || `Row ${rowIndex + 1}`) : `Row ${rowIndex + 1}`}
                    </span>
                 </AccordionTrigger>
                 <AccordionContent className="space-y-4 pt-2">
                    {row.cells.map((cell, cellIndex) => (
                      <div key={cellIndex} className="bg-gray-50 p-3 rounded-md border border-gray-100 space-y-2">
                         <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-gray-500 font-bold">
                              {data.columnHeaders[cellIndex] || `Column ${cellIndex + 1}`}
                            </Label>
                            <div className="flex gap-1">
                               <Badge 
                                  variant={cell.type === 'static' ? 'secondary' : 'outline'}
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => updateCell(rowIndex, cellIndex, { type: 'static' })}
                               >
                                  Text
                               </Badge>
                               <Badge 
                                  variant={cell.type === 'field' ? 'secondary' : 'outline'}
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => updateCell(rowIndex, cellIndex, { type: 'field' })}
                               >
                                  Field
                               </Badge>
                            </div>
                         </div>
                         
                         {cell.type === 'static' ? (
                            <Input 
                               value={cell.value}
                               onChange={(e) => updateCell(rowIndex, cellIndex, { value: e.target.value })}
                               className="h-8 text-xs bg-white"
                               placeholder="Cell Value"
                            />
                         ) : (
                            <div className="space-y-2">
                                <Select 
                                    onValueChange={(val) => updateCell(rowIndex, cellIndex, { value: val })} 
                                    value={CLIENT_FIELDS.some(f => f.value === cell.value) ? cell.value : ''}
                                >
                                    <SelectTrigger className="h-8 text-xs w-full">
                                        <SelectValue placeholder="Select Field..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CLIENT_FIELDS.map(f => (
                                            <SelectItem key={f.value} value={f.value} className="text-xs">
                                                {f.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="relative">
                                   <span className="absolute left-2 top-2 text-xs text-blue-500 font-mono">{'{{'}</span>
                                   <Input 
                                      value={cell.value}
                                      onChange={(e) => updateCell(rowIndex, cellIndex, { value: e.target.value })}
                                      className="h-8 text-xs bg-white pl-6 font-mono text-blue-600"
                                      placeholder="or type custom key"
                                   />
                                   <span className="absolute right-2 top-2 text-xs text-blue-500 font-mono">{'}}'}</span>
                                </div>
                            </div>
                         )}
                      </div>
                    ))}
                 </AccordionContent>
               </AccordionItem>
             ))}
           </Accordion>
        </TabsContent>
      </Tabs>
    );
  }
};