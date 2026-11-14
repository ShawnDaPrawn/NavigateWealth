/**
 * Forms list of the resources Forms tab: loading/empty states, the rows
 * with selection, status badges and row actions, and the count footer.
 * Pure view over props from ResourcesModule.
 */
import { cn } from '../../../../ui/utils';
import { DsButton, DsState } from '../../../layout/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

// Module imports
import { FormDefinition } from '../types';

import { Skeleton } from '../../../../ui/skeleton';

// Phase 1 — Form status config
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ds-card ds-card-b flex flex-col gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
              <div className="flex gap-1.5 pt-1.5">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredForms.length > 0 ? (
        // RE-Forms: a grid of form cards — kind pill, title, meta, then Preview /
        // Pre-fill / ⋯ — with a checkbox on each card in select mode.
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredForms.map((form) => {
            const isSelected = selectedFormIds.has(form.id);
            const isDraft = form.status === 'draft';
            const isLetter = form.category === 'Letters';
            const pill = isDraft
              ? { tone: '', label: 'Draft' }
              : form.status === 'archived'
                ? { tone: '', label: 'Archived' }
                : isLetter
                  ? { tone: 'info', label: 'Letter' }
                  : { tone: 'brand', label: form.category === 'Forms' ? 'Form' : form.category };
            return (
              <section
                key={form.id}
                className={cn(
                  'ds-card ds-card-b flex flex-col gap-2',
                  isSelected && 'border-nw-violet ring-1 ring-nw-violet',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('ds-pill', pill.tone)}>{pill.label}</span>
                  {isSelectMode && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--nw-violet)]"
                      checked={isSelected}
                      onChange={() => toggleFormSelection(form.id)}
                      aria-label={`Select ${form.name}`}
                    />
                  )}
                </div>
                <h3 className="text-[14px] font-semibold text-nw-ink">{form.name}</h3>
                <span className="ds-meta line-clamp-2">
                  {form.description ||
                    (isDraft
                      ? 'Not published yet'
                      : isLetter
                        ? 'Letter template'
                        : `v${form.version}`)}
                </span>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
                  <DsButton size="sm" onClick={() => handleQuickPreview(form)}>
                    Preview
                  </DsButton>
                  <DsButton size="sm" variant="primary" onClick={() => handlePrefill([form])}>
                    Pre-fill
                  </DsButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <DsButton
                        size="sm"
                        variant="ghost"
                        aria-label={`More actions for ${form.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </DsButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => handleEdit(form)}>
                          Edit in builder
                        </DropdownMenuItem>
                      )}
                      {canCreate && (
                        <DropdownMenuItem onClick={() => duplicateResource(form.id)}>
                          Duplicate
                        </DropdownMenuItem>
                      )}
                      {canEdit && (
                        <div className="contents">
                          <DropdownMenuSeparator />
                          {form.status !== 'published' && (
                            <DropdownMenuItem
                              onClick={() => updateResource(form.id, { status: 'published' })}
                            >
                              Publish
                            </DropdownMenuItem>
                          )}
                          {form.status !== 'draft' && (
                            <DropdownMenuItem
                              onClick={() => updateResource(form.id, { status: 'draft' })}
                            >
                              Revert to draft
                            </DropdownMenuItem>
                          )}
                          {form.status !== 'archived' && (
                            <DropdownMenuItem
                              onClick={() => updateResource(form.id, { status: 'archived' })}
                            >
                              Archive
                            </DropdownMenuItem>
                          )}
                        </div>
                      )}
                      {canDelete && (
                        <div className="contents">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-700 focus:text-red-700"
                            onClick={() => handleDelete(form)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <DsState title={filters.search ? 'No forms match your search' : 'No forms available'} />
      )}

      {/* Count footer */}
      {!loading && filteredForms.length > 0 && (
        <div className="ds-meta mt-3 flex items-center justify-between px-1">
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
