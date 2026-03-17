import React from 'react';
import { TemplateStatus, RequestStatus } from '../../types';

interface StatusBadgeProps {
  status: TemplateStatus | RequestStatus;
  size?: 'sm' | 'md';
}

const templateStatusColors: Record<TemplateStatus, string> = {
  [TemplateStatus.DRAFT]: 'bg-slate-100 text-slate-700',
  [TemplateStatus.ACTIVE]: 'bg-green-100 text-green-700',
  [TemplateStatus.ARCHIVED]: 'bg-gray-100 text-gray-700',
};

const requestStatusColors: Record<RequestStatus, string> = {
  [RequestStatus.NEW]: 'bg-blue-100 text-blue-700',
  [RequestStatus.IN_COMPLIANCE_REVIEW]: 'bg-yellow-100 text-yellow-700',
  [RequestStatus.IN_LIFECYCLE]: 'bg-purple-100 text-purple-700',
  [RequestStatus.IN_SIGN_OFF]: 'bg-orange-100 text-orange-700',
  [RequestStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [RequestStatus.ON_HOLD]: 'bg-amber-100 text-amber-700',
  [RequestStatus.CANCELLED]: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  
  const isTemplateStatus = Object.values(TemplateStatus).includes(status as TemplateStatus);
  const colorClass = isTemplateStatus 
    ? templateStatusColors[status as TemplateStatus]
    : requestStatusColors[status as RequestStatus];
  
  return (
    <span className={`inline-flex items-center rounded-full ${sizeClasses} ${colorClass}`}>
      {status}
    </span>
  );
}
