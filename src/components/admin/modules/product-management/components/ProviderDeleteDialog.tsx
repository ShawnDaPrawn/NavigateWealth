import React from 'react';
import { AlertTriangle, Building2, Trash2 } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { ImageWithFallback } from '../../../../figma/ImageWithFallback';
import { Provider, PRODUCT_CATEGORIES } from '../types';

interface ProviderDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function ProviderDeleteDialog({ 
  isOpen, 
  onClose, 
  provider, 
  onConfirm, 
  isDeleting 
}: ProviderDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-xl">Delete Provider</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {provider && (
          <div className="my-4 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-16 h-10 rounded bg-white border flex items-center justify-center overflow-hidden flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{provider.name}</p>
                  {provider.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {provider.description}
                    </p>
                  )}
                  {provider.categoryIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.categoryIds.map(catId => {
                        const category = PRODUCT_CATEGORIES.find(c => c.id === catId);
                        return category ? (
                          <Badge key={catId} variant="secondary" className="text-xs">
                            {category.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong className="font-semibold">Warning:</strong> Deleting this provider will remove it from all associated product categories and integrations. This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <div className="contents">
                <span className="mr-2">Deleting...</span>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="contents">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Provider
              </div>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}