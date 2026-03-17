import React, { useState } from 'react';
import { Eye, Table as TableIcon, FileText } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../ui/dialog";
import { ProductField } from '../types';
import { formatCurrency } from '../../../../../utils/currencyFormatter';

interface SchemaLivePreviewProps {
  currentFields: ProductField[];
  selectedCategoryName?: string;
}

// -- Note Modal Component --
const PreviewNoteModal = ({ title, content }: { title: string, content: string }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-purple-100 text-purple-600" aria-label="Preview form schema">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Preview of the note content.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 p-4 bg-gray-50 rounded-md border border-gray-100 text-sm text-gray-700 leading-relaxed min-h-[100px]">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function SchemaLivePreview({ currentFields, selectedCategoryName }: SchemaLivePreviewProps) {
  // Mock Data Generator for Preview
  const getMockValue = (field: ProductField, rowIndex: number) => {
    if (field.type === 'currency') {
      return formatCurrency(rowIndex === 0 ? 15000 : 2500000);
    }
    
    if (field.name.toLowerCase().includes('policy number')) {
      return rowIndex === 0 ? 'POL-8849231' : 'POL-9921002';
    }

    if (field.name.toLowerCase().includes('provider')) {
      return rowIndex === 0 ? 'Discovery' : 'Old Mutual';
    }

    switch (field.type) {
      case 'text': return `Sample ${field.name}`;
      case 'number': return rowIndex === 0 ? '1' : '5';
      case 'percentage': return rowIndex === 0 ? '5.5%' : '12%';
      case 'date': return '2024-03-15';
      case 'date_inception': return '2020-01-01';
      case 'boolean': return rowIndex === 0 ? 'Yes' : 'No';
      case 'dropdown': return field.options?.[rowIndex % (field.options?.length || 1)] || 'Option 1';
      case 'file_upload': return 'document.pdf';
      case 'long_text': return 'This is a sample note content that is too long to display in the column cell directly. It requires a modal view to be readable.';
      default: return '-';
    }
  };

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-2 px-1">
          <div className="p-1.5 bg-blue-100 rounded text-blue-600">
            <Eye className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Live User Preview</h3>
          <span className="text-xs text-gray-500">- This is how the table will appear in the user profile</span>
       </div>
       
       <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <TableIcon className="h-5 w-5 text-[#6d28d9]" />
                {selectedCategoryName} Policies
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                Your active {selectedCategoryName?.toLowerCase()} policies
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[#6d28d9] border-[#6d28d9]">
              2 Policies
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {/* Provider is standard */}
                  <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-600 whitespace-nowrap">Provider</th>
                  {/* Dynamic Columns */}
                  {currentFields.map((field) => (
                    <th key={field.id} className="px-4 py-3 text-left text-[12px] font-medium text-gray-600 whitespace-nowrap">
                      {field.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Mock Row 1 */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-[11px] text-gray-900 whitespace-nowrap">Discovery</td>
                  {currentFields.map((field) => (
                    <td key={field.id} className="px-4 py-4 text-[11px] text-gray-900 whitespace-nowrap">
                       {field.type === 'long_text' ? (
                         <PreviewNoteModal title={field.name} content={getMockValue(field, 0)} />
                       ) : (
                         getMockValue(field, 0)
                       )}
                    </td>
                  ))}
                </tr>
                {/* Mock Row 2 */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-[11px] text-gray-900 whitespace-nowrap">Old Mutual</td>
                  {currentFields.map((field) => (
                    <td key={field.id} className="px-4 py-4 text-[11px] text-gray-900 whitespace-nowrap">
                       {field.type === 'long_text' ? (
                         <PreviewNoteModal title={field.name} content={getMockValue(field, 1)} />
                       ) : (
                         getMockValue(field, 1)
                       )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
       </Card>
    </div>
  );
}