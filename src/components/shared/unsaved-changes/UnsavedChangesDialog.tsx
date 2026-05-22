import React from 'react';
import { AlertTriangle, Save, Activity } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import type { UnsavedChangesDialogProps } from './types';

export function UnsavedChangesDialog({
  open,
  message,
  isSaving,
  onStay,
  onDiscard,
  onSaveAndLeave,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg text-gray-900">Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-600 mt-1">
                {message}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={onStay}
            className="border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Stay on Page
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={isSaving}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Discard Changes
          </Button>
          <AlertDialogAction
            onClick={onSaveAndLeave}
            disabled={isSaving}
            className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white"
          >
            {isSaving ? (
              <div className="contents">
                <Activity className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </div>
            ) : (
              <div className="contents">
                <Save className="h-4 w-4 mr-2" />
                Save & Leave
              </div>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
