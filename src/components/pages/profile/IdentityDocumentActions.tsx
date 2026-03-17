import React from 'react';
import { Button } from '../../ui/button';
import { Check, X } from 'lucide-react';

interface IdentityDocumentActionsProps {
  isValid: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function IdentityDocumentActions({ isValid, onSave, onCancel }: IdentityDocumentActionsProps) {
  return (
    <div className="contents">
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        className="border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        <X className="h-4 w-4 mr-1" />
        Cancel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onSave}
        disabled={!isValid}
        className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}
      >
        <Check className="h-4 w-4 mr-1" />
        Save
      </Button>
    </div>
  );
}