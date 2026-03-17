import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../ui/alert-dialog';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Input } from '../../ui/input';
import { Loader2, Archive } from 'lucide-react';

import type { PolicyRecord } from './PolicyTable';

interface ArchivePolicyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onArchive: (reason: string) => Promise<void>;
  isArchiving: boolean;
  policy: PolicyRecord | null;
}

const ARCHIVE_REASONS = [
  'Cancellation',
  'Maturity',
  'Replacement',
  'Lapsed',
  'Other',
];

export function ArchivePolicyDialog({
  isOpen,
  onClose,
  onArchive,
  isArchiving,
  policy,
}: ArchivePolicyDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');

  const handleArchive = () => {
    const finalReason = reason === 'Other' ? otherReason : reason;
    onArchive(finalReason);
  };

  const isReasonValid = reason && (reason !== 'Other' || otherReason.trim().length > 0);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Archive className="h-5 w-5" />
            <AlertDialogTitle className="text-amber-700">Archive Policy</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            You are about to archive <strong>{policy?.providerName}</strong>. 
            This will remove it from active calculations but keep a historical record.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reason for Archiving</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === 'Other' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label>Specify Reason</Label>
              <Input
                placeholder="Enter specific reason..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleArchive();
            }}
            disabled={!isReasonValid || isArchiving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isArchiving ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Archiving...
              </div>
            ) : (
              'Archive Policy'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}