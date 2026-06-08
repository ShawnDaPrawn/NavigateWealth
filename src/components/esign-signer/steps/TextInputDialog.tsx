import { Check, Type } from 'lucide-react';
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
import type { SignerField } from '../types';

function maskSaId(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 6) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
}

interface TextInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentField: SignerField | null;
  textInput: string;
  onTextInputChange: (value: string) => void;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export function TextInputDialog({
  open,
  onOpenChange,
  currentField,
  textInput,
  onTextInputChange,
  error,
  onSave,
  onCancel,
}: TextInputDialogProps) {
  const meta = (currentField?.metadata ?? {}) as Record<string, unknown>;
  const fmt = (meta.format as string | undefined) ?? 'free_text';
  const customHelp = typeof meta.helpText === 'string' ? meta.helpText : '';
  const maxLength = typeof meta.maxLength === 'number' ? meta.maxLength : undefined;

  const titleByFormat: Record<string, string> = {
    sa_id: 'Enter SA ID number',
    number: 'Enter a number',
    email: 'Enter your email address',
    phone: 'Enter your phone number',
    custom_regex: 'Enter required value',
    free_text: 'Enter text',
  };
  const placeholderByFormat: Record<string, string> = {
    sa_id: '000000 0000 0 00',
    number: '0',
    email: 'name@example.com',
    phone: '+27 82 123 4567',
    custom_regex: 'Enter value...',
    free_text: 'Enter text...',
  };
  const inputModeByFormat: Record<string, 'text' | 'numeric' | 'email' | 'tel'> = {
    sa_id: 'numeric',
    number: 'numeric',
    email: 'email',
    phone: 'tel',
    custom_regex: 'text',
    free_text: 'text',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-5 w-5 text-indigo-600" />
            {titleByFormat[fmt] ?? 'Enter text'}
          </DialogTitle>
          <DialogDescription>
            {customHelp ||
              (fmt === 'sa_id'
                ? 'Type your 13-digit South African ID number.'
                : 'Type the requested information for this field.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="text-field-input">Value</Label>
            <Input
              id="text-field-input"
              inputMode={inputModeByFormat[fmt] ?? 'text'}
              value={fmt === 'sa_id' ? maskSaId(textInput) : textInput}
              maxLength={maxLength}
              onChange={(e) => {
                if (fmt === 'sa_id') {
                  onTextInputChange(e.target.value.replace(/\D/g, '').slice(0, 13));
                } else {
                  onTextInputChange(e.target.value);
                }
              }}
              placeholder={placeholderByFormat[fmt] ?? 'Enter text...'}
              className="text-base h-12"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.trim()) onSave();
              }}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" className="h-11" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!textInput.trim()}
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
