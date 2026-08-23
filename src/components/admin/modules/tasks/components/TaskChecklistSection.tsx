/**
 * The checklist section of the task form modal: progress bar, drag-sortable
 * items, and the add-item input. JSX moved verbatim from TaskFormModal.tsx;
 * every captured name became a prop.
 */
import React from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Checkbox } from '../../../../ui/checkbox';
import { CheckSquare, GripVertical, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { TaskChecklistItem } from '../types';

interface TaskChecklistSectionProps {
  checklistItems: TaskChecklistItem[];
  newChecklistItem: string;
  setNewChecklistItem: React.Dispatch<React.SetStateAction<string>>;
  handleAddChecklistItem: () => Promise<void>;
  handleToggleChecklistItem: (itemId: string) => Promise<void>;
  handleDeleteChecklistItem: (itemId: string) => Promise<void>;
  handleDragEnd: (result: DropResult) => Promise<void>;
}

export function TaskChecklistSection({
  checklistItems,
  newChecklistItem,
  setNewChecklistItem,
  handleAddChecklistItem,
  handleToggleChecklistItem,
  handleDeleteChecklistItem,
  handleDragEnd,
}: TaskChecklistSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-gray-500">
            <CheckSquare className="w-5 h-5" />
          </div>
          <h3 className="font-medium text-gray-900">Checklist</h3>
        </div>
      </div>

      <div className="pl-9 space-y-4">
        {/* Progress Bar */}
        {checklistItems.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
            <span className="text-xs font-medium w-8 text-right">
              {Math.round(
                (checklistItems.filter((i) => i.completed).length / checklistItems.length) * 100,
              )}
              %
            </span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${Math.round((checklistItems.filter((i) => i.completed).length / checklistItems.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Checklist Items */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="checklist">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {checklistItems.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-3 group p-2 hover:bg-gray-50 rounded-md transition-colors ${snapshot.isDragging ? 'bg-white shadow-lg z-50 ring-1 ring-gray-200' : ''}`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <Checkbox
                          id={`checklist-${item.id}`}
                          checked={item.completed}
                          onCheckedChange={() => handleToggleChecklistItem(item.id)}
                        />
                        <Label
                          htmlFor={`checklist-${item.id}`}
                          className={`flex-1 text-sm cursor-pointer ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                        >
                          {item.text}
                        </Label>
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
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

        {/* Add Item Input */}
        <div className="pl-8">
          <div className="flex gap-2">
            <Input
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
              placeholder="Add an item..."
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="button"
              onClick={handleAddChecklistItem}
              disabled={!newChecklistItem.trim()}
              variant="secondary"
              className="shrink-0 h-9"
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
