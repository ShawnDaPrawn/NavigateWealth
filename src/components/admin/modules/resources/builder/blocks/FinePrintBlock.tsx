import React from 'react';
import DOMPurify from 'dompurify';
import { Columns } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { FinePrintData } from '../types';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { RichTextEditor } from '../components/RichTextEditor';

// ============================================================================
// FinePrintBlock — multi-column small text, typically for legal disclaimers,
// terms and conditions, or regulatory disclosures.
//
// Uses the shared RichTextEditor for WYSIWYG content editing with data
// variable support, replacing the previous raw textarea.
// ============================================================================

export const FinePrintBlock: BlockDefinition = {
  type: 'fine_print',
  label: 'Fine Print',
  icon: Columns,
  category: 'content',
  description: 'Multi-column small text',
  initialData: {
    columns: 2,
    content: '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>',
  },

  // ==========================================================================
  // CANVAS RENDER — multi-column layout with small text
  // ==========================================================================
  render: ({ block }) => {
    const data = block.data as FinePrintData;
    return (
      <div
        style={{
          columnCount: data.columns || 2,
          columnGap: '6mm',
          fontSize: '8px',
          textAlign: 'justify',
          color: '#4b5563',
          lineHeight: '1.4',
        }}
      >
        {data.content ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }} />
        ) : (
          <div className="contents">
            <p className="mb-2">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse
              cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
              cupidatat non proident.
            </p>
          </div>
        )}
      </div>
    );
  },

  // ==========================================================================
  // EDITOR — column count selector + RichTextEditor
  // ==========================================================================
  editor: ({ block, onChange }) => {
    const data = block.data as FinePrintData;
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Number of Columns</Label>
          <Select
            value={String(data.columns || 2)}
            onValueChange={(val) => onChange('columns', parseInt(val))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Column</SelectItem>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Content</Label>
          <RichTextEditor
            value={data.content || ''}
            onChange={(html) => onChange('content', html)}
            placeholder="Enter legal text, disclaimers, terms and conditions…"
            minHeight="200px"
          />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            This text renders at 8px in the final document. Use the toolbar to
            format content and insert data variables as needed.
          </p>
        </div>
      </div>
    );
  },
};