import { Badge } from '@/components/ui/badge';
import type { BatchFNAStatusItem } from '../hooks/useFnaBatchStatus';
import { getFnaStatusLabel } from '../fna-intake-labels';

const STATUS_STYLES: Record<BatchFNAStatusItem['status'], { badge: string }> = {
  published: { badge: 'bg-green-50 text-green-700 border-green-200' },
  draft: { badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  client_draft: { badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  submitted: { badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  not_started: { badge: 'bg-gray-50 text-gray-500 border-gray-200' },
  error: { badge: 'bg-red-50 text-red-600 border-red-200' },
};

export function FNAIntakeStatusBadge({
  status,
  mode = 'client',
}: {
  status: BatchFNAStatusItem['status'];
  mode?: 'client' | 'adviser';
}) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.not_started;
  return (
    <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-4.5 border ${style.badge}`}>
      {getFnaStatusLabel(status, mode)}
    </Badge>
  );
}
