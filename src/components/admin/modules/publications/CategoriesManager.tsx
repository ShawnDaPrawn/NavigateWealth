/**
 * Publications Feature - CategoriesManager Component (REFACTORED)
 * 
 * Manage article categories with CRUD operations and drag-to-reorder.
 * Now uses the new hooks, services, and shared components.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import {
  PlusCircle,
  Edit,
  Trash2,
  FolderOpen,
  Save,
  X,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Import from refactored modules
import {
  useCategories,
  useCategoryActions
} from './hooks';

import { LoadingState } from './components/LoadingState';
import {
  TextField,
  TextareaField,
  CheckboxField
} from './components/FormField';
import { ConfirmDialog, useConfirmDialog } from './components/ConfirmDialog';

import { generateSlug } from './utils';
import type { Category, CreateCategoryInput } from './types';

const DRAG_TYPE = 'CATEGORY_ROW';

interface DraggableCategoryRowProps {
  category: Category;
  index: number;
  moveCategory: (dragIndex: number, hoverIndex: number) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onToggleActive: (category: Category) => void;
  isProcessing: boolean;
}

function DraggableCategoryRow({ 
  category, 
  index, 
  moveCategory, 
  onEdit, 
  onDelete, 
  onToggleActive,
  isProcessing
}: DraggableCategoryRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ handlerId }, drop] = useDrop({
    accept: DRAG_TYPE,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { index: number }, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      moveCategory(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: () => {
      return { index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      data-handler-id={handlerId}
      className={cn(
        'hover:bg-gray-50',
        isDragging && 'opacity-50'
      )}
    >
      <td className="px-4 py-4 cursor-move">
        <div ref={preview}>
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-gray-900">{category.name}</p>
      </td>
      <td className="px-4 py-4">
        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {category.slug}
        </code>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm text-gray-600 max-w-xs truncate">
          {category.description || '-'}
        </p>
      </td>
      <td className="px-4 py-4">
        <button
          onClick={() => onToggleActive(category)}
          className="focus:outline-none"
          disabled={isProcessing}
        >
          <Badge
            className={cn(
              'cursor-pointer',
              category.is_active
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-gray-100 text-gray-800 border-gray-200'
            )}
          >
            {category.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            title="Edit"
            disabled={isProcessing}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category)}
            title="Delete"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function CategoriesManager() {
  // Data fetching with hooks
  const { categories: initialCategories, isLoading, error, refetch } = useCategories({ autoSort: true });
  
  // Local state for drag reordering
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);
  
  // Actions hook
  const { 
    handleCreate, 
    handleUpdate, 
    handleDelete, 
    handleToggleActive,
    handleReorder,
    isProcessing 
  } = useCategoryActions({
    onSuccess: (message) => {
      refetch();
    },
    onError: (error) => {
      setFormError(error);
    },
    onDelete: () => {
      refetch();
    }
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [autoSlug, setAutoSlug] = useState(true);

  // Confirm dialog
  const confirmDialog = useConfirmDialog();

  // Auto-generate slug from name
  useEffect(() => {
    if (autoSlug && name) {
      setSlug(generateSlug(name));
    }
  }, [name, autoSlug]);

  const handleCreateClick = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setAutoSlug(true);
    setFormError(null);
    setShowForm(true);
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description || '');
    setIsActive(category.is_active);
    setAutoSlug(false);
    setFormError(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setFormError(null);
  };

  const handleSaveForm = async () => {
    setFormError(null);

    // Basic validation
    if (!name.trim()) {
      setFormError('Category name is required');
      return;
    }

    if (!slug.trim()) {
      setFormError('Slug is required');
      return;
    }

    const formData: CreateCategoryInput = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      is_active: isActive
    };

    let success = false;

    if (editingCategory) {
      const result = await handleUpdate(editingCategory.id, formData);
      success = result !== null;
    } else {
      const result = await handleCreate(formData);
      success = result !== null;
    }

    if (success) {
      handleCancelForm();
    }
  };

  const handleDeleteClick = (category: Category) => {
    confirmDialog.open({
      title: 'Delete Category',
      description: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      onConfirm: () => handleDelete(category.id)
    });
  };

  const handleToggleClick = async (category: Category) => {
    await handleToggleActive(category);
  };

  const moveCategory = (dragIndex: number, hoverIndex: number) => {
    const draggedCategory = categories[dragIndex];
    const newCategories = [...categories];
    newCategories.splice(dragIndex, 1);
    newCategories.splice(hoverIndex, 0, draggedCategory);
    setCategories(newCategories);
  };

  const handleReorderComplete = async () => {
    // Update sort_order for all categories based on their position
    const updatedCategories = categories.map((cat, index) => ({
      ...cat,
      sort_order: index
    }));
    
    await handleReorder(updatedCategories);
  };

  if (isLoading) {
    return <LoadingState message="Loading categories..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Article Categories</h2>
          <p className="text-sm text-gray-500">
            Manage article categories and their display order
          </p>
        </div>
        {!showForm && (
          <Button onClick={handleCreateClick} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New Category
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingCategory ? 'Edit Category' : 'New Category'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
                <button onClick={() => setFormError(null)}>
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextField
                label="Name"
                name="name"
                value={name}
                onChange={setName}
                placeholder="Market & Economic Insights"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setAutoSlug(false);
                    }}
                    placeholder="market-economic-insights"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoSlug(true)}
                    disabled={autoSlug}
                  >
                    Auto
                  </Button>
                </div>
              </div>
            </div>

            <TextareaField
              label="Description"
              name="description"
              value={description}
              onChange={setDescription}
              placeholder="Brief description of this category..."
              rows={3}
            />

            <CheckboxField
              label="Active (visible on website)"
              name="is_active"
              checked={isActive}
              onChange={setIsActive}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSaveForm} disabled={isProcessing}>
                <Save className="h-4 w-4 mr-2" />
                {isProcessing ? 'Saving...' : 'Save Category'}
              </Button>
              <Button variant="outline" onClick={handleCancelForm} disabled={isProcessing}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List with Drag & Drop */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DndProvider backend={HTML5Backend}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No categories found</p>
                      </td>
                    </tr>
                  ) : (
                    categories.map((category, index) => (
                      <DraggableCategoryRow
                        key={category.id}
                        category={category}
                        index={index}
                        moveCategory={moveCategory}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                        onToggleActive={handleToggleClick}
                        isProcessing={isProcessing}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </DndProvider>
          </div>

          {/* Save Order Button */}
          {categories.length > 0 && (
            <div className="p-4 border-t bg-gray-50">
              <Button onClick={handleReorderComplete} disabled={isProcessing} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Order
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Drag rows to reorder, then click "Save Order" to persist changes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && confirmDialog.config && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={confirmDialog.close}
          onConfirm={confirmDialog.confirm}
          title={confirmDialog.config.title}
          description={confirmDialog.config.description}
          variant="danger"
          isLoading={isProcessing}
        />
      )}
    </div>
  );
}
