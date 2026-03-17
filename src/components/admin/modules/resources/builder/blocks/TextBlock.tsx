import React from 'react';
import DOMPurify from 'dompurify';
import { Type } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { TextData } from '../types';
import { RichTextEditor } from '../components/RichTextEditor';

export const TextBlock: BlockDefinition = {
  type: 'text',
  label: 'Text Block',
  icon: Type,
  category: 'content',
  description: 'Paragraphs, lists, disclaimers',
  initialData: {
    content: '<p>Enter your text here...</p>'
  },
  render: ({ block }) => {
    const data = block.data as TextData;
    return (
      <div 
        className="text-[9.5px] leading-relaxed text-justify [&_p]:my-[0.5mm] [&_p]:leading-[1.5] [&_h3]:text-[10.5px] [&_h3]:font-bold [&_h3]:my-[1mm] [&_h4]:text-[10px] [&_h4]:font-semibold [&_h4]:my-[0.5mm] [&_ul]:my-[0.5mm] [&_ul]:pl-[4mm] [&_ol]:my-[0.5mm] [&_ol]:pl-[4mm] [&_li]:my-0"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content || '<p>Empty text block</p>') }}
      />
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as TextData;
    return (
      <div className="space-y-3">
        <RichTextEditor
          value={data.content || ''}
          onChange={(html) => onChange('content', html)}
          placeholder="Start typing your content…"
          minHeight="200px"
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Use the toolbar to format text, insert links, or add data variables.
          Variables like <code className="px-1 py-0.5 bg-gray-100 rounded text-[9px] font-mono">{'{{key}}'}</code> resolve
          to client data when the form is rendered.
        </p>
      </div>
    );
  }
};