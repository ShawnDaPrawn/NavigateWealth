import { FileText } from 'lucide-react';

import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../ui/dialog';
import { ProductField } from '../types';
import { formatCurrency } from '../../../../../utils/currencyFormatter';

interface SchemaLivePreviewProps {
  currentFields: ProductField[];
  selectedCategoryName?: string;
}

// -- Note Modal Component --
const PreviewNoteModal = ({ title, content }: { title: string; content: string }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-full hover:bg-purple-100 text-purple-600"
          aria-label="Preview form schema"
        >
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            {title}
          </DialogTitle>
          <DialogDescription>Preview of the note content.</DialogDescription>
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
      case 'text':
        return `Sample ${field.name}`;
      case 'number':
        return rowIndex === 0 ? '1' : '5';
      case 'percentage':
        return rowIndex === 0 ? '5.5%' : '12%';
      case 'date':
        return '2024-03-15';
      case 'date_inception':
        return '2020-01-01';
      case 'boolean':
        return rowIndex === 0 ? 'Yes' : 'No';
      case 'dropdown':
        return field.options?.[rowIndex % (field.options?.length || 1)] || 'Option 1';
      case 'file_upload':
        return 'document.pdf';
      case 'long_text':
        return 'This is a sample note content that is too long to display in the column cell directly. It requires a modal view to be readable.';
      default:
        return '-';
    }
  };

  const rows = [
    { provider: 'Discovery', index: 0 },
    { provider: 'Old Mutual', index: 1 },
  ];

  return (
    // PM-Structure: a "Live preview" card beside the structure editor
    <aside
      className="ds-card min-w-0"
      aria-label={`${selectedCategoryName ?? 'Product'} live preview`}
    >
      <div className="ds-card-h">
        <h3>Live preview</h3>
        <span className="ds-meta">As it appears on a client profile</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-nw-line bg-[#fafafb]">
              <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-medium text-nw-text-3">
                Provider
              </th>
              {currentFields.map((field) => (
                <th
                  key={field.id}
                  className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-medium text-nw-text-3"
                >
                  {field.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-nw-line">
            {rows.map((row) => (
              <tr key={row.provider}>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-nw-ink">{row.provider}</td>
                {currentFields.map((field) => (
                  <td key={field.id} className="whitespace-nowrap px-3.5 py-2.5 text-nw-ink">
                    {field.type === 'long_text' ? (
                      <PreviewNoteModal
                        title={field.name}
                        content={getMockValue(field, row.index)}
                      />
                    ) : (
                      getMockValue(field, row.index)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
