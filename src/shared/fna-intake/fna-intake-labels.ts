import type { BatchFNAStatusItem } from './hooks/useFnaBatchStatus';

export type FnaHubView = 'results' | 'intake' | 'waiting' | 'start';

export function resolveFnaHubView(status: BatchFNAStatusItem['status'] | undefined): FnaHubView {
  switch (status) {
    case 'published':
      return 'results';
    case 'client_draft':
      return 'start';
    case 'submitted':
      return 'waiting';
    case 'draft':
      return 'waiting';
    default:
      return 'start';
  }
}

export function getFnaStatusLabel(
  status: BatchFNAStatusItem['status'],
  mode: 'client' | 'adviser',
): string {
  if (mode === 'client') {
    switch (status) {
      case 'published':
        return 'Complete';
      case 'client_draft':
        return 'Continue';
      case 'submitted':
        return 'With your adviser';
      case 'draft':
        return 'Under review';
      case 'error':
        return 'Unavailable';
      default:
        return 'Not started';
    }
  }

  switch (status) {
    case 'published':
      return 'Published';
    case 'client_draft':
      return 'Client draft';
    case 'submitted':
      return 'Review queue';
    case 'draft':
      return 'Draft';
    case 'error':
      return 'Error';
    default:
      return 'Not started';
  }
}

export function getFnaStatusDescription(
  status: BatchFNAStatusItem['status'],
  mode: 'client' | 'adviser',
  options?: { requestInfoAt?: string | null },
): string {
  if (mode === 'client') {
    if (status === 'client_draft' && options?.requestInfoAt) {
      return 'Your adviser needs more information. Please update your answers and submit again.';
    }
    switch (status) {
      case 'published':
        return 'Your published analysis is ready to view.';
      case 'client_draft':
        return 'Continue where you left off and submit when ready.';
      case 'submitted':
        return 'Submitted to your adviser — not advice until reviewed.';
      case 'draft':
        return 'Your adviser is reviewing your information.';
      default:
        return 'Start your financial discovery — we will analyse and publish formal advice after review.';
    }
  }

  switch (status) {
    case 'submitted':
      return 'Client submitted intake awaiting adviser review.';
    case 'client_draft':
      return options?.requestInfoAt
        ? 'Returned to client for more information.'
        : 'Client has started but not submitted intake.';
    default:
      return '';
  }
}
