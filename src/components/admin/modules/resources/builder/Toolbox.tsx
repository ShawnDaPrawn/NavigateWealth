import React, { useMemo } from 'react';
import { Button } from '../../../../ui/button';
import { BlockType } from './types';
import { BLOCK_REGISTRY, BlockDefinition } from './registry';

interface ToolboxProps {
  onAddBlock: (type: BlockType) => void;
}

export const Toolbox = ({ onAddBlock }: ToolboxProps) => {
  const categories: Record<string, string> = {
    layout: 'Layout',
    content: 'Content',
    data_entry: 'Data Entry',
    tables: 'Tables & Data',
    signatures: 'Signatures',
    client_data: 'Client Data',
    compliance: 'Compliance',
    admin: 'Admin & Misc',
  };

  const groupedTools = useMemo(() => {
    const tools = Object.values(BLOCK_REGISTRY);
    const grouped: Record<string, BlockDefinition[]> = {};

    tools.forEach(tool => {
      const category = tool.category || 'admin';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    });

    return grouped;
  }, []);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900">Components</h3>
        <p className="text-xs text-gray-500 mt-1">Click or drag to add to the canvas</p>
      </div>
      
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        {Object.entries(categories).map(([catKey, catLabel]) => {
          const tools = groupedTools[catKey];
          if (!tools || tools.length === 0) return null;

          return (
            <div key={catKey} className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{catLabel}</h4>
              <div className="space-y-2">
                {tools.map((tool) => (
                  <Button
                    key={tool.type}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 text-left hover:bg-slate-50 border-slate-200 cursor-grab active:cursor-grabbing overflow-hidden"
                    onClick={() => onAddBlock(tool.type)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copyMove';
                      e.dataTransfer.setData('application/x-block-type', tool.type);
                      e.dataTransfer.setData('text/x-source', 'toolbox');
                    }}
                  >
                    <tool.icon className="h-5 w-5 mr-3 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-700 truncate">{tool.label}</div>
                      {tool.description && (
                        <div className="text-[10px] text-slate-400 font-normal truncate">{tool.description}</div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};