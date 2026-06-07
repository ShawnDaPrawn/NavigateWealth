import { ComplianceActivity } from './complianceTypes';

export function ActivityDetailSummary({ activity }: { activity: ComplianceActivity }) {
  const d = activity.details as Record<string, string | number | boolean | null | undefined>;
  if (!d) return <span className="text-xs text-muted-foreground">—</span>;

  switch (activity.type) {
    case 'IDV Report':
    case 'IDV Report (Photo)':
      return (
        <span className="text-xs text-muted-foreground">
          {d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : 'Check completed'}
        </span>
      );

    case 'Bulk IDV':
      return (
        <span className="text-xs text-muted-foreground">
          {d.totalProcessed != null
            ? `${d.totalProcessed} processed, ${d.totalMatched ?? 0} matched`
            : 'Batch completed'}
        </span>
      );

    case 'Bank Verification':
      return (
        <span className="text-xs text-muted-foreground">
          {d.bankName ? `${d.bankName} — ` : ''}
          {d.verified ? 'Verified' : 'Check completed'}
        </span>
      );

    case 'Consumer Credit Check':
      return (
        <span className="text-xs text-muted-foreground">
          {d.creditScore ? `Score: ${d.creditScore}` : 'Check completed'}
        </span>
      );

    case 'Consumer Trace':
      return <span className="text-xs text-muted-foreground">Trace completed</span>;

    case 'Debt Review Enquiry':
      return (
        <span
          className={`text-xs font-medium ${d.isUnderDebtReview ? 'text-red-600' : 'text-green-600'}`}
        >
          {d.isUnderDebtReview === true
            ? 'Under debt review'
            : d.isUnderDebtReview === false
              ? 'Not under review'
              : 'Check completed'}
        </span>
      );

    case 'Sanctions Search':
      return (
        <span
          className={`text-xs font-medium ${
            d.screeningOutcome === 'Clear' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {d.screeningOutcome || 'Completed'}
          {d.totalMatches != null &&
            ` (${d.totalMatches} match${d.totalMatches !== 1 ? 'es' : ''})`}
        </span>
      );

    case 'Enforcement Actions Search':
    case 'Legal A Listing Search':
      return (
        <span
          className={`text-xs font-medium ${
            d.screeningOutcome === 'Clear' ? 'text-green-600' : 'text-amber-600'
          }`}
        >
          {d.screeningOutcome || 'Completed'}
          {d.totalMatches != null && ` (${d.totalMatches})`}
        </span>
      );

    case 'CIPC Search':
      return (
        <span className="text-xs text-muted-foreground">
          {d.companiesFound != null ? `${d.companiesFound} company(ies) found` : 'Search completed'}
        </span>
      );

    case 'Director Enquiry':
      return (
        <span className="text-xs text-muted-foreground">
          {d.directorshipsFound != null
            ? `${d.directorshipsFound} directorship(s)`
            : 'Enquiry completed'}
        </span>
      );

    case 'Best Known Address':
      return <span className="text-xs text-muted-foreground">Address lookup completed</span>;

    case 'CDD Report':
      return (
        <span className="text-xs text-muted-foreground">
          {d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : 'CDD report completed'}
        </span>
      );

    case 'Custom Screening':
      return (
        <span className="text-xs text-muted-foreground">
          {d.screeningOutcome || 'Screening completed'}
        </span>
      );

    case 'Lifestyle Audit':
      return (
        <span className="text-xs text-muted-foreground">
          {d.lifestyleScore != null ? `Score: ${d.lifestyleScore}` : ''}
          {d.estimatedIncome != null
            ? ` Est. income: R${Number(d.estimatedIncome).toLocaleString()}`
            : ''}
          {!d.lifestyleScore && !d.estimatedIncome ? 'Audit completed' : ''}
        </span>
      );

    case 'Income Predictor':
      return (
        <span className="text-xs text-muted-foreground">
          {d.estimatedIncome != null
            ? `Est. R${Number(d.estimatedIncome).toLocaleString()}/mo`
            : 'Prediction completed'}
          {d.confidenceLevel ? ` (${d.confidenceLevel})` : ''}
        </span>
      );

    case 'Tenders Blue Search':
      return (
        <span className="text-xs text-muted-foreground">
          {d.tendersFound != null ? `${d.tendersFound} tender record(s)` : 'Search completed'}
        </span>
      );

    case 'Risk Assessment':
      if (d.screeningOutcome) {
        return (
          <span className="text-xs">
            <strong>{d.screeningOutcome}</strong>
          </span>
        );
      }
      if (d.riskLevel) {
        return (
          <span
            className={`font-semibold text-xs ${
              d.riskLevel === 'Low'
                ? 'text-green-600'
                : d.riskLevel === 'Medium'
                  ? 'text-orange-600'
                  : 'text-red-600'
            }`}
          >
            Risk: {d.riskLevel}
          </span>
        );
      }
      if (d.assessmentName) {
        return <span className="text-xs text-muted-foreground">{d.assessmentName}</span>;
      }
      return <span className="text-xs text-muted-foreground">Assessment completed</span>;

    case 'Client Registration':
      return (
        <span className="text-xs text-muted-foreground">
          {d.registeredAt
            ? `Registered at ${new Date(d.registeredAt as string).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Registered'}
        </span>
      );

    default:
      return (
        <span className="text-xs text-muted-foreground">
          {d.matterId ? `Matter: ${String(d.matterId).substring(0, 8)}...` : '—'}
        </span>
      );
  }
}
