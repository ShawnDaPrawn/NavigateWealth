import { DsPill, type DsTone } from '../../../layout/page';
import { ApplicationStatus } from '../types';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

/** Application status as a board pill (AP-List). */
const STATUS_CONFIG: Record<string, { label: string; tone: DsTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Pending review', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  declined: { label: 'Rejected', tone: 'bad' },
  in_progress: { label: 'In progress', tone: 'info' },
  invited: { label: 'Invited', tone: 'brand' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['in_progress'];
  return <DsPill tone={config.tone}>{config.label}</DsPill>;
}
