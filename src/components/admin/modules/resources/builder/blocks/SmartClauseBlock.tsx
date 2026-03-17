import React from 'react';
import DOMPurify from 'dompurify';
import { FileText } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { SmartClauseData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { RichTextEditor } from '../components/RichTextEditor';

// ============================================================================
// SmartClauseBlock — numbered legal clause with rich-text content and
// embedded data variables.
//
// Upgraded to use the shared RichTextEditor for WYSIWYG editing.
// Variables are now inserted via the editor's built-in variable button
// using {{key}} syntax, rendered as styled <span class="variable-tag">.
//
// The canvas preview highlights variables inline within the clause text.
// ============================================================================

export const SmartClauseBlock: BlockDefinition = {
  type: 'smart_clause',
  label: 'Smart Clause',
  icon: FileText,
  category: 'compliance',
  description: 'Numbered clause with data variables',
  initialData: {
    clauseNumber: '',
    title: 'Clause Title',
    content: '<p>I give, devise, and bequeath…</p>',
    variables: [],
  } as SmartClauseData,

  // ==========================================================================
  // CANVAS RENDER — clause number + title + rich content with highlighted vars
  // ==========================================================================
  render: ({ block }) => {
    const data = block.data as SmartClauseData;

    return (
      <div className="flex gap-3 py-1">
        {/* Clause number */}
        <div className="w-7 shrink-0 font-bold text-[10px] text-gray-900 pt-0.5 text-right">
          {data.clauseNumber || '#.'}
        </div>

        {/* Clause body */}
        <div className="flex-1 min-w-0">
          {data.title && (
            <div className="font-bold text-gray-900 mb-0.5 uppercase text-[10px] tracking-wide">
              {data.title}
            </div>
          )}

          {/* Render HTML content — variable-tag spans are styled via BASE_PDF_CSS */}
          <div
            className="text-[9.5px] text-gray-800 leading-relaxed text-justify"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(data.content || '<p>Empty clause</p>'),
            }}
          />
        </div>
      </div>
    );
  },

  // ==========================================================================
  // EDITOR — clause number, title, RichTextEditor for content
  // ==========================================================================
  editor: ({ block, onChange }) => {
    const data = block.data as SmartClauseData;

    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Clause Number</Label>
          <Input
            value={data.clauseNumber || ''}
            onChange={(e) => onChange('clauseNumber', e.target.value)}
            placeholder="e.g. 1.1 — leave empty for auto"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            value={data.title || ''}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="Clause title (optional)"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Content</Label>
          <RichTextEditor
            value={data.content || ''}
            onChange={(html) => onChange('content', html)}
            placeholder="Draft the clause text. Use the {x} button to insert data variables…"
            minHeight="160px"
          />
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Use the <code className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-mono">
              {'{x}'}
            </code> toolbar button to insert data variables like{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-mono">
              {'{{beneficiary_name}}'}
            </code>.
            Variables resolve to client data when the form is rendered.
          </p>
        </div>
      </div>
    );
  },
};