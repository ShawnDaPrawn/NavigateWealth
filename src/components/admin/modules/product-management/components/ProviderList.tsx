import React from 'react';
import { Building2, Pencil, Trash2 } from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../../../ui/table';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { ImageWithFallback } from '../../../../figma/ImageWithFallback';
import { Provider, PRODUCT_CATEGORIES } from '../types';

interface ProviderListProps {
  providers: Provider[];
  isLoading: boolean;
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
}

export function ProviderList({ 
  providers, 
  isLoading, 
  onEdit, 
  onDelete 
}: ProviderListProps) {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Logo</TableHead>
            <TableHead>Provider Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Product Categories</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                Loading providers...
              </TableCell>
            </TableRow>
          ) : providers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No providers found.
              </TableCell>
            </TableRow>
          ) : (
            providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  <div className="w-20 h-10 rounded bg-gray-50 border flex items-center justify-center overflow-hidden">
                    {provider.logo ? (
                      <ImageWithFallback
                        src={provider.logo}
                        alt={provider.name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{provider.name}</TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {provider.description}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {provider.categoryIds.map(catId => {
                      const category = PRODUCT_CATEGORIES.find(c => c.id === catId);
                      return category ? (
                        <Badge key={catId} variant="secondary" className="text-xs font-normal">
                          {category.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(provider)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(provider)}
                      className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
