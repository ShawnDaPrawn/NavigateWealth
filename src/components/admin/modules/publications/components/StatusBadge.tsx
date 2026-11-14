/**
 * Publications Feature - StatusBadge Component
 *
 * Article status as a board pill (PU-Articles).
 */

import { cn } from '../../../../ui/utils';
import { STATUS_LABELS } from '../constants';
import type { ArticleStatus } from '../types';

interface StatusBadgeProps {
  status: ArticleStatus;
  className?: string;
}

const TONE: Record<ArticleStatus, string> = {
  draft: '',
  in_review: 'info',
  scheduled: 'brand',
  published: 'ok',
  archived: 'bad',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return <span className={cn('ds-pill', TONE[status], className)}>{STATUS_LABELS[status]}</span>;
}
