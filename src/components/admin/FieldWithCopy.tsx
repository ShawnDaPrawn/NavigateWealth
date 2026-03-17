import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { copyToClipboard } from '../../utils/clipboard';

interface FieldWithCopyProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  value: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
}

export function FieldWithCopy({ 
  id, 
  value, 
  onChange, 
  disabled, 
  type = 'text', 
  placeholder,
  className,
  ...props
}: FieldWithCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const textToCopy = value !== undefined && value !== null ? String(value) : '';
      
      if (!textToCopy) {
        toast.error('Nothing to copy');
        return;
      }

      await copyToClipboard(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        type={type}
        placeholder={placeholder}
        className={`pr-10 ${className || ''}`}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        tabIndex={-1}
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400 hover:text-gray-600" />
        )}
      </Button>
    </div>
  );
}