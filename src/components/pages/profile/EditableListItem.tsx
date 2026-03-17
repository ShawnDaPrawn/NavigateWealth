/**
 * Reusable Editable List Item Component
 * Provides consistent edit/save/delete functionality for list items
 */

import React from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Save, Edit2, Trash2, X } from 'lucide-react';

interface EditableListItemProps {
  isEditing: boolean;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  isSaveDisabled?: boolean;
  borderColor?: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  children: React.ReactNode;
  className?: string;
}

export const EditableListItem: React.FC<EditableListItemProps> = ({
  isEditing,
  onSave,
  onEdit,
  onDelete,
  onCancel,
  isSaveDisabled = false,
  borderColor = 'border-gray-200',
  badge,
  children,
  className = '',
}) => {
  const editBorderColor = borderColor.replace('border-', '').replace('-200', '-600');
  
  return (
    <div 
      className={`p-5 rounded-lg border-2 transition-all ${
        isEditing 
          ? `border-[${editBorderColor}] bg-white shadow-sm` 
          : `${borderColor} bg-white`
      } ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        {badge && (
          <Badge variant={badge.variant || 'default'}>
            {badge.text}
          </Badge>
        )}
        <div className="flex gap-2 ml-auto">
          {isEditing ? (
            <div className="contents">
              {onCancel && (
                <Button
                  onClick={onCancel}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              <Button
                onClick={onSave}
                disabled={isSaveDisabled}
                size="sm"
                className="bg-[#6d28d9] text-white hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          ) : (
            <div className="contents">
              <Button
                onClick={onEdit}
                variant="outline"
                size="sm"
                className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                onClick={onDelete}
                variant="outline"
                size="sm"
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {children}
    </div>
  );
};