import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../../../components/ui/alert-dialog";
import { AlertTriangle } from 'lucide-react';

interface DeleteTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateName: string;
  isDeleting?: boolean;
}

export function DeleteTemplateDialog({
  isOpen,
  onClose,
  onConfirm,
  templateName,
  isDeleting = false,
}: DeleteTemplateDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-red-600 mb-2">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete Request Template</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                Are you sure you want to delete <span className="font-semibold text-slate-900">"{templateName}"</span>?
              </p>
              <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-100">
                This action cannot be undone. Any new requests will no longer be able to use this template.
                Existing requests using this template will preserve their historical data.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
          >
            {isDeleting ? 'Deleting...' : 'Delete Template'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
