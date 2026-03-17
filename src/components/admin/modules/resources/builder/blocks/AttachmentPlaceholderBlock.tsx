import React from 'react';
import { Paperclip } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { AttachmentPlaceholderData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';

export const AttachmentPlaceholderBlock: BlockDefinition = {
  type: 'attachment_placeholder',
  label: 'Attachment Area',
  icon: Paperclip,
  category: 'admin',
  description: 'Paste area for docs',
  initialData: {
    label: 'Attach Document Here',
    height: '40mm'
  },
  render: ({ block }) => {
    const data = block.data as AttachmentPlaceholderData;
    return (
      <div 
        className="border-2 border-dotted border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-2" 
        style={{ height: data.height || '40mm' }}
      >
         <Paperclip className="w-5 h-5 text-gray-300" />
         <div className="text-[9.5px] font-medium uppercase tracking-wide">{data.label || "Attach Document Here"}</div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    const data = block.data as AttachmentPlaceholderData;
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Placeholder Label</Label>
             <Input 
                value={data.label || ''}
                onChange={(e) => onChange('label', e.target.value)}
                placeholder="e.g. Attach ID Copy Here"
             />
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Height</Label>
             <Input 
                value={data.height || '40mm'}
                onChange={(e) => onChange('height', e.target.value)}
                placeholder="e.g. 40mm, 100px"
             />
          </div>
       </div>
    );
  }
};