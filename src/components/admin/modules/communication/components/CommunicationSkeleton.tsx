import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * CommunicationSkeleton
 *
 * Mirrors the CommunicationModule layout:
 * - Header (title + History button + Transactional Emails button)
 * - 3-step stepper (Select Recipients → Compose → Review & Send)
 * - Step content area
 */

export function CommunicationSkeleton() {
  return (
    <div className="space-y-8 p-6 max-w-[1600px] mx-auto" role="status" aria-label="Loading communication">
      <span className="sr-only">Loading communication module, please wait…</span>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>
      </div>

      {/* Stepper */}
      <div className="w-full bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {[1, 2, 3].map((step, index) => (
            <div key={step} className="contents">
              <div className="flex flex-col items-center relative z-10">
                <Skeleton
                  className={`w-10 h-10 rounded-full ${step === 1 ? '' : 'bg-muted/50'}`}
                />
                <Skeleton className="h-3 w-24 mt-2" />
              </div>
              {index < 2 && (
                <div className="flex-1 h-[2px] mx-4 bg-gray-100" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content area */}
      <div className="min-h-[500px] space-y-6">
        {/* Recipient type selection */}
        <div className="rounded-lg border border-border bg-white p-6 space-y-4">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Recipient list area */}
        <div className="rounded-lg border border-border bg-white p-6 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}