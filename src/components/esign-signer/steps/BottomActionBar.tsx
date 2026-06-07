import { Loader2, Lock, ArrowRight, Check, XCircle, PauseCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';

interface BottomActionBarProps {
  isReading: boolean;
  isFieldsLocked: boolean;
  isSubmitting: boolean;
  allRequiredFieldsCompleted: boolean;
  phase: 'reading' | 'signing';
  progress: number;
  completedCount: number;
  requiredCount: number;
  primaryCtaLabel: string;
  primaryCtaTone: string;
  onPrimaryCta: () => void;
  onDecline: () => void;
  onPause: () => void;
}

export function BottomActionBar({
  isReading,
  isFieldsLocked,
  isSubmitting,
  allRequiredFieldsCompleted,
  phase,
  progress,
  completedCount,
  requiredCount,
  primaryCtaLabel,
  primaryCtaTone,
  onPrimaryCta,
  onDecline,
  onPause,
}: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)]">
      <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 flex items-center gap-2 md:gap-3">
        {/* Secondary actions — left */}
        <Button
          variant="ghost"
          onClick={onDecline}
          disabled={isSubmitting}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-12 px-2 md:px-3"
          aria-label="Decline to sign"
        >
          <XCircle className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline">Decline</span>
        </Button>

        {!isReading && (
          <Button
            variant="ghost"
            onClick={onPause}
            disabled={isSubmitting}
            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-12 px-2 md:px-3"
            aria-label="Save and finish later"
          >
            <PauseCircle className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline">Save & Finish later</span>
          </Button>
        )}

        {/* Mobile progress meter (compact) — only in signing mode */}
        {!isReading && (
          <div className="flex-1 min-w-0 md:hidden">
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
                {completedCount}/{requiredCount}
              </span>
            </div>
          </div>
        )}

        {/* Spacer (desktop only) — pushes the primary CTA to the right */}
        <div className="hidden md:block flex-1" />

        {/* PRIMARY CTA — always present, label & color reflect intent */}
        <Button
          onClick={onPrimaryCta}
          disabled={isFieldsLocked || isSubmitting}
          className={`h-12 px-4 md:px-6 text-sm md:text-base font-semibold shadow-md flex-1 md:flex-none md:min-w-[260px] ${primaryCtaTone}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Submitting…
            </>
          ) : isFieldsLocked ? (
            <>
              <Lock className="h-4 w-4 mr-1.5" />
              Locked
            </>
          ) : (
            <>
              <span className="truncate">{primaryCtaLabel}</span>
              {allRequiredFieldsCompleted && phase === 'signing' ? (
                <Check className="h-4 w-4 ml-1.5 flex-shrink-0" />
              ) : (
                <ArrowRight className="h-4 w-4 ml-1.5 flex-shrink-0" />
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
