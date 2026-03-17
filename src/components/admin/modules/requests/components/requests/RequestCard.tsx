import React from 'react';
import { 
  Archive, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle,
  MoveRight,
  ChevronRight,
  FileText,
  Shield
} from 'lucide-react';
import { Request, RequestStatus, RequestPriority } from '../../types';
import { CategoryBadge } from '../shared/CategoryBadge';
import { Button } from '../../../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../../ui/dropdown-menu';

interface RequestCardProps {
  request: Request;
  onView: () => void;
  onMove?: (status: RequestStatus) => void;
  onArchive?: () => void;
  showMoveActions?: boolean;
  showArchiveAction?: boolean;
  availableStatuses?: RequestStatus[];
}

export function RequestCard({
  request,
  onView,
  onMove,
  onArchive,
  showMoveActions = false,
  showArchiveAction = false,
  availableStatuses = [],
}: RequestCardProps) {
  // Priority colors
  const priorityColors = {
    [RequestPriority.LOW]: 'bg-slate-100 text-slate-600 border-slate-200',
    [RequestPriority.MEDIUM]: 'bg-blue-100 text-blue-700 border-blue-200',
    [RequestPriority.HIGH]: 'bg-orange-100 text-orange-700 border-orange-200',
    [RequestPriority.URGENT]: 'bg-red-100 text-red-700 border-red-200',
  };

  // Status labels for move actions
  const statusLabels = {
    [RequestStatus.NEW]: 'New',
    [RequestStatus.IN_COMPLIANCE_REVIEW]: 'In Review',
    [RequestStatus.IN_LIFECYCLE]: 'In Progress',
    [RequestStatus.IN_SIGN_OFF]: 'In Sign-Off',
    [RequestStatus.COMPLETED]: 'Complete',
    [RequestStatus.ON_HOLD]: 'Hold',
    [RequestStatus.CANCELLED]: 'Cancel',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get current lifecycle stage name (simplified for display)
  const getCurrentStageName = () => {
    if (request.lifecycle?.currentStageId) {
      // In production, this would look up the actual stage name from the template
      return request.lifecycle.currentStageId.replace(/_/g, ' ');
    }
    return null;
  };

  const isNew = request.status === RequestStatus.NEW;
  const isPending = [
    RequestStatus.IN_COMPLIANCE_REVIEW,
    RequestStatus.IN_LIFECYCLE,
    RequestStatus.IN_SIGN_OFF,
    RequestStatus.ON_HOLD
  ].includes(request.status);
  const isCompleted = request.status === RequestStatus.COMPLETED;

  // Check if compliance is required
  const hasComplianceApproval = request.complianceApproval?.required;
  const hasComplianceSignOff = request.complianceSignOff?.required;

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
      onClick={onView}
    >
      {/* Header with Priority Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 mb-1 line-clamp-1">
            {request.clientName || request.requestDetails?.subject || 'Untitled Request'}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{request.id}</span>
          </div>
        </div>
        
        <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${priorityColors[request.priority]}`}>
          {request.priority}
        </span>
      </div>

      {/* Template Name */}
      <div className="flex items-center gap-2 text-xs">
        <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-slate-600 truncate">{request.templateId}</span>
      </div>

      {/* ====================================================================
          NEW LANE: Show readiness indicators
          ==================================================================== */}
      {isNew && (
        <div className="space-y-2">
          {hasComplianceApproval && (
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1.5 rounded">
              <Shield className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Compliance approval required</span>
            </div>
          )}
          <div className="text-xs text-slate-500">
            Ready to start lifecycle
          </div>
        </div>
      )}

      {/* ====================================================================
          PENDING LANE: Show current stage and operational info
          ==================================================================== */}
      {isPending && (
        <div className="space-y-2">
          {/* Current Lifecycle Stage */}
          {getCurrentStageName() && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 font-medium capitalize truncate">
                {getCurrentStageName()}
              </span>
            </div>
          )}
          
          {/* Assignees */}
          {request.assignees && request.assignees.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 truncate">
                {request.assignees[0].userName}
                {request.assignees.length > 1 && ` +${request.assignees.length - 1}`}
              </span>
            </div>
          )}

          {/* On Hold indicator */}
          {request.status === RequestStatus.ON_HOLD && (
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1.5 rounded">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>On Hold</span>
            </div>
          )}

          {/* SLA Warning for Urgent items */}
          {request.priority === RequestPriority.URGENT && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Urgent - Needs attention</span>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          COMPLETED LANE: Show completion info
          ==================================================================== */}
      {isCompleted && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1.5 rounded">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Completed {request.finalisedAt && formatDate(request.finalisedAt)}</span>
          </div>
          {request.finalisedBy && (
            <div className="text-xs text-slate-500">
              By {request.finalisedBy}
            </div>
          )}
        </div>
      )}

      {/* Updated timestamp */}
      <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
        Updated {formatDate(request.updatedAt)}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 flex-1"
          onClick={onView}
        >
          View Details
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>

        <div className="flex items-center gap-1">
          {/* Move dropdown */}
          {showMoveActions && onMove && availableStatuses.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <MoveRight className="h-3.5 w-3.5 mr-1" />
                  Move
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableStatuses.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onMove(status)}
                  >
                    {statusLabels[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Archive button */}
          {showArchiveAction && onArchive && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-slate-600 hover:text-red-600 hover:border-red-300"
              onClick={onArchive}
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              Archive
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}