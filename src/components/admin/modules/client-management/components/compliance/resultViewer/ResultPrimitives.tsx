/**
 * The small pieces every result view is built from: headers, rows, status chips.
 *
 * Split out of `ComplianceResultViewer.tsx` (1,486 lines), which held forty
 * named functions: the viewer, seventeen per-check result views, the primitives
 * they share, and an HTML report generator. Each was already self-contained.
 */
import React from 'react';
import { CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { toNode } from './complianceFormat';
import { type ComplianceCheckData } from './complianceTypes';

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-gray-800 mb-2">{children}</h4>;
}

export function DataRow({
  label,
  value,
  className,
}: {
  label: string;
  value: unknown;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between py-1.5 border-b border-gray-100 last:border-0 ${className || ''}`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%]">{toNode(value) ?? '—'}</span>
    </div>
  );
}

export function StatusIndicator({ pass, label }: { pass: unknown; label: string }) {
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

export function StatBox({
  label,
  value,
  colour,
}: {
  label: string;
  value: unknown;
  colour: string;
}) {
  const colours: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-lg border p-2 ${colours[colour] || colours.blue}`}>
      <div className="text-lg font-bold">{toNode(value)}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

export function RawDataToggle({
  data,
  defaultOpen = false,
}: {
  data: ComplianceCheckData;
  defaultOpen?: boolean;
}) {
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
