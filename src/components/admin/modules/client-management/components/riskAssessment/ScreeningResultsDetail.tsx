/**
 * Renders the expanded screening results for a completed assessment.
 * One slice of the risk-assessment panel.
 */

import type { AssessmentResult } from './riskAssessmentModel';
import { getScreeningCategoryInfo, getOutcomeBadge } from './riskAssessmentPresentation';

/** Renders the expanded screening results for an assessment */
export function ScreeningResultsDetail({
  result,
  expanded = false,
}: {
  result: AssessmentResult;
  expanded?: boolean;
}) {
  const screening = result.bulkScreeningResponse;

  if (!screening) {
    return (
      <div className={`${expanded ? '' : 'border-t'} bg-gray-50 px-4 py-4`}>
        <p className="text-sm text-gray-500 italic">
          No screening results available. The assessment may still be processing.
        </p>
      </div>
    );
  }

  const personEntries = Object.entries(screening).filter(([key]) => {
    const info = getScreeningCategoryInfo(key);
    return info && info.category === 'person';
  });

  const companyEntries = Object.entries(screening).filter(([key]) => {
    const info = getScreeningCategoryInfo(key);
    return info && info.category === 'company';
  });

  const totalHits = [...personEntries, ...companyEntries].reduce(
    (sum, [, val]) => sum + (Number(val) || 0),
    0,
  );

  return (
    <div className={`${expanded ? '' : 'border-t'} bg-gray-50 px-4 py-4 space-y-4`}>
      {/* Summary Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Screening Outcome:</span>
          {getOutcomeBadge(screening.screeningOutcome)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Total Possible Hits:</span>
          <span
            className={`text-sm font-bold ${totalHits > 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {totalHits}
          </span>
        </div>
      </div>

      {/* Natural Person Screening */}
      {personEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Natural Person Screening
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {personEntries.map(([key, value]) => {
              const info = getScreeningCategoryInfo(key);
              if (!info) return null;
              const count = Number(value) || 0;
              const hasHits = count > 0;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    hasHits
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                >
                  {info.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{info.label}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${hasHits ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Company Screening */}
      {companyEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Company Screening
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {companyEntries.map(([key, value]) => {
              const info = getScreeningCategoryInfo(key);
              if (!info) return null;
              const count = Number(value) || 0;
              const hasHits = count > 0;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    hasHits
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                >
                  {info.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{info.label}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${hasHits ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {personEntries.length === 0 && companyEntries.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          Screening data not yet available. Results may take a few moments to process.
        </p>
      )}
    </div>
  );
}
