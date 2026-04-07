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

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Loader2,
  Download,
  ExternalLink,
  Shield,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  UserCheck,
  Landmark,
  CreditCard,
  Search,
  FileText,
  Building2,
  MapPin,
  Users,
  Home,
  TrendingUp,
  ClipboardList,
  Gavel,
  Scale,
  Camera,
  X,
} from 'lucide-react';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';
import { BASE_PDF_CSS } from '../../../resources/templates/BasePdfLayout';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../../../../../utils/pdfPrintTitle';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Common address shape used across Honeycomb results */
interface HoneycombAddress {
  line1?: string;
  line2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  source?: string;
  lastReported?: string;
}

/** Compliance check result data — Record base allows unknown provider fields */
type ComplianceCheckData = Record<string, unknown>;

interface ComplianceActivity {
  id: string;
  type: string;
  date: string;
  status: string;
  details?: Record<string, unknown>;
}

interface CheckResult {
  id: string;
  checkType: string;
  clientId: string;
  matterId: string | null;
  submittedAt: string;
  status: string;
  summary: string;
  rawResponse: Record<string, unknown>;
}

interface ComplianceResultViewerProps {
  open: boolean;
  onClose: () => void;
  activity: ComplianceActivity | null;
  clientId: string;
  clientName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

/**
 * Maps the activity `type` string (from logActivity) to the KV checkType
 * used in honeycomb_checks storage.
 */
const ACTIVITY_TYPE_TO_CHECK_TYPE: Record<string, string> = {
  'IDV Report': 'idv_no_photo',
  'IDV Report (Photo)': 'idv_with_photo',
  'Bulk IDV': 'idv_bulk',
  'Bank Verification': 'bank_verification',
  'Consumer Credit Check': 'consumer_credit',
  'Consumer Trace': 'consumer_trace',
  'Debt Review Enquiry': 'debt_enquiry',
  'CIPC Search': 'cipc',
  'Director Enquiry': 'director_enquiry',
  'Best Known Address': 'best_known_address',
  'Custom Screening': 'custom_screening',
  'Sanctions Search': 'sanctions_search',
  'Enforcement Actions Search': 'enforcement_actions',
  'Legal A Listing Search': 'legal_a_listing',
  'Lifestyle Audit': 'lifestyle_audit',
  'Income Predictor': 'income_predictor',
  'Tenders Blue Search': 'tenders_blue',
  'Risk Assessment': 'assessment',
  'Client Registration': 'registration',
};

/** Icon mapping for each activity type */
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  'IDV Report': <UserCheck className="h-5 w-5 text-blue-600" />,
  'IDV Report (Photo)': <Camera className="h-5 w-5 text-purple-600" />,
  'Bulk IDV': <Users className="h-5 w-5 text-indigo-600" />,
  'Bank Verification': <Landmark className="h-5 w-5 text-green-600" />,
  'Consumer Credit Check': <CreditCard className="h-5 w-5 text-blue-600" />,
  'Consumer Trace': <Search className="h-5 w-5 text-indigo-600" />,
  'Debt Review Enquiry': <FileText className="h-5 w-5 text-amber-600" />,
  'CIPC Search': <Building2 className="h-5 w-5 text-purple-600" />,
  'Director Enquiry': <Users className="h-5 w-5 text-purple-600" />,
  'Best Known Address': <MapPin className="h-5 w-5 text-emerald-600" />,
  'Custom Screening': <Shield className="h-5 w-5 text-blue-600" />,
  'Sanctions Search': <Shield className="h-5 w-5 text-purple-600" />,
  'Enforcement Actions Search': <Gavel className="h-5 w-5 text-red-600" />,
  'Legal A Listing Search': <Scale className="h-5 w-5 text-amber-600" />,
  'Lifestyle Audit': <Home className="h-5 w-5 text-purple-600" />,
  'Income Predictor': <TrendingUp className="h-5 w-5 text-green-600" />,
  'Tenders Blue Search': <ClipboardList className="h-5 w-5 text-blue-600" />,
  'Risk Assessment': <ClipboardList className="h-5 w-5 text-green-600" />,
  'Client Registration': <UserCheck className="h-5 w-5 text-purple-600" />,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(val: number | undefined | null): string {
  if (val == null) return '—';
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}.${decPart}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

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
      const authToken = await getAuthToken();
      const res = await fetch(`${API_BASE}/checks/history/${clientId}/${checkType}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch check history (${res.status})`);
      }

      const data = await res.json();
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
          const bestDiff = best ? Math.abs(new Date(best.submittedAt).getTime() - activityTime) : Infinity;
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
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
              <strong className="text-slate-800">Honeycomb Information Services</strong>{' '}
              via Beeswax platform
            </span>
          </div>
          <Badge variant="outline" className="text-xs border-slate-300 text-slate-500">
            Third Party
          </Badge>
        </div>

        <Separator />

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-gray-800 mb-2">{children}</h4>;
}

function DataRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between py-1.5 border-b border-gray-100 last:border-0 ${className || ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  );
}

function StatusIndicator({ pass, label }: { pass: boolean | undefined | null; label: string }) {
  if (pass == null) return <DataRow label={label} value="—" />;
  return (
    <DataRow
      label={label}
      value={
        <div className="flex items-center gap-1">
          {pass ? (
            <div className="contents">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span className="text-green-700">Pass</span>
            </div>
          ) : (
            <div className="contents">
              <AlertTriangle className="h-3 w-3 text-red-600" />
              <span className="text-red-700">Fail</span>
            </div>
          )}
        </div>
      }
    />
  );
}

function IdvResultView({ data, hasPhoto }: { data: ComplianceCheckData; hasPhoto: boolean }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Identity Verification Results</SectionHeader>
      <StatusIndicator pass={data.idVerified ?? data.verified} label="ID Verified" />
      {hasPhoto && <StatusIndicator pass={data.photoMatch} label="Photo Match" />}
      <DataRow label="Verification Status" value={data.verificationStatus || data.status} />
      {data.verificationDetails && (
        <div className="contents">
          {Object.entries(data.verificationDetails).map(([key, val]) => (
            <DataRow key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={String(val)} />
          ))}
        </div>
      )}
      {data.failureReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-red-700">
            <AlertOctagon className="h-3.5 w-3.5" />
            <span className="font-medium">Failure Reason:</span>
          </div>
          <p className="text-xs text-red-600 mt-1">{data.failureReason}</p>
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function BulkIdvResultView({ data }: { data: ComplianceCheckData }) {
  const results = Array.isArray(data.results) ? data.results : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Bulk IDV Results</SectionHeader>
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatBox label="Processed" value={data.totalProcessed ?? results.length} colour="blue" />
        <StatBox label="Matched" value={data.totalMatched ?? 0} colour="green" />
        <StatBox label="Failed" value={data.totalFailed ?? 0} colour="red" />
      </div>
      {results.length > 0 && (
        <div className="space-y-1 mt-2">
          {results.map((r: Record<string, unknown>, i: number) => (
            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
              <span className="font-medium">{String(r.firstName || '')} {String(r.surname || '')}</span>
              <Badge
                variant="outline"
                className={
                  r.status === 'matched' || r.matchResult === 'matched'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {r.status || r.matchResult || 'unknown'}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function BankVerificationResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Bank Account Verification</SectionHeader>
      <StatusIndicator pass={data.verified ?? data.accountExists} label="Account Verified" />
      <StatusIndicator pass={data.accountOpen} label="Account Open" />
      <StatusIndicator pass={data.nameMatch} label="Name Match" />
      <DataRow label="Account Holder" value={data.accountHolderName} />
      <DataRow label="Bank" value={data.bankName} />
      <DataRow label="Branch Code" value={data.branchCode} />
      <RawDataToggle data={data} />
    </div>
  );
}

function CreditCheckResultView({ data }: { data: ComplianceCheckData }) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const judgments = Array.isArray(data.judgments) ? data.judgments : [];
  const defaults = Array.isArray(data.defaults) ? data.defaults : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Consumer Credit Report</SectionHeader>
      {data.creditScore != null && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">{data.creditScore}</div>
          <div className="text-xs text-blue-600">Credit Score</div>
        </div>
      )}
      <DataRow label="Active Accounts" value={accounts.length} />
      <DataRow label="Judgments" value={judgments.length} />
      <DataRow label="Defaults" value={defaults.length} />
      <DataRow label="Enquiries" value={Array.isArray(data.enquiries) ? data.enquiries.length : 0} />
      {judgments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {judgments.length} judgment(s) on file
          </div>
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function ConsumerTraceResultView({ data }: { data: ComplianceCheckData }) {
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];
  const employers = Array.isArray(data.employers) ? data.employers : [];
  const contacts = Array.isArray(data.contactNumbers) ? data.contactNumbers : [];
  const emails = Array.isArray(data.emailAddresses) ? data.emailAddresses : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Consumer Trace Results</SectionHeader>
      <DataRow label="Addresses Found" value={addresses.length} />
      <DataRow label="Employers Found" value={employers.length} />
      <DataRow label="Contact Numbers" value={contacts.length} />
      <DataRow label="Email Addresses" value={emails.length} />
      {addresses.length > 0 && (
        <div className="space-y-1 mt-2">
          <span className="text-xs font-medium text-gray-700">Addresses:</span>
          {addresses.slice(0, 5).map((addr: Record<string, unknown>, i: number) => (
            <div key={i} className="p-2 bg-gray-50 rounded text-xs">
              {[addr.line1, addr.line2, addr.suburb, addr.city, addr.province, addr.postalCode]
                .filter(Boolean)
                .join(', ')}
              {addr.source && <span className="text-gray-400 ml-1">({addr.source})</span>}
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function DebtReviewResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Debt Review Enquiry</SectionHeader>
      {data.isUnderDebtReview === true ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">Client is under debt review</span>
        </div>
      ) : data.isUnderDebtReview === false ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Client is NOT under debt review</span>
        </div>
      ) : null}
      <DataRow label="Debt Counsellor" value={data.debtCounsellor} />
      <DataRow label="Application Date" value={data.applicationDate ? formatShortDate(data.applicationDate) : null} />
      <DataRow label="Status Date" value={data.statusDate ? formatShortDate(data.statusDate) : null} />
      {Array.isArray(data.accounts) && data.accounts.length > 0 && (
        <DataRow label="Accounts Under Review" value={data.accounts.length} />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function SanctionsResultView({ data }: { data: ComplianceCheckData }) {
  const results = Array.isArray(data.results) ? data.results : [];
  const totalMatches = data.totalMatches ?? results.length;
  return (
    <div className="space-y-3">
      <SectionHeader>Sanctions Search Results</SectionHeader>
      {totalMatches === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">No sanctions matches found — Clear</span>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">
            {totalMatches} sanctions match{totalMatches !== 1 ? 'es' : ''} found
          </span>
        </div>
      )}
      <DataRow label="Lists Searched" value={Array.isArray(data.searchedLists) ? data.searchedLists.join(', ') : 'All'} />
      {results.length > 0 && (
        <div className="space-y-1 mt-2">
          {results.map((match: Record<string, unknown>, i: number) => (
            <div key={i} className="p-2 bg-red-50 border border-red-100 rounded text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-red-800">{match.name || 'Unknown'}</span>
                {match.matchScore != null && (
                  <Badge variant="outline" className="text-xs">{match.matchScore}% match</Badge>
                )}
              </div>
              <DataRow label="Source" value={match.source} />
              <DataRow label="Listing Date" value={match.listingDate ? formatShortDate(match.listingDate) : null} />
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function EnforcementResultView({ data }: { data: ComplianceCheckData }) {
  const results = Array.isArray(data.results) ? data.results : [];
  const total = data.totalMatches ?? results.length;
  return (
    <div className="space-y-3">
      <SectionHeader>Enforcement Actions</SectionHeader>
      <DataRow label="Total Matches" value={total} />
      {total === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs text-green-700">No enforcement actions found</span>
        </div>
      )}
      {results.map((entry: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-amber-50 border border-amber-100 rounded text-xs space-y-0.5">
          <DataRow label="Name" value={entry.name} />
          <DataRow label="Source" value={entry.source} />
          <DataRow label="Action Type" value={entry.actionType} />
          <DataRow label="Action Date" value={entry.actionDate ? formatShortDate(entry.actionDate) : null} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function LegalAListingResultView({ data }: { data: ComplianceCheckData }) {
  const results = Array.isArray(data.results) ? data.results : [];
  const total = data.totalMatches ?? results.length;
  return (
    <div className="space-y-3">
      <SectionHeader>Legal A Listing Search</SectionHeader>
      <DataRow label="Total Matches" value={total} />
      {total === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs text-green-700">No legal listings found</span>
        </div>
      )}
      {results.map((entry: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-amber-50 border border-amber-100 rounded text-xs space-y-0.5">
          <DataRow label="Case Number" value={entry.caseNumber} />
          <DataRow label="Court" value={entry.court} />
          <DataRow label="Judgment Date" value={entry.judgmentDate ? formatShortDate(entry.judgmentDate) : null} />
          <DataRow label="Amount" value={entry.amount != null ? formatCurrency(entry.amount) : null} />
          <DataRow label="Status" value={entry.status} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function CipcResultView({ data }: { data: ComplianceCheckData }) {
  const companies = Array.isArray(data.companies) ? data.companies : (Array.isArray(data) ? data : []);
  return (
    <div className="space-y-3">
      <SectionHeader>CIPC Company Search</SectionHeader>
      <DataRow label="Companies Found" value={companies.length} />
      {companies.map((c: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs space-y-0.5">
          <DataRow label="Company Name" value={c.companyName} />
          <DataRow label="Registration No." value={c.registrationNumber} />
          <DataRow label="Status" value={c.status} />
          <DataRow label="Type" value={c.type} />
          <DataRow label="Reg. Date" value={c.registrationDate ? formatShortDate(c.registrationDate) : null} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function DirectorResultView({ data }: { data: ComplianceCheckData }) {
  const directorships = Array.isArray(data.directorships) ? data.directorships : (Array.isArray(data) ? data : []);
  return (
    <div className="space-y-3">
      <SectionHeader>Director Enquiry</SectionHeader>
      <DataRow label="Directorships Found" value={directorships.length} />
      {directorships.map((d: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs space-y-0.5">
          <DataRow label="Company" value={d.companyName} />
          <DataRow label="Registration No." value={d.registrationNumber} />
          <DataRow label="Role" value={d.role} />
          <DataRow label="Appointed" value={d.appointmentDate ? formatShortDate(d.appointmentDate) : null} />
          <DataRow label="Resigned" value={d.resignationDate ? formatShortDate(d.resignationDate) : null} />
          <DataRow label="Status" value={d.status} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function AddressResultView({ data }: { data: ComplianceCheckData }) {
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];
  const best = data.bestKnownAddress;
  return (
    <div className="space-y-3">
      <SectionHeader>Address Report</SectionHeader>
      {best && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
          <span className="text-blue-700 font-medium block mb-1">Best Known Address</span>
          <span className="text-blue-800">
            {[best.line1, best.line2, best.suburb, best.city, best.province, best.postalCode]
              .filter(Boolean)
              .join(', ')}
          </span>
          {best.lastReported && (
            <span className="text-blue-500 block mt-0.5">Last reported: {formatShortDate(best.lastReported)}</span>
          )}
        </div>
      )}
      <DataRow label="Additional Addresses" value={addresses.length} />
      {addresses.map((addr: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 rounded text-xs">
          {[addr.line1, addr.line2, addr.suburb, addr.city, addr.province, addr.postalCode]
            .filter(Boolean)
            .join(', ')}
          {addr.source && <span className="text-gray-400 ml-1">({addr.source})</span>}
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function CustomScreeningResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Custom Screening</SectionHeader>
      <DataRow label="Screening Outcome" value={data.screeningOutcome} />
      <DataRow label="Package" value={data.packageName} />
      {Array.isArray(data.screeningResults) && data.screeningResults.length > 0 && (
        <DataRow label="Result Items" value={data.screeningResults.length} />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function LifestyleAuditResultView({ data }: { data: ComplianceCheckData }) {
  const properties = Array.isArray(data.properties) ? data.properties : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Lifestyle Audit</SectionHeader>
      {data.lifestyleScore != null && (
        <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-700">{data.lifestyleScore}</div>
          <div className="text-xs text-purple-600">Lifestyle Score</div>
        </div>
      )}
      <DataRow label="Estimated Income" value={data.estimatedIncome != null ? formatCurrency(data.estimatedIncome) : null} />
      <DataRow label="Properties" value={properties.length} />
      <DataRow label="Vehicles" value={vehicles.length} />
      {data.spendingProfile && Object.keys(data.spendingProfile).length > 0 && (
        <div className="mt-1">
          <span className="text-xs font-medium text-gray-700 block mb-1">Spending Profile</span>
          {Object.entries(data.spendingProfile).map(([key, val]) => (
            <DataRow key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={String(val)} />
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function IncomePredictorResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Income Predictor</SectionHeader>
      {data.estimatedIncome != null && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">{formatCurrency(data.estimatedIncome)}</div>
          <div className="text-xs text-green-600">Estimated Monthly Income</div>
        </div>
      )}
      <DataRow label="Confidence" value={data.confidenceLevel} />
      {data.incomeRange && (
        <DataRow
          label="Income Range"
          value={`${formatCurrency(data.incomeRange.min)} – ${formatCurrency(data.incomeRange.max)}`}
        />
      )}
      <DataRow label="Methodology" value={data.methodology} />
      {Array.isArray(data.factors) && data.factors.length > 0 && (
        <DataRow label="Contributing Factors" value={data.factors.length} />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function TendersBlueResultView({ data }: { data: ComplianceCheckData }) {
  const tenders = Array.isArray(data.tenders) ? data.tenders : (Array.isArray(data) ? data : []);
  return (
    <div className="space-y-3">
      <SectionHeader>Tenders Blue List</SectionHeader>
      <DataRow label="Tenders Found" value={tenders.length} />
      {tenders.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs text-green-700">No tender records found</span>
        </div>
      )}
      {tenders.map((t: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs space-y-0.5">
          <DataRow label="Tender No." value={t.tenderNumber} />
          <DataRow label="Description" value={t.description} />
          <DataRow label="Department" value={t.department} />
          <DataRow label="Value" value={t.value != null ? formatCurrency(t.value) : null} />
          <DataRow label="Award Date" value={t.awardDate ? formatShortDate(t.awardDate) : null} />
          <DataRow label="Status" value={t.status} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

function RiskAssessmentResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Risk Assessment</SectionHeader>
      <DataRow label="Assessment Name" value={data.assessmentName} />
      <DataRow label="Screening Outcome" value={data.screeningOutcome} />
      {data.riskLevel && (
        <DataRow
          label="Risk Level"
          value={
            <Badge
              variant="outline"
              className={
                data.riskLevel === 'Low'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : data.riskLevel === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }
            >
              {data.riskLevel}
            </Badge>
          }
        />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

function RegistrationResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Client Registration</SectionHeader>
      <DataRow label="Honeycomb ID" value={data.honeycombId || data.uniqueId} />
      <DataRow label="Registered At" value={data.registeredAt ? formatDate(data.registeredAt) : null} />
      <RawDataToggle data={data} />
    </div>
  );
}

function GenericResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Check Result</SectionHeader>
      <RawDataToggle data={data} defaultOpen />
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────

function StatBox({ label, value, colour }: { label: string; value: number; colour: string }) {
  const colours: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-2 ${colours[colour] || colours.blue}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function RawDataToggle({ data, defaultOpen = false }: { data: ComplianceCheckData; defaultOpen?: boolean }) {
  const [show, setShow] = React.useState(defaultOpen);
  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <FileText className="h-3 w-3" />
        {show ? 'Hide' : 'View'} raw provider data
      </button>
      {show && (
        <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── HTML Report Generator (BasePdfLayout template) ───────────────────────────

/**
 * Generates a single-check compliance report HTML using the base PDF template
 * structure (masthead, branded header, numbered sections, repeating print
 * footer). Content uses CSS page-break rules so it flows across pages without
 * bleeding over the footer.
 */
function generateReportHtml(activity: ComplianceActivity, result: CheckResult, clientName: string): string {
  const now = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const issueDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const performedAt = formatDate(result.submittedAt);
  const raw = result.rawResponse;

  // Build a summary section based on activity type
  let summaryHtml = '';
  switch (activity.type) {
    case 'IDV Report':
    case 'IDV Report (Photo)':
      summaryHtml = `
        <tr><th>ID Verified</th><td>${raw?.idVerified ?? raw?.verified ?? '\u2014'}</td></tr>
        ${activity.type.includes('Photo') ? `<tr><th>Photo Match</th><td>${raw?.photoMatch ?? '\u2014'}</td></tr>` : ''}
        <tr><th>Verification Status</th><td>${raw?.verificationStatus ?? raw?.status ?? '\u2014'}</td></tr>
        ${raw?.failureReason ? `<tr><th>Failure Reason</th><td style="color:#dc2626">${raw.failureReason}</td></tr>` : ''}
      `;
      break;
    case 'Bank Verification':
      summaryHtml = `
        <tr><th>Account Verified</th><td>${raw?.verified ?? raw?.accountExists ?? '\u2014'}</td></tr>
        <tr><th>Account Open</th><td>${raw?.accountOpen ?? '\u2014'}</td></tr>
        <tr><th>Name Match</th><td>${raw?.nameMatch ?? '\u2014'}</td></tr>
        <tr><th>Account Holder</th><td>${raw?.accountHolderName ?? '\u2014'}</td></tr>
        <tr><th>Bank</th><td>${raw?.bankName ?? '\u2014'}</td></tr>
      `;
      break;
    case 'Consumer Credit Check':
      summaryHtml = `
        <tr><th>Credit Score</th><td><strong>${raw?.creditScore ?? '\u2014'}</strong></td></tr>
        <tr><th>Active Accounts</th><td>${Array.isArray(raw?.accounts) ? raw.accounts.length : '\u2014'}</td></tr>
        <tr><th>Judgments</th><td>${Array.isArray(raw?.judgments) ? raw.judgments.length : '\u2014'}</td></tr>
        <tr><th>Defaults</th><td>${Array.isArray(raw?.defaults) ? raw.defaults.length : '\u2014'}</td></tr>
      `;
      break;
    case 'Sanctions Search':
      summaryHtml = `
        <tr><th>Matches Found</th><td style="color:${(raw?.totalMatches ?? 0) > 0 ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${raw?.totalMatches ?? 0}
        </td></tr>
        <tr><th>Lists Searched</th><td>${Array.isArray(raw?.searchedLists) ? raw.searchedLists.join(', ') : 'All'}</td></tr>
      `;
      break;
    case 'Debt Review Enquiry':
      summaryHtml = `
        <tr><th>Under Debt Review</th><td style="color:${raw?.isUnderDebtReview ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${raw?.isUnderDebtReview === true ? 'Yes' : raw?.isUnderDebtReview === false ? 'No' : '\u2014'}
        </td></tr>
        <tr><th>Debt Counsellor</th><td>${raw?.debtCounsellor ?? '\u2014'}</td></tr>
      `;
      break;
    default:
      summaryHtml = `<tr><th>Summary</th><td>${result.summary || '\u2014'}</td></tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(`${activity.type} \u2014 ${clientName}`))}</title>
  <style>
    ${BASE_PDF_CSS}

    /* ===== Single-report overrides for flowing layout ===== */

    .pdf-viewport {
      display: block;
      padding: 24px;
      background: #f3f4f6;
    }
    .pdf-page {
      height: auto;
      overflow: visible;
      max-width: 210mm;
      margin: 0 auto;
      page-break-after: auto;
      break-after: auto;
    }
    .pdf-content {
      height: auto;
      padding-bottom: 8mm;
    }

    /* On-screen footer is static */
    .pdf-footer {
      position: relative;
      bottom: auto;
      left: auto;
      right: auto;
      margin-top: 6mm;
    }

    /* Report sections avoid page-break inside */
    .report-section {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 5mm;
    }

    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-badge.completed { background: #dcfce7; color: #166534; }
    .status-badge.failed { background: #fef2f2; color: #991b1b; }

    /* Attribution callout */
    .report-attribution {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 6mm;
      padding: 3mm 4mm;
      background: var(--soft);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 8.5px;
      line-height: 1.5;
      color: #64748b;
    }
    .report-attribution strong { color: #334155; }

    /* Raw data section */
    .raw-data-section {
      break-inside: auto;
      page-break-inside: auto;
      margin-top: 5mm;
    }
    .raw-data-pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 3mm;
      border-radius: 4px;
      font-size: 8px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
    }

    /* Running footer for print */
    .running-footer {
      display: none;
    }

    @media print {
      @page {
        size: A4;
        margin: 12mm 10mm 28mm 10mm;
      }

      html, body {
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .no-print { display: none !important; }

      .pdf-viewport {
        padding: 0;
        background: transparent;
      }
      .pdf-page {
        box-shadow: none;
        border: none;
        max-width: none;
        width: auto;
      }
      .pdf-content {
        padding: 0;
      }

      .pdf-footer { display: none !important; }

      .running-footer {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 18mm;
        border-top: 1px solid var(--border);
        padding: 3mm 0 0 0;
        font-size: 8px;
        line-height: 1.35;
        color: var(--muted);
        background: #ffffff;
      }
      .running-footer .footer-row {
        display: flex;
        gap: 5mm;
        align-items: flex-start;
      }

      .top-masthead {
        display: flex;
        height: 15mm;
        border-bottom: 1px solid var(--border);
      }
    }
  </style>
</head>
<body>
  <!-- Print / Save button -->
  <div class="no-print" style="text-align:right;padding:12px 24px 0">
    <button onclick="window.print()" style="padding:8px 16px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500">
      Print / Save as PDF
    </button>
  </div>

  <div class="pdf-preview-container">
    <div class="pdf-viewport">
      <div class="pdf-page">
        <div class="pdf-content">

          <!-- MASTHEAD -->
          <div class="top-masthead">
            <div class="masthead-left">COMPLIANCE CHECK REPORT</div>
            <div class="masthead-right">
              <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
              Email: info@navigatewealth.co
            </div>
          </div>

          <!-- HEADER -->
          <header class="page-header-full">
            <div class="header-row">
              <div class="brand-block">
                <div class="logo">Navigate <span class="wealth">Wealth</span></div>
                <div class="brand-subline">Independent Financial Advisory Services</div>
              </div>
              <div class="doc-block">
                <h1 class="doc-title">${activity.type}</h1>
                <div class="meta-grid">
                  <div class="meta-k">Issue date</div>
                  <div class="meta-v">${issueDate}</div>
                  <div class="meta-k">Status</div>
                  <div class="meta-v">
                    <span class="status-badge ${result.status === 'completed' ? 'completed' : 'failed'}">${result.status}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <hr class="section-divider" style="border-top:2px solid #6b7280;margin:4mm 0 6mm 0" />

          <!-- SECTION 1: REPORT DETAILS -->
          <div class="section report-section">
            <div class="section-head">
              <span class="num">1</span>
              <h2>Report Details</h2>
            </div>
            <table>
              <tr><th>Client</th><td>${clientName}</td></tr>
              <tr><th>Check Type</th><td>${result.checkType.replace(/_/g, ' ')}</td></tr>
              ${result.matterId ? `<tr><th>Matter ID</th><td style="font-family:monospace;font-size:9px">${result.matterId}</td></tr>` : ''}
              <tr><th>Performed At</th><td>${performedAt}</td></tr>
              <tr><th>Verification Provider</th><td><strong>Honeycomb Information Services (Pty) Ltd</strong></td></tr>
              <tr><th>Platform</th><td>Beeswax Compliance Platform</td></tr>
            </table>
          </div>

          <!-- SECTION 2: RESULTS SUMMARY -->
          <div class="section report-section">
            <div class="section-head">
              <span class="num">2</span>
              <h2>Results Summary</h2>
            </div>
            <table>${summaryHtml}</table>
          </div>

          <!-- ATTRIBUTION -->
          <div class="report-attribution">
            <p style="margin:0 0 1mm 0"><strong>Independent Third-Party Verification</strong></p>
            <p style="margin:0">This report was generated from data provided by <strong>Honeycomb Information Services (Pty) Ltd</strong>,
            an independent South African bureau service provider. The verification was performed via the
            <strong>Beeswax</strong> compliance platform. Navigate Wealth acts as a consumer of this data and
            does not independently verify the information contained herein. All results are subject to the
            accuracy and completeness of the data held by the originating bureau(s).</p>
          </div>

          <!-- SECTION 3: FULL PROVIDER RESPONSE -->
          <div class="section raw-data-section" style="margin-top:5mm">
            <div class="section-head">
              <span class="num">3</span>
              <h2>Full Provider Response</h2>
            </div>
            <pre class="raw-data-pre">${JSON.stringify(raw, null, 2)}</pre>
          </div>

          <!-- ON-SCREEN FOOTER -->
          <footer class="pdf-footer">
            <div class="footer-row">
              <div class="footer-page">${activity.type}</div>
              <div class="footer-text">
                Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
                Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                For inquiries, please contact us at Tel: (012) 667 2505.
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  </div>

  <!-- RUNNING FOOTER (print only \u2014 repeats on every printed page) -->
  <div class="running-footer">
    <div class="footer-row">
      <div class="footer-page">${activity.type}</div>
      <div class="footer-text">
        Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider \u2013 FSP 54606.
        Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
        For inquiries, please contact us at Tel: (012) 667 2505.
      </div>
    </div>
  </div>
</body>
</html>`;
}