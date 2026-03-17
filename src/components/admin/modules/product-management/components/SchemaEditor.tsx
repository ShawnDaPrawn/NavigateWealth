import React from 'react';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Save, 
  CheckCircle2,
  LayoutGrid,
  Settings2,
  Link2
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../../ui/select';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Switch } from '../../../../ui/switch';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../../ui/alert-dialog';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ProductField, FIELD_TYPES, ProductCategoryId } from '../types';
import { OptionsManager } from './OptionsManager';
import { getAvailableKeysForCategory } from '../keyMappingHelpers';

interface SchemaEditorProps {
  currentFields: ProductField[];
  updateFields: (fields: ProductField[]) => void;
  selectedCategoryName?: string;
  selectedCategoryId?: ProductCategoryId;
  onSave: () => void;
  saveSuccess: boolean;
  hasUnsavedChanges: boolean;
}

export function SchemaEditor({
  currentFields,
  updateFields,
  selectedCategoryName,
  selectedCategoryId,
  onSave,
  saveSuccess,
  hasUnsavedChanges
}: SchemaEditorProps) {

  // Get available keys for this category
  const availableKeys = selectedCategoryId ? getAvailableKeysForCategory(selectedCategoryId) : [];

  const handleAddField = () => {
    const newField: ProductField = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'text',
      required: false,
      options: []
    };
    updateFields([...currentFields, newField]);
  };

  const handleRemoveField = (id: string) => {
    updateFields(currentFields.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, key: keyof ProductField, value: ProductField[keyof ProductField]) => {
    updateFields(currentFields.map(f => 
      f.id === id ? { ...f, [key]: value } : f
    ));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(currentFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateFields(items);
  };

  const gridTemplateColumns = '40px 2fr 1.5fr 100px 2fr 2fr 60px';

  return (
    <div className="bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
      {/* Header Toolbar */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-md">
            <LayoutGrid className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {selectedCategoryName} Structure Editor
            </h3>
            <p className="text-xs text-gray-500">
              Drag and drop to reorder fields
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm text-green-600 flex items-center font-medium animate-in fade-in duration-300">
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Saved
            </span>
          )}
          <Button 
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className={hasUnsavedChanges ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Spreadsheet Grid Editor */}
      <div className="p-6 overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Grid Header */}
          <div 
            className="grid gap-4 px-4 py-3 bg-gray-100/80 rounded-t-lg border-x border-t border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider"
            style={{ gridTemplateColumns }}
          >
            <div className="flex items-center justify-center">
              <Settings2 className="w-3 h-3" />
            </div>
            <div className="flex items-center">Field Name</div>
            <div className="flex items-center">Data Type</div>
            <div className="flex items-center justify-center">Required</div>
            <div className="flex items-center">Options (Dropdown)</div>
            <div className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Key Mapping
            </div>
            <div className="text-right">Action</div>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="fields">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="bg-white border-x border-b border-gray-200 rounded-b-lg divide-y divide-gray-100"
                >
                  {currentFields.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-sm">No fields defined yet.</p>
                      <Button variant="link" onClick={handleAddField} className="text-purple-600">
                        Add your first field
                      </Button>
                    </div>
                  ) : (
                    currentFields.map((field, index) => (
                      <Draggable key={field.id} draggableId={field.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{
                              ...provided.draggableProps.style,
                              gridTemplateColumns
                            }}
                            className={`
                              grid gap-4 items-center px-4 py-2
                              ${snapshot.isDragging ? 'bg-purple-50 shadow-lg ring-1 ring-purple-200 z-50' : 'bg-white hover:bg-gray-50/50'}
                              transition-colors duration-150
                            `}
                          >
                            {/* Drag Handle */}
                            <div {...provided.dragHandleProps} className="flex justify-center cursor-grab active:cursor-grabbing group">
                              <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                            </div>
                            
                            {/* Field Name */}
                            <div>
                              <Input
                                value={field.name}
                                onChange={(e) => handleUpdateField(field.id, 'name', e.target.value)}
                                placeholder="e.g. Cover Amount"
                                className="h-8 text-sm border-gray-200 focus:border-purple-400 focus:ring-purple-100"
                              />
                            </div>

                            {/* Data Type */}
                            <div>
                              <Select 
                                value={field.type} 
                                onValueChange={(val) => handleUpdateField(field.id, 'type', val)}
                              >
                                <SelectTrigger className="h-8 text-sm border-gray-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      <div className="flex items-center gap-2">
                                        {type.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Required Toggle */}
                            <div className="flex justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Switch
                                        checked={!!field.required}
                                        onCheckedChange={(checked) => handleUpdateField(field.id, 'required', checked)}
                                        className="data-[state=checked]:bg-purple-600"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{field.required ? 'Field is mandatory' : 'Field is optional'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            {/* Options (Conditional) */}
                            <div>
                              {field.type === 'dropdown' ? (
                                <OptionsManager 
                                  options={field.options || []} 
                                  onChange={(newOptions) => handleUpdateField(field.id, 'options', newOptions)} 
                                />
                              ) : (
                                <div className="h-8 bg-gray-50 rounded border border-gray-100 flex items-center px-3">
                                  <span className="text-xs text-gray-300 italic">Not applicable</span>
                                </div>
                              )}
                            </div>

                            {/* Key Mapping */}
                            <div>
                              {availableKeys.length > 0 ? (
                                <Select 
                                  value={field.keyId || '__none__'} 
                                  onValueChange={(val) => handleUpdateField(field.id, 'keyId', val === '__none__' ? undefined : val)}
                                >
                                  <SelectTrigger className="h-8 text-sm border-gray-200">
                                    <SelectValue placeholder="Select key..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      <span className="text-gray-400 italic">None</span>
                                    </SelectItem>
                                    {availableKeys.map((key) => {
                                      const isAssigned = currentFields.some(f => f.keyId === key.id && f.id !== field.id);
                                      return (
                                        <SelectItem 
                                          key={key.id} 
                                          value={key.id}
                                          disabled={isAssigned}
                                        >
                                          <div className="flex items-center justify-between w-full gap-2">
                                            <span className="text-xs">{key.name}</span>
                                            {isAssigned && (
                                              <span className="text-[10px] text-gray-400 italic ml-2">
                                                (Assigned)
                                              </span>
                                            )}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="h-8 bg-gray-50 rounded border border-gray-100 flex items-center px-3">
                                  <span className="text-xs text-gray-300 italic">No keys available</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Field?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete the field <span className="font-medium text-gray-900">"{field.name || 'Untitled'}"</span>? 
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleRemoveField(field.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add Field Button */}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={handleAddField}
              className="w-full border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/50 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Field
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}