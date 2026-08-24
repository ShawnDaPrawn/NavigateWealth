/**
 * Input/select field wrappers with copy-to-clipboard, used by the admin
 * client profile viewer cards. Moved verbatim from ClientProfileViewerFull.
 */
import React, { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';
import { FieldWithCopy } from '../../../../FieldWithCopy';
import { copyToClipboard } from '../../../../../../utils/clipboard';

// Wrapper component for input with copy button using the reusable FieldWithCopy
export const InputWithCopy = ({
  label,
  value,
  fieldName,
  id,
  ...inputProps
}: {
  label: string;
  value: string | number;
  fieldName: string;
  id?: string;
  [key: string]: unknown;
}) => {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <FieldWithCopy id={id ?? fieldName} {...inputProps} value={value} className="mt-1.5" />
    </div>
  );
};

// Wrapper component for select with copy button
export const SelectWithCopy = ({
  label,
  value,
  onValueChange,
  placeholder,
  children,
  id,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
  id: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (_e: React.MouseEvent) => {
    // Don't prevent default/propagation as it might interfere with clipboard operations
    // _e.preventDefault();
    // e.stopPropagation();

    try {
      const textToCopy = String(value || '');

      if (!textToCopy) {
        toast.error('Nothing to copy');
        return;
      }

      await copyToClipboard(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={id} className="pr-10">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            tabIndex={-1}
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
