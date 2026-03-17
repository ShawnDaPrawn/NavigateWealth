/**
 * Reusable Form Section Component
 * Provides consistent styling and structure for form sections
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Save, Edit2, Plus } from 'lucide-react';

interface FormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onSave?: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
  addButtonText?: string;
  isEditing?: boolean;
  isSaveDisabled?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  icon,
  children,
  onSave,
  onEdit,
  onAdd,
  addButtonText = 'Add',
  isEditing = false,
  isSaveDisabled = false,
  className = '',
  headerActions,
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          <div className="flex gap-2">
            {headerActions}
            {onAdd && (
              <Button
                onClick={onAdd}
                variant="outline"
                size="sm"
                className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                {addButtonText}
              </Button>
            )}
            {onEdit && !isEditing && (
              <Button
                onClick={onEdit}
                variant="outline"
                size="sm"
                className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            {onSave && isEditing && (
              <Button
                onClick={onSave}
                disabled={isSaveDisabled}
                size="sm"
                className="bg-[#6d28d9] text-white hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
};
