import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { BlockDefinition } from '../registry';
import { ImageData } from '../types';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { cn } from '../../../../../ui/utils';

export const ImageBlock: BlockDefinition = {
  type: 'image_asset',
  label: 'Image Asset',
  icon: ImageIcon,
  category: 'content',
  description: 'Logos or diagrams',
  initialData: {
    src: '',
    width: '100%',
    align: 'left',
    caption: ''
  },
  render: ({ block }) => {
    const data = block.data as ImageData;
    return (
      <div className={cn("w-full flex mb-2", 
         data.align === 'center' ? 'justify-center' : data.align === 'right' ? 'justify-end' : 'justify-start'
      )}>
         <div className="flex flex-col gap-1">
            {data.src ? (
              <img 
                src={data.src} 
                alt="Form Asset" 
                style={{ width: data.width || '100%', maxHeight: '100mm', objectFit: 'contain' }}
              />
            ) : (
              <div className="w-[40mm] h-[20mm] bg-gray-100 flex items-center justify-center border border-gray-300 text-gray-400">
                 <ImageIcon className="w-6 h-6" />
              </div>
            )}
            {data.caption && <div className="text-[8px] text-gray-500 italic text-center">{data.caption}</div>}
         </div>
      </div>
    );
  },
  editor: ({ block, onChange }) => {
    return (
       <div className="space-y-4">
          <div className="space-y-2">
             <Label className="text-xs">Image URL</Label>
             <Input 
                value={(block.data as ImageData).src || ''}
                onChange={(e) => onChange('src', e.target.value)}
                placeholder="https://..."
             />
             <p className="text-[10px] text-gray-400">Paste a direct link to a transparent PNG or JPG.</p>
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Width</Label>
             <Input 
                value={(block.data as ImageData).width || '100%'}
                onChange={(e) => onChange('width', e.target.value)}
                placeholder="e.g. 100%, 50mm, 200px"
             />
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Alignment</Label>
             <Select 
                value={(block.data as ImageData).align || 'left'} 
                onValueChange={(v) => onChange('align', v)}
             >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="left">Left</SelectItem>
                   <SelectItem value="center">Center</SelectItem>
                   <SelectItem value="right">Right</SelectItem>
                </SelectContent>
             </Select>
          </div>
          <div className="space-y-2">
             <Label className="text-xs">Caption (Optional)</Label>
             <Input 
                value={(block.data as ImageData).caption || ''}
                onChange={(e) => onChange('caption', e.target.value)}
             />
          </div>
       </div>
    );
  }
};
