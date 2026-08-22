/**
 * ComplianceResultViewer — Modal viewer for compliance check results.
 *
 * Fetches the full check result (including rawResponse) from the
 * check history, then renders a formatted, type-aware view with
 * third-party attribution (Honeycomb / Beeswax).
 *
 * Also provides a "Download Report" action that opens a printable
 * HTML document suitable for PDF export.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../../ui/dialog';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { ScrollArea } from '../../../../../ui/scroll-area';
import { Separator } from '../../../../../ui/separator';
import { Loader2, Download, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../../../../../../utils/api';
import { formatDate } from './resultViewer/complianceFormat';
import {
  ACTIVITY_TYPE_TO_CHECK_TYPE,
  type CheckResult,
  type ComplianceResultViewerProps,
} from './resultViewer/complianceTypes';
import { ACTIVITY_ICONS } from './resultViewer/activityIcons';
import { generateReportHtml } from './resultViewer/generateReportHtml';
import {
  AddressResultView,
  BankVerificationResultView,
  BulkIdvResultView,
  CipcResultView,
  ConsumerTraceResultView,
  CreditCheckResultView,
  CustomScreeningResultView,
  DebtReviewResultView,
  DirectorResultView,
  EnforcementResultView,
  GenericResultView,
  IdvResultView,
  IncomePredictorResultView,
  LegalAListingResultView,
  LifestyleAuditResultView,
  RegistrationResultView,
  RiskAssessmentResultView,
  SanctionsResultView,
  TendersBlueResultView,
} from './resultViewer/resultViews';

export function ComplianceResultViewer({
  open,
  onClose,
  activity,
  clientId,
  clientName,
}: ComplianceResultViewerProps) {
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = useCallback(async () => {
    if (!activity) return;

    const checkType = ACTIVITY_TYPE_TO_CHECK_TYPE[activity.type];
    if (!checkType) {
      setError(`No check type mapping for activity type "${activity.type}"`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCheckResult(null);

    try {
      const data = await api.get<{ history?: CheckResult[] }>(
        `/integrations/honeycomb/checks/history/${clientId}/${checkType}`,
      );
      const history: CheckResult[] = data.history || [];

      // Find the matching result by matterId or by closest timestamp
      const matterId = activity.details?.matterId || activity.details?.reportId;
      let matched: CheckResult | undefined;

      if (matterId) {
        matched = history.find((r) => r.matterId === matterId || r.id === matterId);
      }

      if (!matched) {
        // Fallback: find by closest timestamp
        const activityTime = new Date(activity.date).getTime();
        matched = history.reduce<CheckResult | undefined>((best, r) => {
          const diff = Math.abs(new Date(r.submittedAt).getTime() - activityTime);
          const bestDiff = best
            ? Math.abs(new Date(best.submittedAt).getTime() - activityTime)
            : Infinity;
          return diff < bestDiff ? r : best;
        }, undefined);
      }

      if (matched) {
        setCheckResult(matched);
      } else {
        setError('Check result not found. The result may have been archived.');
      }
    } catch (err: unknown) {
      console.error('[ComplianceResultViewer] Error fetching result:', err);
      setError(err instanceof Error ? err.message : 'Failed to load result');
    } finally {
      setIsLoading(false);
    }
  }, [activity, clientId]);

  useEffect(() => {
    if (open && activity) {
      fetchResult();
    } else {
      setCheckResult(null);
      setError(null);
    }
  }, [open, activity, fetchResult]);

  const handleDownload = () => {
    if (!checkResult || !activity) return;

    const reportHtml = generateReportHtml(activity, checkResult, clientName);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
    }
  };

  if (!activity) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {ACTIVITY_ICONS[activity.type] || <Shield className="h-5 w-5 text-gray-500" />}
              <div>
                <DialogTitle className="text-base font-semibold">{activity.type}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {formatDate(activity.date)}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                activity.status === 'Completed'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }
            >
              {activity.status}
            </Badge>
          </div>
        </DialogHeader>

        {/* Third-party attribution banner */}
        <div className="mx-6 mb-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs text-slate-600">
              Independent verification by{' '}
              <strong className="text-slate-800">Honeycomb Information Services</strong> via Beeswax
              platform
            </span>
          </div>
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
            Third Party
          </Badge>
        </div>

        <Separator />

        {/* Content */}
        <ScrollArea
          className="flex-1 px-6 py-4 overflow-y-auto"
          style={{ maxHeight: 'calc(90vh - 280px)' }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              <span className="text-xs text-muted-foreground">Loading check result...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-sm text-amber-700">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchResult} className="mt-2">
                Retry
              </Button>
            </div>
          ) : checkResult ? (
            <div className="space-y-4">
              {/* Matter & meta info */}
              <MetaSection result={checkResult} clientName={clientName} />

              <Separator />

              {/* Type-specific formatted view */}
              <FormattedResult activityType={activity.type} result={checkResult} />
            </div>
          ) : null}
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <DialogFooter className="p-4 flex-row gap-2 sm:justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Confidential — Navigate Wealth Admin</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!checkResult}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download Report
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Meta Section ─────────────────────────────────────────────────────────────

function MetaSection({ result, clientName }: { result: CheckResult; clientName: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div>
        <span className="text-muted-foreground">Client</span>
        <div className="font-medium mt-0.5">{clientName}</div>
      </div>
      <div>
        <span className="text-muted-foreground">Check Type</span>
        <div className="font-medium mt-0.5">{result.checkType.replace(/_/g, ' ')}</div>
      </div>
      {result.matterId && (
        <div>
          <span className="text-muted-foreground">Matter ID</span>
          <div className="font-mono mt-0.5 text-xs">{result.matterId}</div>
        </div>
      )}
      <div>
        <span className="text-muted-foreground">Performed</span>
        <div className="font-medium mt-0.5">{formatDate(result.submittedAt)}</div>
      </div>
      <div>
        <span className="text-muted-foreground">Result Status</span>
        <div className="mt-0.5">
          <Badge
            variant="outline"
            className={
              result.status === 'completed'
                ? 'bg-green-50 text-green-700 border-green-200'
                : result.status === 'failed'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
            }
          >
            {result.status}
          </Badge>
        </div>
      </div>
      <div>
        <span className="text-muted-foreground">Provider</span>
        <div className="font-medium mt-0.5">Honeycomb Information Services</div>
      </div>
    </div>
  );
}

// ─── Formatted Result ─────────────────────────────────────────────────────────

function FormattedResult({ activityType, result }: { activityType: string; result: CheckResult }) {
  const raw = result.rawResponse;
  if (!raw) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No detailed response data available for this check.
      </div>
    );
  }

  switch (activityType) {
    case 'IDV Report':
    case 'IDV Report (Photo)':
      return <IdvResultView data={raw} hasPhoto={activityType.includes('Photo')} />;
    case 'Bulk IDV':
      return <BulkIdvResultView data={raw} />;
    case 'Bank Verification':
      return <BankVerificationResultView data={raw} />;
    case 'Consumer Credit Check':
      return <CreditCheckResultView data={raw} />;
    case 'Consumer Trace':
      return <ConsumerTraceResultView data={raw} />;
    case 'Debt Review Enquiry':
      return <DebtReviewResultView data={raw} />;
    case 'Sanctions Search':
      return <SanctionsResultView data={raw} />;
    case 'Enforcement Actions Search':
      return <EnforcementResultView data={raw} />;
    case 'Legal A Listing Search':
      return <LegalAListingResultView data={raw} />;
    case 'CIPC Search':
      return <CipcResultView data={raw} />;
    case 'Director Enquiry':
      return <DirectorResultView data={raw} />;
    case 'Best Known Address':
      return <AddressResultView data={raw} />;
    case 'Custom Screening':
      return <CustomScreeningResultView data={raw} />;
    case 'Lifestyle Audit':
      return <LifestyleAuditResultView data={raw} />;
    case 'Income Predictor':
      return <IncomePredictorResultView data={raw} />;
    case 'Tenders Blue Search':
      return <TendersBlueResultView data={raw} />;
    case 'Risk Assessment':
      return <RiskAssessmentResultView data={raw} />;
    case 'Client Registration':
      return <RegistrationResultView data={raw} />;
    default:
      return <GenericResultView data={raw} />;
  }
}

// ─── Type-specific result views ───────────────────────────────────────────────

/**
 * Coerce an unknown value (from the untyped third-party rawResponse) into a
 * renderable ReactNode: React elements and primitives pass through unchanged;
 * plain objects are stringified instead of crashing React.
 */
