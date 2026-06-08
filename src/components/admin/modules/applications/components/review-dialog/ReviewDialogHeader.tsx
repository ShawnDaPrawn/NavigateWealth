import { DialogTitle, DialogDescription } from '../../../../../ui/dialog';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Hash, Calendar, Mail, Pencil, X, Save, Loader2 } from 'lucide-react';
import { Application } from '../../types';
import { formatDate } from '../../utils';
import { StatusBadge } from '../StatusBadge';
import { ClientAvatar } from './shared';

interface ReviewDialogHeaderProps {
  selectedApplication: Application;
  fullName: string;
  preferredName?: string;
  firstName?: string;
  isActionable: boolean;
  isEditing: boolean;
  isSaving: boolean;
  amendedCount: number;
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSaveAmendments: () => void;
}

export function ReviewDialogHeader({
  selectedApplication,
  fullName,
  preferredName,
  firstName,
  isActionable,
  isEditing,
  isSaving,
  amendedCount,
  onEnterEditMode,
  onCancelEdit,
  onSaveAmendments,
}: ReviewDialogHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="h-1 bg-gradient-to-r from-[#6d28d9] via-purple-500 to-purple-400" />
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <ClientAvatar name={fullName || 'Unknown'} />
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {fullName || 'Unknown Applicant'}
                {preferredName && preferredName !== firstName && (
                  <span className="text-sm font-normal text-gray-400">"{preferredName}"</span>
                )}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {selectedApplication.application_number || selectedApplication.id.substring(0, 8)}
                </span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedApplication.submitted_at || selectedApplication.created_at)}
                </span>
                {selectedApplication.user_email && (
                  <span className="contents">
                    <span className="text-gray-300">|</span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedApplication.user_email}
                    </span>
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={selectedApplication.status} />
            {selectedApplication.origin === 'admin_import' && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200"
              >
                Admin Added
              </Badge>
            )}
            {selectedApplication.origin === 'admin_invite' && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium bg-indigo-50 text-indigo-700 border-indigo-200"
              >
                Invited
              </Badge>
            )}
          </div>
        </div>

        {isActionable && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 border-[#6d28d9]/30 text-[#6d28d9] hover:bg-[#6d28d9]/5"
                onClick={onEnterEditMode}
              >
                <Pencil className="h-3.5 w-3.5" />
                Amend Application
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-medium text-amber-700">Edit Mode</span>
                {amendedCount > 0 && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0">
                    {amendedCount} change{amendedCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}

            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={onCancelEdit}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8 bg-[#6d28d9] hover:bg-[#5b21b6]"
                  onClick={onSaveAmendments}
                  disabled={isSaving || amendedCount === 0}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save {amendedCount > 0 ? `(${amendedCount})` : ''}
                </Button>
              </div>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
