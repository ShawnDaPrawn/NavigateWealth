/**
 * SetupStepIndicator — the numbered/complete step chip used by the provider
 * setup sections. Moved verbatim from ProviderSetupTab.tsx.
 */
import { CheckCircle2 } from 'lucide-react';

export function SetupStepIndicator({
  complete,
  stepNumber,
}: {
  complete: boolean;
  stepNumber: number;
}) {
  return complete ? (
    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-label="Step complete" />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] font-medium text-gray-600">
      {stepNumber}
    </span>
  );
}
