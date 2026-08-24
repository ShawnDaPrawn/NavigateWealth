/**
 * The recipient strip: every signer with their colour, field count and filter.
 *
 *
 * Split out of `PrepareFormStudio.tsx` (1,529 lines), whose `return` held the
 * toolbar, recipient strip, bulk-action bar, canvas and five dialogs together.
 * Presentational — it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Filter } from 'lucide-react';
import type { SignerFormData } from '../../types';
import { SIGNER_COLORS } from '../../constants';

interface SignerLegendProps {
  clearSignerFilter: () => void;
  fieldCountsBySigner: Record<string, number>;
  selectedSignerId: string | undefined;
  setSelectedSignerId: Dispatch<SetStateAction<string | undefined>>;
  signers: SignerFormData[];
  toggleSignerFilter: (email: string) => void;
  visibleSignerIds: Set<string> | null;
}

export function SignerLegend({
  clearSignerFilter,
  fieldCountsBySigner,
  selectedSignerId,
  setSelectedSignerId,
  signers,
  toggleSignerFilter,
  visibleSignerIds,
}: SignerLegendProps) {
  return (
    <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
      <span className="text-xs uppercase tracking-wider text-gray-400 mr-1 shrink-0">Signers</span>
      {signers.map((signer, idx) => {
        const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
        const isCC = signer.kind === 'cc';
        const isWitness = signer.kind === 'witness';
        const isVisible = !visibleSignerIds || visibleSignerIds.has(signer.email);
        const isFiltering = !!visibleSignerIds && visibleSignerIds.size > 0;
        const count = fieldCountsBySigner[signer.email] ?? 0;
        const isActive = selectedSignerId === signer.email;
        return (
          <div
            key={signer.email}
            className={[
              'inline-flex items-center gap-1 rounded-full border text-xs transition shrink-0 overflow-hidden',
              isCC ? 'opacity-60 border-gray-200' : 'border-gray-200',
              isFiltering && !isVisible ? 'opacity-40' : '',
              isFiltering && isVisible ? 'border-purple-300 bg-purple-50' : '',
              isActive ? 'ring-2 ring-purple-400/60' : '',
            ].join(' ')}
          >
            <button
              type="button"
              disabled={isCC}
              onClick={() => {
                if (isCC) return;
                toggleSignerFilter(signer.email);
              }}
              className={[
                'inline-flex items-center gap-2 px-2.5 py-1',
                isCC ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50',
              ].join(' ')}
              title={
                isCC ? `${signer.name} — Receives a copy` : `Filter to ${signer.name}'s fields`
              }
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/5"
                style={{ backgroundColor: color }}
              />
              <span className="truncate max-w-[120px] font-medium text-gray-700">
                {signer.name}
              </span>
              {isCC && (
                <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-1">CC</span>
              )}
              {isWitness && (
                <span className="text-[10px] uppercase tracking-wide text-amber-600 ml-1">
                  Witness
                </span>
              )}
            </button>
            {!isCC && count > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSignerId(signer.email);
                }}
                className={[
                  'text-[10px] tabular-nums px-1.5 py-1 rounded-r-full',
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
                title={`${count} field${count === 1 ? '' : 's'} — click to place fields for ${signer.name}`}
              >
                {count}
              </button>
            )}
            {!isCC && count === 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSignerId(signer.email);
                  const canvas = document.querySelector('[data-esign-canvas]');
                  canvas?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={[
                  'text-[10px] uppercase tracking-wide px-1.5 py-1 rounded-r-full border-l border-dashed',
                  isActive
                    ? 'bg-purple-600 text-white border-purple-700'
                    : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100',
                ].join(' ')}
                title={`${signer.name} has no fields — click to place the first one`}
              >
                Place →
              </button>
            )}
          </div>
        );
      })}
      {visibleSignerIds && visibleSignerIds.size > 0 && (
        <button
          type="button"
          onClick={() => clearSignerFilter()}
          className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-100 shrink-0"
          title="Show all signers"
        >
          <Filter className="h-3 w-3" />
          Clear filter
        </button>
      )}
    </div>
  );
}
