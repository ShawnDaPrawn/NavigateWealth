import { Building2, Pencil, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { Button } from '../../../../ui/button';
import { ImageWithFallback } from '../../../../shared/ImageWithFallback';
import { Provider, getPortalAutomationCategoryOptions, getProductCategoryLabel } from '../types';

interface ProviderListProps {
  providers: Provider[];
  isLoading: boolean;
  onEdit: (provider: Provider) => void;
  /** Kept for callers that still offer delete from the row; the board puts it in the edit dialog. */
  onDelete?: (provider: Provider) => void;
  /** True when the list is empty because of a search, not because nothing exists. */
  isFiltered?: boolean;
  /** "Add provider" in the empty state. */
  onAdd?: () => void;
}

export function ProviderList({ providers, isLoading, onEdit, isFiltered, onAdd }: ProviderListProps) {
  if (!isLoading && providers.length === 0 && !isFiltered) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-nw-line bg-white px-6 py-14 text-center">
        <Building2 className="h-8 w-8 text-nw-text-3" aria-hidden="true" />
        <h2 className="text-base font-semibold text-nw-ink">No providers configured</h2>
        <p className="max-w-md text-sm text-nw-text-3">
          Add the product providers you work with. They are used in policies, FNAs and
          integrations.
        </p>
        {onAdd && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add provider
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-nw-line bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Logo</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead className="w-[90px] text-right">Products</TableHead>
            <TableHead className="w-[90px] text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Loading providers...
              </TableCell>
            </TableRow>
          ) : providers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No providers match your search.
              </TableCell>
            </TableRow>
          ) : (
            providers.map((provider, providerIndex) => {
              const categories = [
                ...new Set(getPortalAutomationCategoryOptions(provider.categoryIds)),
              ];
              return (
                <TableRow key={`${provider.id}-${providerIndex}`}>
                  <TableCell>
                    <div className="flex h-10 w-20 items-center justify-center overflow-hidden rounded border bg-gray-50">
                      {provider.logo ? (
                        <ImageWithFallback
                          src={provider.logo}
                          alt={provider.name}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-300" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-sm text-nw-text-2">
                    {categories.length > 0 ? (
                      categories.map(getProductCategoryLabel).join(' · ')
                    ) : (
                      <span className="text-xs text-muted-foreground">No products configured</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{categories.length}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(provider)}
                      aria-label={`Edit ${provider.name}`}
                    >
                      <Pencil className="h-4 w-4 text-gray-500" aria-hidden="true" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
