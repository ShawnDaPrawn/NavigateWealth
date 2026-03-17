import React, { useState } from 'react';
import { MoreVertical, Edit2, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useTemplates } from '../../hooks/useTemplates';
import { CategoryBadge } from '../shared/CategoryBadge';
import { StatusBadge } from '../shared/StatusBadge';
import { TemplateStatus, RequestCategory, RequestTemplate } from '../../types';
import { DataTable, Column } from '../../../../components/DataTable';
import { Button } from '../../../../../../components/ui/button';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../../components/ui/select";

interface TemplateListViewProps {
  onCreateTemplate: () => void;
  onEditTemplate: (template: RequestTemplate) => void;
}

export function TemplateListView({ onCreateTemplate, onEditTemplate }: TemplateListViewProps) {
  const { templates, loading, error, duplicateTemplate, deleteTemplate, refetch } = useTemplates();
  const [selectedCategory, setSelectedCategory] = useState<RequestCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<TemplateStatus | 'all'>('all');
  
  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<RequestTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDuplicate = async (template: RequestTemplate) => {
    const result = await duplicateTemplate(template.id);
    if (result.success) {
      toast.success('Template duplicated successfully');
      refetch();
    } else {
      toast.error(`Failed to duplicate template: ${result.error}`);
    }
  };

  const handleDeleteClick = (template: RequestTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteTemplate(templateToDelete.id);
      if (result.success) {
        toast.success('Template deleted successfully');
        refetch();
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      } else {
        toast.error(`Failed to delete template: ${result.error}`);
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    if (selectedStatus === 'all') {
      // By default (All), exclude Archived templates to simulate "deletion" behavior
      // unless the user explicitly selects "Archived" status
      return matchesCategory && template.status !== TemplateStatus.ARCHIVED;
    }

    const matchesStatus = template.status === selectedStatus;
    return matchesCategory && matchesStatus;
  });

  const columns: Column<RequestTemplate>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      render: (_, template) => (
        <div>
          <div className="font-medium text-slate-900">{template.name}</div>
          {template.version > 1 && (
            <div className="text-xs text-slate-500">v{template.version}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      title: 'Category',
      sortable: true,
      render: (_, template) => <CategoryBadge category={template.category} />,
    },
    {
      key: 'requestType',
      title: 'Type',
      sortable: true,
    },
    {
      key: 'lifecycleConfiguration',
      title: 'Stages',
      render: (_, template) => (
        <span className="text-sm text-slate-600">
          {template.lifecycleConfiguration?.stages?.length || 0} stage{template.lifecycleConfiguration?.stages?.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (_, template) => <StatusBadge status={template.status} />,
    },
    {
      key: 'updatedAt',
      title: 'Updated',
      sortable: true,
      render: (value) => <span className="text-sm text-slate-600">{new Date(value).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, template) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEditTemplate(template)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicate(template)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteClick(template)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg">
        Error loading templates: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as RequestCategory | 'all')}
        >
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.values(RequestCategory).map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
            </SelectContent>
        </Select>

        <Select
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as TemplateStatus | 'all')}
        >
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.values(TemplateStatus).map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filteredTemplates}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search templates..."
        onRowClick={onEditTemplate}
        emptyState={
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <p className="mb-2">No templates found</p>
                <Button variant="link" onClick={onCreateTemplate}>
                    Create your first template
                </Button>
            </div>
        }
      />

      <DeleteTemplateDialog 
        isOpen={deleteDialogOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteDialogOpen(false);
            setTemplateToDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        templateName={templateToDelete?.name || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}