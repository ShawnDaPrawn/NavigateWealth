import React, { useState } from 'react';
import { Plus, Settings2, X, GripVertical } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface OptionsManagerProps {
  options?: string[];
  onChange: (options: string[]) => void;
}

export const OptionsManager = ({ 
  options = [], 
  onChange 
}: OptionsManagerProps) => {
  const [newOption, setNewOption] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const addOption = () => {
    if (!newOption.trim()) return;
    // Prevent duplicates
    if (options.includes(newOption.trim())) {
      setNewOption('');
      return;
    }
    onChange([...options, newOption.trim()]);
    setNewOption('');
  };

  const removeOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    onChange(newOptions);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(options);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onChange(items);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox"
          className="w-full justify-between h-8 text-sm font-normal px-3 border-gray-200 bg-white hover:bg-gray-50 hover:border-purple-300 transition-colors text-left"
        >
          {options.length > 0 
            ? <span className="truncate text-gray-700">{options.join(', ')}</span> 
            : <span className="text-gray-400 italic">Configure options...</span>}
          <Settings2 className="ml-2 h-3 w-3 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm text-gray-900">Dropdown Options</h4>
            <p className="text-xs text-gray-500 mt-1">
              Define the choices available for this field. Users will select one of these values.
            </p>
          </div>
          
          {/* Input Area */}
          <div className="flex gap-2">
            <Input 
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type option and press Enter..."
              className="h-9 text-sm"
            />
            <Button 
              size="sm" 
              onClick={addOption} 
              disabled={!newOption.trim()}
              className="h-9 w-9 p-0 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Options List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="options-list">
              {(provided) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="max-h-[240px] overflow-y-auto pr-1 -mr-1 space-y-2"
                >
                   {options.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                        <span className="text-xs text-gray-400">No options added yet</span>
                      </div>
                   )}
                   {options.map((option, idx) => (
                     <Draggable key={option} draggableId={option} index={idx}>
                       {(provided, snapshot) => (
                         <div 
                           ref={provided.innerRef}
                           {...provided.draggableProps}
                           className={`
                             flex items-center justify-between px-3 py-2 rounded-md border 
                             ${snapshot.isDragging ? 'bg-purple-50 border-purple-300 shadow-md z-50' : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-sm'} 
                             transition-all
                           `}
                         >
                           <div className="flex items-center gap-2 overflow-hidden flex-1">
                             <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
                               <GripVertical className="h-3.5 w-3.5" />
                             </div>
                             <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                             <span className="text-sm text-gray-700 truncate">{option}</span>
                           </div>
                           <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOption(idx);
                              }}
                              className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-all ml-2"
                           >
                             <X className="h-3.5 w-3.5" />
                           </button>
                         </div>
                       )}
                     </Draggable>
                   ))}
                   {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          {options.length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400">{options.length} options configured</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                onClick={() => onChange([])}
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
