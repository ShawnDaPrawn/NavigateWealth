import React from 'react';
import { SeparatorHorizontal } from 'lucide-react';
import { BlockDefinition } from '../registry';

export const PageBreakBlock: BlockDefinition = {
  type: 'page_break',
  label: 'Page Break',
  icon: SeparatorHorizontal,
  category: 'layout',
  description: 'Force new page',
  initialData: {},
  render: () => null, // Page breaks are handled structurally by FormCanvas
  editor: () => {
    return (
        <div className="p-4 bg-gray-50 rounded border border-gray-200 text-center">
            <div className="text-xs text-gray-500">
                This block forces a new page in the PDF output.
            </div>
        </div>
    );
  }
};
