import { Check, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import type { SignerField } from '../types';

interface DropdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentField: SignerField | null;
  dropdownValue: string;
  onDropdownValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DropdownDialog({
  open,
  onOpenChange,
  currentField,
  dropdownValue,
  onDropdownValueChange,
  onSave,
  onCancel,
}: DropdownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChevronDown className="h-5 w-5 text-indigo-600" />
            Select an option
          </DialogTitle>
          <DialogDescription>
            {currentField?.metadata?.placeholder
              ? String(currentField.metadata.placeholder)
              : 'Choose one of the available options below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
          {((currentField?.metadata?.options as string[]) || []).map(
            (option: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => onDropdownValueChange(option)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all min-h-[44px] ${
                  dropdownValue === option
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ),
          )}
          {(!currentField?.metadata?.options ||
            (currentField.metadata.options as string[]).length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">
              No options configured for this field.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" className="h-11" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!dropdownValue}
            className="bg-indigo-600 hover:bg-indigo-700 h-11"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
