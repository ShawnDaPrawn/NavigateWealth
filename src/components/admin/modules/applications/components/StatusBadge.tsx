import { Badge } from '../../../../ui/badge';
import { ApplicationStatus } from '../types';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

/**
 * Consistent status badge for applications.
 * Uses subtle semantic colours with a dot indicator — restrained palette
 * that avoids visual noise while still communicating state clearly.
 */
const STATUS_CONFIG: Record<string, { label: string; dotColor: string; className: string }> = {
  draft: {
    label: 'Draft',
    dotColor: 'bg-gray-400',
    className: 'bg-gray-50 text-gray-700 border border-gray-200/60',
  },
  submitted: {
    label: 'Pending Review',
    dotColor: 'bg-amber-500',
    className: 'bg-amber-50 text-amber-800 border border-amber-200/60',
  },
  approved: {
    label: 'Approved',
    dotColor: 'bg-emerald-500',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
  },
  declined: {
    label: 'Rejected',
    dotColor: 'bg-red-500',
    className: 'bg-red-50 text-red-800 border border-red-200/60',
  },
  in_progress: {
    label: 'In Progress',
    dotColor: 'bg-blue-500',
    className: 'bg-blue-50 text-blue-800 border border-blue-200/60',
  },
  invited: {
    label: 'Invited',
    dotColor: 'bg-purple-500',
    className: 'bg-purple-50 text-purple-800 border border-purple-200/60',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['in_progress'];

  return (
    <Badge className={`${config.className} font-medium text-xs gap-1.5 px-2.5 py-0.5`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </Badge>
  );
}