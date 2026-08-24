/**
 * One view per compliance check type, from IDV through to the generic fallback.
 *
 * Split out of `ComplianceResultViewer.tsx` (1,486 lines), which held forty
 * named functions: the viewer, seventeen per-check result views, the primitives
 * they share, and an HTML report generator. Each was already self-contained.
 */
import { Badge } from '../../../../../../ui/badge';
import { CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import {
  DataRow,
  RawDataToggle,
  SectionHeader,
  StatBox,
  StatusIndicator,
} from './ResultPrimitives';
import { formatCurrency, formatDate, formatShortDate, num, str, toNode } from './complianceFormat';
import { type ComplianceCheckData, type HoneycombAddress } from './complianceTypes';

export function IdvResultView({
  data,
  hasPhoto,
}: {
  data: ComplianceCheckData;
  hasPhoto: boolean;
}) {
  return (
    <div className="space-y-3">
      <SectionHeader>Identity Verification Results</SectionHeader>
      <StatusIndicator pass={data.idVerified ?? data.verified} label="ID Verified" />
      {hasPhoto && <StatusIndicator pass={data.photoMatch} label="Photo Match" />}
      <DataRow label="Verification Status" value={data.verificationStatus || data.status} />
      {!!data.verificationDetails && (
        <div className="contents">
          {Object.entries(data.verificationDetails as Record<string, unknown>).map(([key, val]) => (
            <DataRow key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={String(val)} />
          ))}
        </div>
      )}
      {!!data.failureReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-red-700">
            <AlertOctagon className="h-3.5 w-3.5" />
            <span className="font-medium">Failure Reason:</span>
          </div>
          <p className="text-xs text-red-600 mt-1">{toNode(data.failureReason)}</p>
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function BulkIdvResultView({ data }: { data: ComplianceCheckData }) {
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
            <div
              key={i}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
            >
              <span className="font-medium">
                {String(r.firstName || '')} {String(r.surname || '')}
              </span>
              <Badge
                variant="outline"
                className={
                  r.status === 'matched' || r.matchResult === 'matched'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {toNode(r.status || r.matchResult || 'unknown')}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function BankVerificationResultView({ data }: { data: ComplianceCheckData }) {
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

export function CreditCheckResultView({ data }: { data: ComplianceCheckData }) {
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const judgments = Array.isArray(data.judgments) ? data.judgments : [];
  const defaults = Array.isArray(data.defaults) ? data.defaults : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Consumer Credit Report</SectionHeader>
      {data.creditScore != null && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">{toNode(data.creditScore)}</div>
          <div className="text-xs text-blue-600">Credit Score</div>
        </div>
      )}
      <DataRow label="Active Accounts" value={accounts.length} />
      <DataRow label="Judgments" value={judgments.length} />
      <DataRow label="Defaults" value={defaults.length} />
      <DataRow
        label="Enquiries"
        value={Array.isArray(data.enquiries) ? data.enquiries.length : 0}
      />
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

export function ConsumerTraceResultView({ data }: { data: ComplianceCheckData }) {
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
              {!!addr.source && <span className="text-gray-400 ml-1">({str(addr.source)})</span>}
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function DebtReviewResultView({ data }: { data: ComplianceCheckData }) {
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
          <span className="text-sm font-medium text-green-700">
            Client is NOT under debt review
          </span>
        </div>
      ) : null}
      <DataRow label="Debt Counsellor" value={data.debtCounsellor} />
      <DataRow
        label="Application Date"
        value={data.applicationDate ? formatShortDate(str(data.applicationDate)) : null}
      />
      <DataRow
        label="Status Date"
        value={data.statusDate ? formatShortDate(str(data.statusDate)) : null}
      />
      {Array.isArray(data.accounts) && data.accounts.length > 0 && (
        <DataRow label="Accounts Under Review" value={data.accounts.length} />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function SanctionsResultView({ data }: { data: ComplianceCheckData }) {
  const results = Array.isArray(data.results) ? data.results : [];
  const totalMatches = num(data.totalMatches ?? results.length);
  return (
    <div className="space-y-3">
      <SectionHeader>Sanctions Search Results</SectionHeader>
      {totalMatches === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">
            No sanctions matches found — Clear
          </span>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">
            {totalMatches} sanctions match{totalMatches !== 1 ? 'es' : ''} found
          </span>
        </div>
      )}
      <DataRow
        label="Lists Searched"
        value={Array.isArray(data.searchedLists) ? data.searchedLists.join(', ') : 'All'}
      />
      {results.length > 0 && (
        <div className="space-y-1 mt-2">
          {results.map((match: Record<string, unknown>, i: number) => (
            <div key={i} className="p-2 bg-red-50 border border-red-100 rounded text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-red-800">{toNode(match.name || 'Unknown')}</span>
                {match.matchScore != null && (
                  <Badge variant="outline" className="text-xs">
                    {toNode(match.matchScore)}% match
                  </Badge>
                )}
              </div>
              <DataRow label="Source" value={match.source} />
              <DataRow
                label="Listing Date"
                value={match.listingDate ? formatShortDate(match.listingDate) : null}
              />
            </div>
          ))}
        </div>
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function EnforcementResultView({ data }: { data: ComplianceCheckData }) {
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
        <div
          key={i}
          className="p-2 bg-amber-50 border border-amber-100 rounded text-xs space-y-0.5"
        >
          <DataRow label="Name" value={entry.name} />
          <DataRow label="Source" value={entry.source} />
          <DataRow label="Action Type" value={entry.actionType} />
          <DataRow
            label="Action Date"
            value={entry.actionDate ? formatShortDate(entry.actionDate) : null}
          />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

export function LegalAListingResultView({ data }: { data: ComplianceCheckData }) {
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
        <div
          key={i}
          className="p-2 bg-amber-50 border border-amber-100 rounded text-xs space-y-0.5"
        >
          <DataRow label="Case Number" value={entry.caseNumber} />
          <DataRow label="Court" value={entry.court} />
          <DataRow
            label="Judgment Date"
            value={entry.judgmentDate ? formatShortDate(entry.judgmentDate) : null}
          />
          <DataRow
            label="Amount"
            value={entry.amount != null ? formatCurrency(entry.amount) : null}
          />
          <DataRow label="Status" value={entry.status} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

export function CipcResultView({ data }: { data: ComplianceCheckData }) {
  const companies = Array.isArray(data.companies)
    ? data.companies
    : Array.isArray(data)
      ? data
      : [];
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
          <DataRow
            label="Reg. Date"
            value={c.registrationDate ? formatShortDate(c.registrationDate) : null}
          />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

export function DirectorResultView({ data }: { data: ComplianceCheckData }) {
  const directorships = Array.isArray(data.directorships)
    ? data.directorships
    : Array.isArray(data)
      ? data
      : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Director Enquiry</SectionHeader>
      <DataRow label="Directorships Found" value={directorships.length} />
      {directorships.map((d: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs space-y-0.5">
          <DataRow label="Company" value={d.companyName} />
          <DataRow label="Registration No." value={d.registrationNumber} />
          <DataRow label="Role" value={d.role} />
          <DataRow
            label="Appointed"
            value={d.appointmentDate ? formatShortDate(d.appointmentDate) : null}
          />
          <DataRow
            label="Resigned"
            value={d.resignationDate ? formatShortDate(d.resignationDate) : null}
          />
          <DataRow label="Status" value={d.status} />
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

export function AddressResultView({ data }: { data: ComplianceCheckData }) {
  const addresses = Array.isArray(data.addresses) ? data.addresses : [];
  const best = data.bestKnownAddress as HoneycombAddress | undefined;
  return (
    <div className="space-y-3">
      <SectionHeader>Address Report</SectionHeader>
      {!!best && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs">
          <span className="text-blue-700 font-medium block mb-1">Best Known Address</span>
          <span className="text-blue-800">
            {[best.line1, best.line2, best.suburb, best.city, best.province, best.postalCode]
              .filter(Boolean)
              .join(', ')}
          </span>
          {best.lastReported && (
            <span className="text-blue-500 block mt-0.5">
              Last reported: {formatShortDate(best.lastReported)}
            </span>
          )}
        </div>
      )}
      <DataRow label="Additional Addresses" value={addresses.length} />
      {addresses.map((addr: Record<string, unknown>, i: number) => (
        <div key={i} className="p-2 bg-gray-50 rounded text-xs">
          {[addr.line1, addr.line2, addr.suburb, addr.city, addr.province, addr.postalCode]
            .filter(Boolean)
            .join(', ')}
          {!!addr.source && <span className="text-gray-400 ml-1">({str(addr.source)})</span>}
        </div>
      ))}
      <RawDataToggle data={data} />
    </div>
  );
}

export function CustomScreeningResultView({ data }: { data: ComplianceCheckData }) {
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

export function LifestyleAuditResultView({ data }: { data: ComplianceCheckData }) {
  const properties = Array.isArray(data.properties) ? data.properties : [];
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
  return (
    <div className="space-y-3">
      <SectionHeader>Lifestyle Audit</SectionHeader>
      {data.lifestyleScore != null && (
        <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-700">{toNode(data.lifestyleScore)}</div>
          <div className="text-xs text-purple-600">Lifestyle Score</div>
        </div>
      )}
      <DataRow
        label="Estimated Income"
        value={data.estimatedIncome != null ? formatCurrency(data.estimatedIncome) : null}
      />
      <DataRow label="Properties" value={properties.length} />
      <DataRow label="Vehicles" value={vehicles.length} />
      {!!data.spendingProfile &&
        Object.keys(data.spendingProfile as Record<string, unknown>).length > 0 && (
          <div className="mt-1">
            <span className="text-xs font-medium text-gray-700 block mb-1">Spending Profile</span>
            {Object.entries(data.spendingProfile).map(([key, val]) => (
              <DataRow
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').trim()}
                value={String(val)}
              />
            ))}
          </div>
        )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function IncomePredictorResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Income Predictor</SectionHeader>
      {data.estimatedIncome != null && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">
            {formatCurrency(data.estimatedIncome)}
          </div>
          <div className="text-xs text-green-600">Estimated Monthly Income</div>
        </div>
      )}
      <DataRow label="Confidence" value={data.confidenceLevel} />
      {!!data.incomeRange && (
        <DataRow
          label="Income Range"
          value={`${formatCurrency((data.incomeRange as Record<string, unknown>).min)} – ${formatCurrency((data.incomeRange as Record<string, unknown>).max)}`}
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

export function TendersBlueResultView({ data }: { data: ComplianceCheckData }) {
  const tenders = Array.isArray(data.tenders) ? data.tenders : Array.isArray(data) ? data : [];
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

export function RiskAssessmentResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Risk Assessment</SectionHeader>
      <DataRow label="Assessment Name" value={data.assessmentName} />
      <DataRow label="Screening Outcome" value={data.screeningOutcome} />
      {!!data.riskLevel && (
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
              {toNode(data.riskLevel)}
            </Badge>
          }
        />
      )}
      <RawDataToggle data={data} />
    </div>
  );
}

export function RegistrationResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Client Registration</SectionHeader>
      <DataRow label="Honeycomb ID" value={data.honeycombId || data.uniqueId} />
      <DataRow
        label="Registered At"
        value={data.registeredAt ? formatDate(str(data.registeredAt)) : null}
      />
      <RawDataToggle data={data} />
    </div>
  );
}

export function GenericResultView({ data }: { data: ComplianceCheckData }) {
  return (
    <div className="space-y-3">
      <SectionHeader>Check Result</SectionHeader>
      <RawDataToggle data={data} defaultOpen />
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────
