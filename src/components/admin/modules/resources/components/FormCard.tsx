/**
 * FormCard Component
 * Displays a form/template card with actions
 */

import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { FileText, Download, Eye, Edit, Trash2, Copy, Star } from 'lucide-react';
import { FormDefinition } from '../types';
import { getCategoryColor, formatViewCount, getRelativeTime } from '../utils';

interface FormCardProps {
  form: FormDefinition;
  onPreview?: (form: FormDefinition) => void;
  onEdit?: (form: FormDefinition) => void;
  onDelete?: (form: FormDefinition) => void;
  onDuplicate?: (form: FormDefinition) => void;
  onDownload?: (form: FormDefinition) => void;
  selected?: boolean;
  onSelect?: (form: FormDefinition) => void;
}

export function FormCard({
  form,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
  onDownload,
  selected,
  onSelect,
}: FormCardProps) {
  return (
    <Card 
      className={`group hover:shadow-md transition-all cursor-pointer ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onSelect?.(form)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{form.name}</h3>
                {form.isPopular && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {form.description}
              </p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className={getCategoryColor(form.category)}>
            {form.category}
          </Badge>
          {form.clientTypes.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type}
            </Badge>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {formatViewCount(form.downloads)}
          </div>
          <div>v{form.version}</div>
          <div>{getRelativeTime(form.lastUpdated)}</div>
          <div>{form.size}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPreview && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(form);
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
          )}
          
          {onEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(form);
              }}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          
          {onDuplicate && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(form);
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
          
          {onDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(form);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
