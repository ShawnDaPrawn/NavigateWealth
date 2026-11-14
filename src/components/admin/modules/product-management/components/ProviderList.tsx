import { Building2, MoreHorizontal, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { DsButton } from '../../../layout/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { Button } from '../../../../ui/button';
import { ImageWithFallback } from '../../../../shared/ImageWithFallback';
import { Provider, getPortalAutomationCategoryOptions, getProductCategoryLabel } from '../types';

interface ProviderListProps {
  providers: Provider[];
  isLoading: boolean;
  onEdit: (provider: Provider) => void;
  /** Delete from the row's ⋯ menu (PM-Providers). */
  onDelete?: (provider: Provider) => void;
  /** True when the list is empty because of a search, not because nothing exists. */
  isFiltered?: boolean;
  /** "Add provider" in the empty state. */
  onAdd?: () => void;
}

export function ProviderList({
  providers,
  isLoading,
  onEdit,
  onDelete,
  isFiltered,
  onAdd,
}: ProviderListProps) {
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[64px]">Logo</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead className="w-[90px]">Products</TableHead>
          <TableHead className="w-[110px]">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center text-nw-text-3">
              Loading providers…
            </TableCell>
          </TableRow>
        ) : providers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center text-nw-text-3">
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
                  {/* PM-Providers: a small rounded logo tile, initials when there is no logo */}
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-nw-violet-50 text-[11.5px] font-semibold text-nw-violet">
                    {provider.logo ? (
                      <ImageWithFallback
                        src={provider.logo}
                        alt={provider.name}
                        className="h-full w-full bg-white object-contain p-0.5"
                      />
                    ) : (
                      provider.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell>
                  <span className="ds-meta">
                    {categories.length > 0
                      ? categories.map(getProductCategoryLabel).join(' · ')
                      : 'No products configured'}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{categories.length}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <DsButton
                      size="sm"
                      onClick={() => onEdit(provider)}
                      aria-label={`Edit ${provider.name}`}
                    >
                      Edit
                    </DsButton>
                    {onDelete && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <DsButton
                            size="sm"
                            variant="ghost"
                            aria-label={`More actions for ${provider.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </DsButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-700 focus:text-red-700"
                            onSelect={() => onDelete(provider)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
