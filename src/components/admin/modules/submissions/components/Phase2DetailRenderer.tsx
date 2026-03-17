/**
 * Phase2DetailRenderer
 *
 * Structured, polished rendering of Phase 2 wizard submission data.
 * Replaces the generic flattened key-value display with labelled
 * sections, tag chips, and formatted values matching the platform's
 * visual language.
 *
 * Each vertical has its own section layout matching the wizard's
 * review step structure. Unknown verticals fall back to a smart
 * generic renderer that still filters noise.
 *
 * §7  — Presentation only; no business logic.
 * §8.3 — Status colours follow platform vocabulary.
 */

import React from 'react';
import {
  Shield, Stethoscope, TrendingUp, Target, Briefcase, FileText, Calculator,
  CheckCircle, AlertCircle, HelpCircle, DollarSign,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────────

interface Phase2Data {
  vertical?: string;
  phase?: number;
  [key: string]: unknown;
}

interface Phase2DetailRendererProps {
  productDetails: Phase2Data;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Filter keys that are machine-internal (IDs, metadata, phase markers) */
function isInternalKey(key: string): boolean {
  if (key === 'phase' || key === 'vertical' || key === 'metadata') return true;
  if (key.endsWith('_id') || key.endsWith('_ids')) return true;
  return false;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (value >= 1000) {
      const intPart = Math.round(value).toString();
      return `R${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }
    return String(value);
  }
  return String(value);
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return 'Adviser assistance requested';
  const n = Number(value);
  if (isNaN(n)) return String(value);
  const intPart = Math.round(n).toString();
  return `R${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ── Reusable UI Primitives ──────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        {Icon && <Icon className="h-4 w-4 text-gray-500" />}
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="px-4 py-3 space-y-0">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-xs font-medium text-gray-500 min-w-0 pr-3 flex-shrink-0">{label}</span>
      <span className={`text-sm text-right max-w-[60%] break-words leading-snug ${highlight ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 py-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-lg"
        >
          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
          {item}
        </span>
      ))}
    </div>
  );
}

function BooleanIndicator({ value, label }: { value: string; label: string }) {
  const isYes = value.toLowerCase() === 'yes';
  const isNo = value.toLowerCase() === 'no';
  const isNotSure = value.toLowerCase() === 'not sure';
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isYes ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : isNo ? 'bg-green-50 text-green-700 border border-green-200'
            : isNotSure ? 'bg-gray-100 text-gray-600 border border-gray-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}>
        {isYes ? <AlertCircle className="h-3 w-3" /> : isNo ? <CheckCircle className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
        {value}
      </span>
    </div>
  );
}

// ── Generic Section Renderer ────────────────────────────────────────────────────

function GenericSection({ title, icon, data }: {
  title: string;
  icon?: React.ElementType;
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(([k]) => !isInternalKey(k));
  if (entries.length === 0) return null;

  return (
    <SectionCard title={title} icon={icon}>
      {entries.map(([key, value]) => {
        if (Array.isArray(value)) {
          const strItems = value.filter((v): v is string => typeof v === 'string');
          if (strItems.length > 0) {
            return (
              <div key={key} className="py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs font-medium text-gray-500 block mb-1.5">{formatLabel(key)}</span>
                <TagList items={strItems} />
              </div>
            );
          }
        }
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return (
            <GenericSection key={key} title={formatLabel(key)} data={value as Record<string, unknown>} />
          );
        }
        const strVal = formatValue(value);
        const isBoolean = strVal === 'Yes' || strVal === 'No' || strVal === 'Not sure';
        if (isBoolean) {
          return <BooleanIndicator key={key} label={formatLabel(key)} value={strVal} />;
        }
        return <DetailRow key={key} label={formatLabel(key)} value={strVal} />;
      })}
    </SectionCard>
  );
}

// ── Vertical-Specific Renderers ─────────────────────────────────────────────────

function RiskRenderer({ pd }: { pd: Phase2Data }) {
  const riskNeeds = pd.risk_needs as Record<string, Record<string, unknown>> | undefined;
  const personal = pd.personal_details as Record<string, unknown> | undefined;
  const health = pd.health_disclosures as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {riskNeeds && (
        <SectionCard title="Selected Covers" icon={Shield}>
          {Object.entries(riskNeeds)
            .filter(([, v]) => v.selected)
            .map(([key, entry]) => {
              let val = 'Amount not specified';
              if (entry.adviser_assist) val = 'Adviser assistance requested';
              else if (entry.amount) val = formatCurrency(entry.amount);
              else if (entry.amount_per_month) val = `${formatCurrency(entry.amount_per_month)} /month`;
              return <DetailRow key={key} label={formatLabel(key)} value={val} highlight />;
            })}
        </SectionCard>
      )}
      {personal && <GenericSection title="Personal Details" icon={undefined} data={personal} />}
      {health && (
        <SectionCard title="Health Disclosures" icon={AlertCircle}>
          {health.has_conditions !== undefined && (
            <BooleanIndicator label="Pre-existing conditions" value={health.has_conditions ? 'Yes' : 'No'} />
          )}
          {Array.isArray(health.selected_conditions) && health.selected_conditions.length > 0 && (
            <div className="py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs font-medium text-gray-500 block mb-1.5">Conditions</span>
              <TagList items={health.selected_conditions as string[]} />
            </div>
          )}
          {health.free_text && <DetailRow label="Additional notes" value={String(health.free_text)} />}
        </SectionCard>
      )}
    </div>
  );
}

function MedicalAidRenderer({ pd }: { pd: Phase2Data }) {
  const members = pd.members as Record<string, unknown> | undefined;
  const preferences = pd.preferences as Record<string, unknown> | undefined;
  const history = pd.medical_aid_history as Record<string, unknown> | undefined;
  const health = pd.health as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {members && <GenericSection title="Membership Details" icon={Stethoscope} data={members} />}
      {preferences && <GenericSection title="Cover Preferences" icon={undefined} data={preferences} />}
      {history && <GenericSection title="Medical Aid History" icon={undefined} data={history} />}
      {health && <GenericSection title="Health & Chronic Conditions" icon={AlertCircle} data={health} />}
    </div>
  );
}

function InvestmentRenderer({ pd }: { pd: Phase2Data }) {
  const types = pd.selected_types as string[] | undefined;
  const contributions = pd.contributions as Record<string, Record<string, unknown>> | undefined;
  const objective = pd.objective as Record<string, unknown> | undefined;
  const financial = pd.financial_snapshot as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {types && types.length > 0 && (
        <SectionCard title="Investment Types" icon={TrendingUp}>
          <TagList items={types} />
        </SectionCard>
      )}
      {contributions && (
        <SectionCard title="Contribution Details" icon={DollarSign}>
          {Object.entries(contributions).map(([key, entry]) => {
            const parts: string[] = [];
            if (entry.contribution_type) parts.push(String(entry.contribution_type));
            const lump = entry.lump_sum as Record<string, unknown> | undefined;
            if (lump) {
              if (lump.adviser_assist) parts.push('Lump sum: Adviser assist');
              else if (lump.amount) parts.push(`Lump sum: ${formatCurrency(lump.amount)}`);
            }
            const monthly = entry.monthly as Record<string, unknown> | undefined;
            if (monthly) {
              if (monthly.adviser_assist) parts.push('Monthly: Adviser assist');
              else if (monthly.amount_per_month) parts.push(`Monthly: ${formatCurrency(monthly.amount_per_month)}`);
            }
            return <DetailRow key={key} label={formatLabel(key)} value={parts.join(' · ') || '—'} />;
          })}
        </SectionCard>
      )}
      {objective && <GenericSection title="Investment Objective" icon={Target} data={objective} />}
      {financial && <GenericSection title="Financial Snapshot" icon={DollarSign} data={financial} />}
    </div>
  );
}

function RetirementRenderer({ pd }: { pd: Phase2Data }) {
  const product = pd.selected_product as string | undefined;
  const funding = pd.funding as Record<string, unknown> | undefined;
  const timeline = pd.timeline as Record<string, unknown> | undefined;
  const financial = pd.financial_snapshot as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {product && (
        <SectionCard title="Retirement Product" icon={Target}>
          <DetailRow label="Selected product" value={product} highlight />
        </SectionCard>
      )}
      {funding && <GenericSection title="Funding Details" icon={DollarSign} data={funding} />}
      {timeline && <GenericSection title="Timeline" icon={Target} data={timeline} />}
      {financial && <GenericSection title="Financial Snapshot" icon={DollarSign} data={financial} />}
    </div>
  );
}

function EmployeeBenefitsRenderer({ pd }: { pd: Phase2Data }) {
  const business = pd.business as Record<string, unknown> | undefined;
  const benefitType = pd.benefit_type as string | undefined;
  const budget = pd.budget as Record<string, unknown> | undefined;
  const workforce = pd.workforce as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {(business || benefitType) && (
        <SectionCard title="Business Details" icon={Briefcase}>
          {benefitType && <DetailRow label="Benefit type" value={benefitType} highlight />}
          {business && Object.entries(business).filter(([k]) => !isInternalKey(k)).map(([k, v]) => (
            <DetailRow key={k} label={formatLabel(k)} value={formatValue(v)} />
          ))}
        </SectionCard>
      )}
      {budget && <GenericSection title="Budget & Contributions" icon={DollarSign} data={budget} />}
      {workforce && <GenericSection title="Workforce Profile" icon={undefined} data={workforce} />}
    </div>
  );
}

function EstatePlanningRenderer({ pd }: { pd: Phase2Data }) {
  const doc = pd.selected_document as string | undefined;
  const existing = pd.existing_documents as Record<string, unknown> | undefined;
  const context = pd.personal_context as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {doc && (
        <SectionCard title="Document Type" icon={FileText}>
          <DetailRow label="Selected document" value={doc} highlight />
        </SectionCard>
      )}
      {existing && <GenericSection title="Existing Documents" icon={undefined} data={existing} />}
      {context && <GenericSection title="Personal Context" icon={undefined} data={context} />}
    </div>
  );
}

function TaxPlanningRenderer({ pd }: { pd: Phase2Data }) {
  const types = pd.selected_types as string[] | undefined;
  const taxpayer = pd.taxpayer_context as Record<string, unknown> | undefined;
  const scope = pd.financial_scope as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {types && types.length > 0 && (
        <SectionCard title="Tax Submission Type(s)" icon={Calculator}>
          <TagList items={types} />
        </SectionCard>
      )}
      {taxpayer && <GenericSection title="Taxpayer Details" icon={undefined} data={taxpayer} />}
      {scope && (
        <SectionCard title="Financial Scope" icon={DollarSign}>
          {Object.entries(scope).filter(([k]) => !isInternalKey(k)).map(([k, v]) => {
            const strVal = formatValue(v);
            const isBool = strVal === 'Yes' || strVal === 'No' || strVal === 'Not sure';
            if (isBool) return <BooleanIndicator key={k} label={formatLabel(k)} value={strVal} />;
            return <DetailRow key={k} label={formatLabel(k)} value={strVal} />;
          })}
        </SectionCard>
      )}
    </div>
  );
}

// ── Fallback Generic Renderer ───────────────────────────────────────────────────

function GenericPhase2Renderer({ pd }: { pd: Phase2Data }) {
  const topLevelEntries = Object.entries(pd).filter(([k]) => !isInternalKey(k));
  const sections: React.ReactNode[] = [];
  const simpleFields: Array<{ key: string; value: string }> = [];

  topLevelEntries.forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const strItems = value.filter((v): v is string => typeof v === 'string');
      if (strItems.length > 0) {
        sections.push(
          <SectionCard key={key} title={formatLabel(key)}>
            <TagList items={strItems} />
          </SectionCard>
        );
      }
    } else if (value !== null && typeof value === 'object') {
      sections.push(
        <GenericSection key={key} title={formatLabel(key)} data={value as Record<string, unknown>} />
      );
    } else {
      simpleFields.push({ key, value: formatValue(value) });
    }
  });

  return (
    <div className="space-y-3">
      {simpleFields.length > 0 && (
        <SectionCard title="Details">
          {simpleFields.map((f) => (
            <DetailRow key={f.key} label={formatLabel(f.key)} value={f.value} />
          ))}
        </SectionCard>
      )}
      {sections}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────────

export function Phase2DetailRenderer({ productDetails }: Phase2DetailRendererProps) {
  const vertical = productDetails.vertical as string | undefined;

  switch (vertical) {
    case 'MedicalAid':
      return <MedicalAidRenderer pd={productDetails} />;
    case 'Investment':
      return <InvestmentRenderer pd={productDetails} />;
    case 'Retirement':
      return <RetirementRenderer pd={productDetails} />;
    case 'EmployeeBenefits':
      return <EmployeeBenefitsRenderer pd={productDetails} />;
    case 'EstatePlanning':
      return <EstatePlanningRenderer pd={productDetails} />;
    case 'TaxPlanning':
      return <TaxPlanningRenderer pd={productDetails} />;
    default:
      // Risk doesn't have vertical set, check for risk_needs
      if (productDetails.risk_needs) return <RiskRenderer pd={productDetails} />;
      return <GenericPhase2Renderer pd={productDetails} />;
  }
}

/**
 * Checks if a payload contains Phase 2 product details.
 */
export function isPhase2Payload(payload: Record<string, unknown>): boolean {
  const pd = payload.productDetails as Record<string, unknown> | undefined;
  return pd?.phase === 2;
}

/**
 * Extracts the Phase 2 product details from a submission payload.
 */
export function getPhase2Data(payload: Record<string, unknown>): Phase2Data | null {
  const pd = payload.productDetails as Phase2Data | undefined;
  if (pd?.phase === 2) return pd;
  return null;
}