/**
 * Shared atoms of the admin assets & liabilities section: the summary
 * metric tile and the detail chip.
 */

export function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'accent';
}) {
  const toneClasses =
    tone === 'positive'
      ? 'border-green-200 bg-green-50 text-green-900'
      : tone === 'negative'
        ? 'border-red-200 bg-red-50 text-red-900'
        : tone === 'accent'
          ? 'border-[#6d28d9]/20 bg-[#6d28d9]/5 text-[#4c1d95]'
          : 'border-gray-200 bg-gray-50 text-gray-900';

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/70">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-current">{value}</p>
    </div>
  );
}

export function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </span>
  );
}
