import { useState } from 'react';
import { MoreHorizontal, GripVertical } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';

import { Input } from '../../../../ui/input';
import { Switch } from '../../../../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { DsButton } from '../../../layout/page';
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
  hasUnsavedChanges,
}: SchemaEditorProps) {
  // Get available keys for this category
  const availableKeys = selectedCategoryId ? getAvailableKeysForCategory(selectedCategoryId) : [];

  const handleAddField = () => {
    const newField: ProductField = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      type: 'text',
      required: false,
      options: [],
    };
    updateFields([...currentFields, newField]);
  };

  const handleRemoveField = (id: string) => {
    updateFields(currentFields.filter((f) => f.id !== id));
  };

  const handleUpdateField = (
    id: string,
    key: keyof ProductField,
    value: ProductField[keyof ProductField],
  ) => {
    updateFields(currentFields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(currentFields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateFields(items);
  };

  const [fieldToDelete, setFieldToDelete] = useState<ProductField | null>(null);

  // PM-Structure column order: Field · Type · Linked key · Options · Required · actions
  const gridTemplateColumns =
    '20px minmax(130px,1.6fr) minmax(110px,1fr) minmax(130px,1.2fr) minmax(120px,1.2fr) 72px 32px';

  return (
    <section className="ds-card flex min-w-0 flex-col overflow-hidden">
      <div className="ds-card-h">
        <h3>{selectedCategoryName} structure</h3>
        <div className="flex items-center gap-1.5">
          {saveSuccess && (
            <span className="ds-pill ok mr-1" role="status">
              Saved
            </span>
          )}
          <DsButton size="sm" onClick={handleAddField}>
            Add field
          </DsButton>
          <DsButton size="sm" variant="primary" onClick={onSave} disabled={!hasUnsavedChanges}>
            Save changes
          </DsButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div
            className="grid items-center gap-2.5 border-b border-nw-line bg-[#fafafb] px-3.5 py-2.5 text-[12px] font-medium text-nw-text-3"
            style={{ gridTemplateColumns }}
          >
            <div>
              <span className="sr-only">Reorder</span>
            </div>
            <div>Field</div>
            <div>Type</div>
            <div>Linked key</div>
            <div>Options</div>
            <div>Required</div>
            <div>
              <span className="sr-only">Actions</span>
            </div>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="fields">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="divide-y divide-nw-line"
                >
                  {currentFields.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <span className="ds-meta">No fields yet</span>
                      <DsButton size="sm" onClick={handleAddField}>
                        Add field
                      </DsButton>
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
                              gridTemplateColumns,
                            }}
                            className={`grid items-center gap-2.5 px-3.5 py-2 transition-colors ${
                              snapshot.isDragging
                                ? 'z-50 bg-nw-violet-50 shadow-lg'
                                : 'bg-white hover:bg-[#fafafb]'
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="group flex cursor-grab justify-center active:cursor-grabbing"
                              aria-label={`Reorder ${field.name || 'field'}`}
                            >
                              <GripVertical className="h-4 w-4 text-nw-text-3 group-hover:text-nw-ink" />
                            </div>

                            <Input
                              value={field.name}
                              onChange={(e) => handleUpdateField(field.id, 'name', e.target.value)}
                              aria-label="Field name"
                              className="h-8 text-[13px]"
                            />

                            <Select
                              value={field.type}
                              onValueChange={(val) => handleUpdateField(field.id, 'type', val)}
                            >
                              <SelectTrigger className="h-8 text-[13px]" aria-label="Field type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <div>
                              {availableKeys.length > 0 ? (
                                <Select
                                  value={field.keyId || '__none__'}
                                  onValueChange={(val) =>
                                    handleUpdateField(
                                      field.id,
                                      'keyId',
                                      val === '__none__' ? undefined : val,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-sm border-gray-200">
                                    <SelectValue placeholder="Select key..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      <span className="text-gray-400 italic">None</span>
                                    </SelectItem>
                                    {availableKeys.map((key) => {
                                      const isAssigned = currentFields.some(
                                        (f) => f.keyId === key.id && f.id !== field.id,
                                      );
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
                                <span className="ds-meta">—</span>
                              )}
                            </div>

                            <div>
                              {field.type === 'dropdown' ? (
                                <OptionsManager
                                  options={field.options || []}
                                  fieldName={field.name}
                                  onChange={(newOptions) =>
                                    handleUpdateField(field.id, 'options', newOptions)
                                  }
                                />
                              ) : (
                                <span className="ds-meta">—</span>
                              )}
                            </div>

                            <label className="flex items-center gap-2 text-[13px] text-nw-text-2">
                              <Switch
                                checked={!!field.required}
                                onCheckedChange={(checked) =>
                                  handleUpdateField(field.id, 'required', checked)
                                }
                                aria-label={`${field.name || 'Field'} is required`}
                              />
                              {field.required ? 'Yes' : 'No'}
                            </label>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <DsButton
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Field actions for ${field.name || 'Untitled'}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                </DsButton>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-red-700 focus:text-red-700"
                                  onSelect={() => setFieldToDelete(field)}
                                >
                                  Delete field
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
        </div>
      </div>

      <AlertDialog open={!!fieldToDelete} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the field{' '}
              <span className="font-medium text-nw-ink">“{fieldToDelete?.name || 'Untitled'}”</span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fieldToDelete) handleRemoveField(fieldToDelete.id);
                setFieldToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
