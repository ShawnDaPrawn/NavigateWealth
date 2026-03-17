import React from 'react';
import { Hash } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { SectionHeaderData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';

export const SectionHeaderBlock: BlockDefinition = {
  type: 'section_header',
  label: 'Section Header',
  icon: Hash,
  category: 'layout',
  description: 'Numbered section title',
  initialData: {
    number: '1.',
    title: 'SECTION TITLE'
  },
  render: ({ block }) => {
    const data = block.data as SectionHeaderData;
    return (
      <div className="section-head">
        <span className="num mr-2 text-purple-700 font-bold">{data.number}</span>
        <h2 className="uppercase font-bold text-gray-800 m-0">{data.title}</h2>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
      <div className="contents">
        <div className="space-y-2">
          <Label className="text-xs">Section Number</Label>
          <Input 
            value={(block.data as SectionHeaderData).number || ''} 
            onChange={(e) => onChange('number', e.target.value)}
            placeholder="e.g. 1."
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Title</Label>
          <Input 
            value={(block.data as SectionHeaderData).title || ''} 
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="e.g. CLIENT DETAILS"
          />
        </div>
      </div>
    );
  }
};