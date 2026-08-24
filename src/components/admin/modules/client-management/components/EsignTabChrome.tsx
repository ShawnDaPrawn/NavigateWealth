/**
 * Presentational chrome of the client e-sign tab: the lazy-step fallback,
 * the wizard progress header, and the loading skeleton. Moved verbatim
 * from EsignTab.tsx.
 */
import { Loader2, Upload, Users, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { STAT_CONFIG } from './esignTabModel';

export function StepFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

// ==================== TYPES ====================

// ==================== WIZARD PROGRESS HEADER ====================

const WIZARD_STEPS = [
  { step: 1, label: 'Upload', icon: Upload },
  { step: 2, label: 'Recipients', icon: Users },
  { step: 3, label: 'Prepare', icon: FileText },
] as const;

interface WizardHeaderProps {
  currentStep: 1 | 2 | 3;
  title: string;
  subtitle: string;
  onCancel: () => void;
}

export function WizardHeader({ currentStep, title, subtitle, onCancel }: WizardHeaderProps) {
  return (
    <div className="space-y-5">
      {/* Back to list link */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to documents
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {WIZARD_STEPS.map((ws, idx) => {
          const StepIcon = ws.icon;
          const isActive = ws.step === currentStep;
          const isCompleted = ws.step < currentStep;
          return (
            <div key={ws.step} className="contents">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive
                      ? 'border-purple-600 bg-purple-50'
                      : isCompleted
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <StepIcon
                      className={`h-4 w-4 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}
                    />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-purple-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
                  }`}
                >
                  {ws.label}
                </span>
              </div>
              {idx < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 ${
                    ws.step < currentStep ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Title & subtitle */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-gray-900 leading-none">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ==================== SKELETON LOADING STATE ====================

export function EsignTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(Object.keys(STAT_CONFIG) as Array<keyof typeof STAT_CONFIG>).map((key) => {
          const cfg = STAT_CONFIG[key];
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${cfg.bgColor}`}>
                    <Skeleton className="h-4 w-4 rounded bg-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-[160px] rounded-md" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Signers</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-1.5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
