/**
 * Forms list of the resources Forms tab: loading/empty states, the rows
 * with selection, status badges and row actions, and the count footer.
 * Pure view over props from ResourcesModule.
 */
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  FileText,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckSquare,
  Square,
  Users,
  Mail,
} from 'lucide-react';

// Module imports
import { FormDefinition } from '../types';
import { getCategoryColor } from '../utils';
import { Skeleton } from '../../../../ui/skeleton';

// Phase 1 — Form status config
import { FORM_STATUS_CONFIG, type FormStatus } from '../builder/constants';
import type { FormFilters } from '../types';

// ---------------------------------------------------------------------------
// Heavy sub-components — lazy-loaded to reduce initial chunk size.
// These are only rendered on user action (edit, preview, tab switch).

interface FormsListProps {
  filteredForms: FormDefinition[];
  loading: boolean;
  filters: FormFilters;
  updateFilters: (newFilters: Partial<FormFilters>) => void;
  isSelectMode: boolean;
  selectedFormIds: Set<string>;
  toggleFormSelection: (formId: string) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  categoryCounts: Record<string, number>;
  handleQuickPreview: (form: FormDefinition) => void;
  handlePrefill: (formsToFill: FormDefinition[]) => void;
  handleEdit: (form: FormDefinition) => void;
  handleDelete: (form: FormDefinition) => void;
  duplicateResource: (id: string) => Promise<unknown>;
  updateResource: (
    id: string,
    updates: {
      title?: string;
      category?: string;
      description?: string;
      blocks?: unknown[];
      clientTypes?: string[];
      status?: string;
    },
  ) => Promise<unknown>;
}

export function FormsList({
  filteredForms,
  loading,
  filters,
  isSelectMode,
  selectedFormIds,
  toggleFormSelection,
  canCreate,
  canEdit,
  canDelete,
  categoryCounts,
  handleQuickPreview,
  handlePrefill,
  handleEdit,
  handleDelete,
  duplicateResource,
  updateResource,
}: FormsListProps) {
  return (
    <div>
      {loading ? (
        <div className="border rounded-lg divide-y bg-white">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
              <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-3 w-8 hidden lg:block" />
              <Skeleton className="h-3 w-16 hidden lg:block" />
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredForms.length > 0 ? (
        <div className="border rounded-lg divide-y bg-white">
          {filteredForms.map((form) => {
            const isSelected = selectedFormIds.has(form.id);
            return (
              <div
                key={form.id}
                className={`flex items-center gap-4 px-4 py-3 group hover:bg-gray-50/50 transition-colors ${
                  isSelected ? 'bg-primary/5' : ''
                }`}
              >
                {/* Selection checkbox */}
                {isSelectMode && (
                  <button onClick={() => toggleFormSelection(form.id)} className="shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-300 hover:text-gray-500" />
                    )}
                  </button>
                )}

                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    form.category === 'Letters' ? 'bg-violet-50' : 'bg-gray-100'
                  }`}
                >
                  {form.category === 'Letters' ? (
                    <Mail className="h-4 w-4 text-violet-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-500" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{form.name}</h3>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryColor(form.category)}`}
                    >
                      {form.category}
                    </Badge>
                    {/* Phase 1: Status badge */}
                    {form.status && FORM_STATUS_CONFIG[form.status as FormStatus] && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 ${FORM_STATUS_CONFIG[form.status as FormStatus].badgeClass}`}
                      >
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${FORM_STATUS_CONFIG[form.status as FormStatus].dotClass}`}
                        />
                        {FORM_STATUS_CONFIG[form.status as FormStatus].label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {form.description || 'No description'}
                  </p>
                </div>

                {/* Meta */}
                <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span>v{form.version}</span>
                  <span>{form.clientTypes[0] || 'Universal'}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleQuickPreview(form)}
                    title="Quick preview (empty data)"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-primary"
                    onClick={() => handlePrefill([form])}
                    title="Pre-fill with client data"
                  >
                    <Users className="h-3.5 w-3.5 mr-1" />
                    Pre-fill
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleEdit(form)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {/* Phase 1: Row-level actions menu (duplicate, status, delete) */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => handleEdit(form)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit in Builder
                        </DropdownMenuItem>
                      )}
                      {canCreate && (
                        <DropdownMenuItem onClick={() => duplicateResource(form.id)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <div className="contents">
                          <DropdownMenuSeparator />
                          {form.status !== 'published' && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateResource(form.id, { status: 'published' } as Record<
                                  string,
                                  unknown
                                >)
                              }
                            >
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {form.status !== 'draft' && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateResource(form.id, { status: 'draft' } as Record<
                                  string,
                                  unknown
                                >)
                              }
                            >
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                              Revert to Draft
                            </DropdownMenuItem>
                          )}
                          {form.status !== 'archived' && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateResource(form.id, { status: 'archived' } as Record<
                                  string,
                                  unknown
                                >)
                              }
                            >
                              <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </div>
                      )}
                      {canDelete && (
                        <div className="contents">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onClick={() => handleDelete(form)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground border rounded-lg bg-white">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No forms available</p>
          <p className="text-sm mt-1">
            {filters.search
              ? 'Try adjusting your search or filters'
              : 'Build a new form to get started'}
          </p>
        </div>
      )}

      {/* Count footer */}
      {!loading && filteredForms.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground px-1">
          <span>
            {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <span key={cat}>
                {cat}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
