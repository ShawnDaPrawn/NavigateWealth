/**
 * The firm's own compliance assessment of a client: risk rating, sanctions
 * screening and KYC review dates. Staff only — the admin profile viewer renders
 * it; the client portal never does, and the edge function neither returns it to
 * the client nor accepts it from them.
 */
import { AlertOctagon, AlertTriangle, ClipboardCheck, Info } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import {
  CLIENT_RISK_RATING_OPTIONS,
  KYC_REVIEW_INTERVAL_MONTHS,
  SANCTIONS_RESULT_OPTIONS,
  complianceIndicators,
  suggestNextKycReviewDate,
  type ClientRiskRating,
  type ComplianceDeclarations,
  type ComplianceIndicator,
  type ComplianceReview,
  type SanctionsResult,
} from '../../../shared/compliance';
import { SectionHeader, SubHeading } from './fields';
import { todayIso } from './fieldHelpers';

const INDICATOR_STYLE: Record<
  ComplianceIndicator['level'],
  { className: string; Icon: typeof Info }
> = {
  alert: { className: 'border-red-200 bg-red-50 text-red-800', Icon: AlertOctagon },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertTriangle },
  info: { className: 'border-blue-200 bg-blue-50 text-blue-800', Icon: Info },
};

export function ComplianceIndicatorList({ indicators }: { indicators: ComplianceIndicator[] }) {
  if (indicators.length === 0) return null;
  return (
    <ul className="space-y-2">
      {indicators.map((indicator) => {
        const { className, Icon } = INDICATOR_STYLE[indicator.level];
        return (
          <li
            key={indicator.message}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${className}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{indicator.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ComplianceReviewCard({
  value,
  onChange,
  declarations,
}: {
  value: ComplianceReview;
  onChange: (next: ComplianceReview) => void;
  declarations: ComplianceDeclarations;
}) {
  const update = (patch: Partial<ComplianceReview>) => onChange({ ...value, ...patch });
  const suggestedNext = suggestNextKycReviewDate(value.lastKycReviewDate, value.riskRating);
  const indicators = complianceIndicators(declarations, value, todayIso());

  return (
    <Card>
      <SectionHeader
        icon={ClipboardCheck}
        title="Compliance review"
        description="The firm's assessment of this client. Staff only — never shown to the client."
      />
      <CardContent className="space-y-6">
        <ComplianceIndicatorList indicators={indicators} />

        <div className="space-y-4">
          <SubHeading hint="Rate the money-laundering and terrorist-financing risk under the firm's RMCP.">
            Client risk rating
          </SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="riskRating">Rating</Label>
              <Select
                value={value.riskRating}
                onValueChange={(v) =>
                  update({ riskRating: v as ClientRiskRating, riskRatedAt: todayIso() })
                }
              >
                <SelectTrigger id="riskRating" className="mt-1.5">
                  <SelectValue placeholder="Not rated" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_RISK_RATING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="riskRatedAt">Rated on</Label>
              <Input
                id="riskRatedAt"
                type="date"
                value={value.riskRatedAt}
                onChange={(e) => update({ riskRatedAt: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="riskRatingReason">Reason</Label>
              <Textarea
                id="riskRatingReason"
                value={value.riskRatingReason}
                onChange={(e) => update({ riskRatingReason: e.target.value })}
                placeholder="e.g. Salaried, SA resident only, no PEP exposure"
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <SubHeading hint="Record the result of the most recent screening against the sanctions lists.">
            Sanctions screening
          </SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="sanctionsResult">Result</Label>
              <Select
                value={value.sanctionsResult}
                onValueChange={(v) => update({ sanctionsResult: v as SanctionsResult })}
              >
                <SelectTrigger id="sanctionsResult" className="mt-1.5">
                  <SelectValue placeholder="Not screened" />
                </SelectTrigger>
                <SelectContent>
                  {SANCTIONS_RESULT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sanctionsScreenedAt">Screened on</Label>
              <Input
                id="sanctionsScreenedAt"
                type="date"
                value={value.sanctionsScreenedAt}
                onChange={(e) => update({ sanctionsScreenedAt: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="sanctionsReference">Reference</Label>
              <Input
                id="sanctionsReference"
                value={value.sanctionsReference}
                onChange={(e) => update({ sanctionsReference: e.target.value })}
                placeholder="Screening tool reference"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <SubHeading
            hint={`Default review cycle: high risk every ${KYC_REVIEW_INTERVAL_MONTHS.high} months, medium every ${KYC_REVIEW_INTERVAL_MONTHS.medium}, low every ${KYC_REVIEW_INTERVAL_MONTHS.low}.`}
          >
            KYC review
          </SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lastKycReviewDate">Last review</Label>
              <Input
                id="lastKycReviewDate"
                type="date"
                value={value.lastKycReviewDate}
                onChange={(e) => update({ lastKycReviewDate: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="nextKycReviewDate">Next review due</Label>
              <Input
                id="nextKycReviewDate"
                type="date"
                value={value.nextKycReviewDate}
                onChange={(e) => update({ nextKycReviewDate: e.target.value })}
                className="mt-1.5"
              />
              {suggestedNext && suggestedNext !== value.nextKycReviewDate && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-[#6d28d9]"
                  onClick={() => update({ nextKycReviewDate: suggestedNext })}
                >
                  Use {suggestedNext} (from the {value.riskRating} rating)
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="complianceNotes">Notes</Label>
            <Textarea
              id="complianceNotes"
              value={value.notes}
              onChange={(e) => update({ notes: e.target.value })}
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
