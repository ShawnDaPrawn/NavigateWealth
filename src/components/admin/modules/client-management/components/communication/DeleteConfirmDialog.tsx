/**
 * DeleteConfirmDialog — Destructive Action Confirmation
 *
 * Requires explicit user confirmation before deleting a communication.
 * Per §14.1 — destructive operations require confirmation.
 */

import React from 'react';
import { Button } from '../../../../../ui/button';
import { Alert, AlertDescription } from '../../../../../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Delete Communication
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm text-red-900">
              This action cannot be undone. The communication will be permanently
              removed from both admin and client views.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this communication?
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </div>
            ) : (
              <div className="contents">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Communication
              </div>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
