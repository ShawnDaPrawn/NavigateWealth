import React from 'react';
import DOMPurify from 'dompurify';
import { FormBlock, FieldGridItem, RepeaterColumn } from './types';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { Textarea } from '../../../../ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { cn } from '../../../../ui/utils';
import { AlertCircle, Info, Hand, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../ui/button';

interface InteractiveFormRendererProps {
  blocks: FormBlock[];
  responses: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
}

export const InteractiveFormRenderer = ({ 
  blocks, 
  responses, 
  onChange,
  readOnly = false
}: InteractiveFormRendererProps) => {

  const renderBlock = (block: FormBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div 
            className="prose max-w-none mb-4 text-sm text-gray-700"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.data.content) }} 
          />
        );

      case 'section_header':
        return (
          <div className="mt-8 mb-4 pb-2 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {block.data.number && <span className="mr-2 text-gray-500">{block.data.number}</span>}
              {block.data.title}
            </h3>
          </div>
        );

      case 'field_grid':
        const gridClass = block.data.columns === 3 ? 'grid-cols-1 md:grid-cols-3' : 
                         block.data.columns === 4 ? 'grid-cols-1 md:grid-cols-4' : 
                         'grid-cols-1 md:grid-cols-2';
        
        return (
          <div className={`grid ${gridClass} gap-6 mb-6`}>
            {block.data.fields.map((field: FieldGridItem, idx: number) => {
               const fieldKey = field.key || `field_${block.id}_${idx}`;
               
               return (
                 <div key={idx} className="space-y-2">
                   <Label className="text-sm font-medium text-gray-700">
                     {field.label}
                     {field.required && <span className="text-red-500 ml-1">*</span>}
                   </Label>
                   <Input 
                     value={responses[fieldKey] || ''}
                     onChange={(e) => onChange(fieldKey, e.target.value)}
                     placeholder={field.placeholder}
                     disabled={readOnly}
                     required={field.required}
                   />
                 </div>
               );
            })}
          </div>
        );

      case 'radio_options':
        const radioKey = (block.data.key as string) || `radio_${block.id}`;
        return (
            <div className="mb-6 space-y-3">
                <Label className="text-base font-semibold text-gray-900">{block.data.label}</Label>
                <RadioGroup 
                    value={responses[radioKey]} 
                    onValueChange={(val) => onChange(radioKey, val)}
                    disabled={readOnly}
                    className={cn("gap-3", block.data.layout === 'horizontal' ? "flex flex-wrap" : "flex flex-col")}
                >
                    {block.data.options?.map((opt: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt} id={`${block.id}-${idx}`} />
                            <Label htmlFor={`${block.id}-${idx}`} className="font-normal">{opt}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>
        );

      case 'checkbox_table':
        // A table where columns are options and rows are items/questions
        // e.g. Row: "Product A", Cols: ["Invest", "Divest", "Hold"]
        return (
            <div className="mb-6 overflow-hidden rounded-md border border-gray-200">
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead className="w-[40%]">Item</TableHead>
                            {block.data.columns?.map((col: string, idx: number) => (
                                <TableHead key={idx} className="text-center">{col}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {block.data.rows?.map((row: string, rowIdx: number) => (
                            <TableRow key={rowIdx}>
                                <TableCell className="font-medium">{row}</TableCell>
                                {block.data.columns?.map((col: string, colIdx: number) => {
                                    // Key strategy: table_blockId_rowIdx_colIdx or table_blockId_rowIdx (value = col)
                                    // Let's use boolean for each cell: table_blockId_row_col
                                    const cellKey = `chk_${block.id}_${rowIdx}_${colIdx}`;
                                    return (
                                        <TableCell key={colIdx} className="text-center">
                                            <Checkbox 
                                                checked={responses[cellKey] || false}
                                                onCheckedChange={(c) => onChange(cellKey, c)}
                                                disabled={readOnly}
                                            />
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );

      case 'compliance_question':
        const compKey = (block.data.key as string) || `comp_${block.id}`;
        const detailsKey = `${compKey}_details`;
        
        return (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-indigo-600 mt-0.5" />
                    <div className="flex-1 space-y-3">
                        <Label className="text-base font-medium text-slate-900 block">
                            {block.data.question}
                        </Label>
                        <RadioGroup 
                            value={responses[compKey]} 
                            onValueChange={(val) => onChange(compKey, val)}
                            disabled={readOnly}
                            className="flex gap-6"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Yes" id={`${block.id}-yes`} />
                                <Label htmlFor={`${block.id}-yes`}>Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="No" id={`${block.id}-no`} />
                                <Label htmlFor={`${block.id}-no`}>No</Label>
                            </div>
                        </RadioGroup>

                        {block.data.showDetails && (
                            <div className="pt-2">
                                <Label className="text-sm text-slate-600 mb-1 block">
                                    {block.data.detailsLabel || "Please provide details:"}
                                </Label>
                                <Textarea 
                                    value={responses[detailsKey] || ''}
                                    onChange={(e) => onChange(detailsKey, e.target.value)}
                                    disabled={readOnly}
                                    className="bg-white"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );

      case 'signature':
        return (
            <div className="mb-8 space-y-6">
                {block.data.signatories?.map((sig: { label: string; key: string }, idx: number) => {
                    const sigKey = sig.key || `sig_${block.id}_${idx}`;
                    return (
                        <div key={idx} className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50">
                            <Label className="mb-2 block font-semibold text-gray-900">{sig.label}</Label>
                            <div className="h-32 bg-white border border-gray-200 rounded flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors relative">
                                {responses[sigKey] ? (
                                    <div className="text-center">
                                        <p className="font-handwriting text-2xl text-indigo-900">{responses[sigKey]}</p>
                                        <p className="text-xs text-gray-400 mt-1">Digitally Signed on {new Date().toLocaleDateString()}</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400" onClick={() => !readOnly && onChange(sigKey, prompt("Type your full name to sign:"))}>
                                        <Hand className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <span className="text-sm">Click to Sign</span>
                                    </div>
                                )}
                            </div>
                            {block.data.showDate && (
                                <div className="mt-2 text-xs text-gray-500 text-right">
                                    Date: {new Date().toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );

      case 'instructional_callout':
        const colors = {
            info: "bg-blue-50 border-blue-200 text-blue-800",
            warning: "bg-amber-50 border-amber-200 text-amber-800",
            stop: "bg-red-50 border-red-200 text-red-800"
        };
        const icons = {
            info: Info,
            warning: AlertCircle,
            stop: AlertCircle
        };
        const Icon = icons[block.data.type as keyof typeof icons] || Info;
        
        return (
            <div className={cn("mb-6 p-4 rounded-md border flex gap-3", colors[block.data.type as keyof typeof colors] || colors.info)}>
                <Icon className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">{block.data.text}</p>
            </div>
        );
        
      case 'spacer':
        return <div style={{ height: block.data.height || '20px' }}></div>;

      case 'page_break':
        return <hr className="my-8 border-t-2 border-dashed border-gray-200" />;

      case 'container': {
        // Conditional container — in interactive mode, evaluate condition and render children
        const containerBlocks: FormBlock[] = block.data.blocks || [];
        const condVar = block.data.conditionVariable;
        const condVal = block.data.conditionValue;
        const condOp = block.data.conditionOperator || 'equals';

        // Evaluate condition against current responses
        const actualValue = condVar ? responses[condVar] : undefined;
        let conditionMet = false;
        switch (condOp) {
          case 'equals':
            conditionMet = String(actualValue) === String(condVal);
            break;
          case 'not_equals':
            conditionMet = String(actualValue) !== String(condVal);
            break;
          case 'exists':
            conditionMet = actualValue !== undefined && actualValue !== null && actualValue !== '';
            break;
          case 'not_exists':
            conditionMet = actualValue === undefined || actualValue === null || actualValue === '';
            break;
          default:
            conditionMet = true;
        }

        if (!conditionMet) return null;

        return (
          <div className="space-y-2">
            {containerBlocks.map((child) => (
              <div key={child.id} id={`block-${child.id}`}>
                {renderBlock(child)}
              </div>
            ))}
          </div>
        );
      }

      case 'repeater': {
        // Repeater — iterate over array data in responses
        const repData = block.data;
        const items: Record<string, unknown>[] = (responses[repData.variableName] as Record<string, unknown>[]) || [];
        const columns: RepeaterColumn[] = (repData.columns as RepeaterColumn[]) || [];
        const isUserPopulated = !!repData.userPopulated;

        // -- Handlers for user-populated mode --
        const addRow = () => {
          // Create an empty row with all column keys
          const newRow: Record<string, string> = {};
          columns.forEach((col: RepeaterColumn) => {
            newRow[col.key] = '';
          });
          onChange(repData.variableName, [...items, newRow]);
        };

        const updateCell = (rowIndex: number, colKey: string, value: string) => {
          const updatedItems = items.map((item: Record<string, unknown>, i: number) =>
            i === rowIndex ? { ...item, [colKey]: value } : item
          );
          onChange(repData.variableName, updatedItems);
        };

        const removeRow = (rowIndex: number) => {
          onChange(
            repData.variableName,
            items.filter((_: Record<string, unknown>, i: number) => i !== rowIndex)
          );
        };

        return (
          <div className="mb-6">
            {repData.title && (
              <h4 className="font-semibold text-sm text-gray-900 mb-2">{repData.title}</h4>
            )}

            {items.length === 0 && !isUserPopulated ? (
              <p className="text-sm text-gray-500 italic py-4 text-center border border-dashed border-gray-200 rounded">
                {repData.emptyMessage || 'No items'}
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {isUserPopulated && (
                        <th className="w-8 px-2 py-2 text-center text-gray-400 font-medium border-b border-gray-200">
                          #
                        </th>
                      )}
                      {columns.map((col: RepeaterColumn, ci: number) => (
                        <th
                          key={ci}
                          className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200"
                          style={{ width: col.width || 'auto' }}
                        >
                          {col.header}
                        </th>
                      ))}
                      {isUserPopulated && !readOnly && (
                        <th className="w-10 px-2 py-2 border-b border-gray-200" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: Record<string, unknown>, ri: number) => (
                      <tr
                        key={ri}
                        className={cn(
                          ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                          'group'
                        )}
                      >
                        {isUserPopulated && (
                          <td className="px-2 py-1.5 text-center text-xs text-gray-400 border-b border-gray-100">
                            {ri + 1}
                          </td>
                        )}
                        {columns.map((col: RepeaterColumn, ci: number) => (
                          <td
                            key={ci}
                            className="px-1.5 py-1 border-b border-gray-100"
                          >
                            {isUserPopulated && !readOnly ? (
                              <Input
                                value={item[col.key] ?? ''}
                                onChange={(e) => updateCell(ri, col.key, e.target.value)}
                                placeholder={col.header}
                                className="h-8 text-sm border-transparent hover:border-gray-200 focus:border-indigo-300 bg-transparent"
                              />
                            ) : (
                              <span className="px-1.5 py-1 text-gray-700">
                                {item[col.key] ?? ''}
                              </span>
                            )}
                          </td>
                        ))}
                        {isUserPopulated && !readOnly && (
                          <td className="px-2 py-1 border-b border-gray-100 text-center">
                            <button
                              onClick={() => removeRow(ri)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                              title="Remove row"
                              aria-label={`Remove row ${ri + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Empty state for user-populated mode */}
                    {items.length === 0 && isUserPopulated && (
                      <tr>
                        <td
                          colSpan={columns.length + 2}
                          className="py-6 text-center text-sm text-gray-400 italic"
                        >
                          {repData.emptyMessage || 'No items yet — click "Add Row" below'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add Row button — only for user-populated, non-read-only */}
            {isUserPopulated && !readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="mt-2 w-full text-xs h-8 border-dashed border-gray-300 text-gray-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Row
              </Button>
            )}
          </div>
        );
      }

      default:
        // Fallback for visual-only blocks or unimplemented ones
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <div key={block.id} id={`block-${block.id}`}>
          {renderBlock(block)}
        </div>
      ))}
    </div>
  );
};