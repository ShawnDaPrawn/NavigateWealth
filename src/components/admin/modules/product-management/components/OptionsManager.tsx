import React, { useState } from 'react';
import { Plus, Settings2, GripVertical } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface OptionsManagerProps {
  options?: string[];
  onChange: (options: string[]) => void;
  /** The field's name, shown in the dialog title ("Dropdown options · Premium escalation"). */
  fieldName?: string;
}

/**
 * Dropdown options for a schema field. The trigger shows the current options;
 * editing happens in a centred dialog on a draft, so Cancel discards and
 * "Save options" applies.
 */
export const OptionsManager = ({ options = [], onChange, fieldName }: OptionsManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(options);
  const [newOption, setNewOption] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(options);
    setNewOption('');
    setError(null);
    setIsOpen(true);
  };

  const addOption = () => {
    const value = newOption.trim();
    if (!value) return;
    if (draft.includes(value)) {
      setError(`“${value}” is already an option`);
      return;
    }
    setDraft([...draft, value]);
    setNewOption('');
    setError(null);
  };

  const removeOption = (index: number) => {
    const next = [...draft];
    next.splice(index, 1);
    setDraft(next);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(draft);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setDraft(items);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  const save = () => {
    onChange(draft);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={open}
        className="h-8 w-full justify-between border-gray-200 bg-white px-3 text-left text-sm font-normal transition-colors hover:border-purple-300 hover:bg-gray-50"
      >
        {options.length > 0 ? (
          <span className="truncate text-gray-700">{options.join(', ')}</span>
        ) : (
          <span className="italic text-gray-400">Configure options...</span>
        )}
        <Settings2 className="ml-2 h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Dropdown options{fieldName ? ` · ${fieldName}` : ''}</DialogTitle>
            <DialogDescription>
              The choices available for this field. Drag to reorder.
            </DialogDescription>
          </DialogHeader>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="options-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="max-h-[280px] space-y-2 overflow-y-auto"
                >
                  {draft.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-100 bg-gray-50/50 py-6 text-center">
                      <span className="text-xs text-gray-400">No options added yet</span>
                    </div>
                  )}
                  {draft.map((option, idx) => (
                    <Draggable key={option} draggableId={option} index={idx}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 transition-all ${
                            snapshot.isDragging
                              ? 'z-50 border-purple-300 bg-purple-50 shadow-md'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-2 overflow-hidden">
                            <div
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                            >
                              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                            </div>
                            <span className="truncate text-sm text-gray-700">{option}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-nw-text-2 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeOption(idx)}
                            aria-label={`Remove ${option}`}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => {
                  setNewOption(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="New option"
                aria-label="New option"
                aria-invalid={!!error}
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addOption}
                disabled={!newOption.trim()}
                className="h-9 shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <DialogFooter className="sm:justify-between">
            {draft.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDraft([])}
              >
                Clear all
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save options
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
