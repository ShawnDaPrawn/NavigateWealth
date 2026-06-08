import { Check, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface DateInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateInput: string;
  onDateInputChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DateInputDialog({
  open,
  onOpenChange,
  dateInput,
  onDateInputChange,
  onSave,
  onCancel,
}: DateInputDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Select date
          </DialogTitle>
          <DialogDescription>Choose the date for this field.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="date-field-input">Date</Label>
            <Input
              id="date-field-input"
              type="date"
              value={dateInput}
              onChange={(e) => onDateInputChange(e.target.value)}
              className="text-base h-12"
              autoFocus
            />
            <Button
              variant="link"
              size="sm"
              className="text-indigo-600 p-0 h-auto"
              onClick={() => onDateInputChange(new Date().toISOString().split('T')[0])}
            >
              Use today's date
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" className="h-11" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!dateInput}
            className="bg-indigo-600 hover:bg-indigo-700 h-11"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
