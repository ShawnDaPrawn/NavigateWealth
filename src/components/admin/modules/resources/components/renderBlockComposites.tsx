/**
 * Repeaters, smart clauses, and the non-breaking signature block.
 * One slice of the PDF form-block renderers behind renderBlock.tsx —
 * see that file's header for the registry-alignment contract.
 */
import React from 'react';
import DOMPurify from 'dompurify';
import { RepeaterData, SmartClauseData, NonBreakingSignatureData } from '../builder/types';
import type { ResolveFunction } from './renderBlockShared';

export function renderRepeater(
  data: RepeaterData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  // Attempt to resolve actual array data from formData
  const arrayData = data.variableName ? resolveNestedKey(formData, data.variableName) : null;
  const hasData = Array.isArray(arrayData) && arrayData.length > 0;

  return (
    <div className="w-full my-2">
      {data.title && <div className="font-bold text-sm mb-2 uppercase">{data.title}</div>}
      <div className="border border-gray-300 w-full">
        {/* Header Row */}
        <div className="flex bg-gray-100 border-b border-gray-300 font-bold text-xs">
          {data.columns.map((col, i) => (
            <div
              key={i}
              className="p-2 border-r last:border-r-0 border-gray-300"
              style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
            >
              {col.header}
            </div>
          ))}
        </div>
        {/* Data Rows — use real data if available, otherwise show sample rows */}
        {hasData ? (
          arrayData.map((item: Record<string, unknown>, rowIdx: number) => (
            <div key={rowIdx} className="flex border-b last:border-b-0 border-gray-300 text-xs">
              {data.columns.map((col, i) => (
                <div
                  key={i}
                  className="p-2 border-r last:border-r-0 border-gray-300"
                  style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                >
                  {(item[col.key] ?? '') as React.ReactNode}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="contents">
            <div className="flex border-b border-gray-300 text-xs text-gray-400 italic">
              {data.columns.map((col, i) => (
                <div
                  key={i}
                  className="p-2 border-r last:border-r-0 border-gray-300"
                  style={{ width: col.width || 'auto', flex: col.width ? 'none' : 1 }}
                >
                  {data.emptyMessage && i === 0 ? data.emptyMessage : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Matches: SmartClauseBlock.tsx
 * FIX: Renders clauseNumber, title, and content with {variable} highlighting
 * Added: data-binding resolution for variables in content
 */
export function renderSmartClause(
  data: SmartClauseData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  // Content is now HTML from RichTextEditor. Variables are stored as:
  // - <span class="variable-tag">{{key}}</span> (from RichTextEditor variable button)
  // - {key} or {{key}} (from legacy plain-text input)
  // Resolve both patterns against formData.
  let resolvedContent = data.content || '';

  // Pattern 1: resolve {{key}} (double-brace) — used by RichTextEditor and variable-tag spans
  resolvedContent = resolvedContent.replace(/\{\{([^}]+)\}\}/g, (_match: string, key: string) => {
    const resolved = resolveNestedKey(formData, key.trim());
    if (resolved) return String(resolved);
    const variable = data.variables?.find((v) => v.key === key.trim());
    if (variable?.defaultValue) return variable.defaultValue;
    return _match; // Keep unresolved template
  });

  // Pattern 2: resolve {key} (single-brace, legacy) — but skip HTML tags like <span>
  resolvedContent = resolvedContent.replace(
    /\{([a-zA-Z0-9_.]+)\}/g,
    (_match: string, key: string) => {
      const variable = data.variables?.find((v) => v.key === key);
      const resolved = resolveNestedKey(formData, key);
      if (resolved) return String(resolved);
      if (variable?.defaultValue) return variable.defaultValue;
      return _match;
    },
  );

  return (
    <div className="flex gap-3 py-1">
      <div className="w-7 shrink-0 font-bold text-[10px] text-gray-900 pt-0.5 text-right">
        {data.clauseNumber || '#.'}
      </div>
      <div className="flex-1">
        {data.title && (
          <div className="font-bold text-gray-900 mb-0.5 uppercase text-[10px] tracking-wide">
            {data.title}
          </div>
        )}
        <div
          className="text-[9.5px] text-gray-800 leading-relaxed text-justify"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(resolvedContent) }}
        />
      </div>
    </div>
  );
}

/**
 * Matches: ContainerBlock.tsx
 * FIX: Uses data.conditionVariable and data.conditionValue (not data.backgroundColor/data.title)
 * Added: conditional rendering based on formData and nested block rendering
 */

export function renderNonBreakingSignature(data: NonBreakingSignatureData) {
  const style = {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  } as React.CSSProperties;

  return (
    <div className="w-full my-4 p-4 border border-gray-200 bg-gray-50 rounded" style={style}>
      <div className="text-[10px] uppercase text-gray-400 font-bold mb-4 tracking-wider flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        Non-Breaking Group
      </div>

      <div className="grid grid-cols-2 gap-8">
        {data.signatories.map((sig, i) => (
          <div key={i} className="mb-4">
            <div className="h-12 border-b border-black mb-1"></div>
            <div className="font-bold text-sm">{sig.label}</div>
            <div className="text-xs text-gray-500 font-mono">Date: _______________</div>
          </div>
        ))}
      </div>
    </div>
  );
}
