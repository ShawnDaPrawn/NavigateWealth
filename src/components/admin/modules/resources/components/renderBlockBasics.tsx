/**
 * Headers, text, field grids, signatures, tables, checkboxes, radios.
 * One slice of the PDF form-block renderers behind renderBlock.tsx —
 * see that file's header for the registry-alignment contract.
 */
import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '../../../../ui/utils';
import {
  SectionHeaderData,
  TextData,
  FieldGridData,
  TableData,
  SignatureData,
  CheckboxTableData,
  RadioOptionsData,
} from '../builder/types';
import type { ResolveFunction } from './renderBlockShared';

export function renderSectionHeader(data: SectionHeaderData) {
  return (
    <div className="section-head">
      <span className="num mr-2 text-purple-700 font-bold">{data.number}</span>
      <h2 className="uppercase font-bold text-gray-800 m-0">{data.title}</h2>
    </div>
  );
}

/**
 * Matches: TextBlock.tsx
 */
export function renderText(data: TextData) {
  return (
    <div
      className="text-[9.5px] leading-relaxed text-justify [&_p]:my-[0.5mm] [&_p]:leading-[1.5] [&_h3]:text-[10.5px] [&_h3]:font-bold [&_h3]:my-[1mm] [&_h4]:text-[10px] [&_h4]:font-semibold [&_h4]:my-[0.5mm] [&_ul]:my-[0.5mm] [&_ul]:pl-[4mm] [&_ol]:my-[0.5mm] [&_ol]:pl-[4mm] [&_li]:my-0"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content || '') }}
    />
  );
}

/**
 * Matches: FieldGridBlock.tsx
 * Added: data-binding resolution for field keys
 */
export function renderFieldGrid(
  data: FieldGridData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  const gridCols =
    data.columns === 3 ? 'grid-cols-3' : data.columns === 4 ? 'grid-cols-4' : 'grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {data.fields.map((field, i) => {
        const value = field.key ? resolveNestedKey(formData, field.key) : '';

        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="font-bold text-[9px] bg-gray-50 p-1 border border-gray-200">
              {field.label}
            </div>
            <div className="min-h-8 border border-gray-200 p-1 text-[9.5px] font-medium text-blue-900">
              {(value as React.ReactNode) || ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Matches: SignatureBlock.tsx
 * Properties: signatories[], showDate
 */
export function renderSignature(data: SignatureData) {
  return (
    <div className="mt-4 bg-[#eef2ff] p-4 border border-[#e0e7ff]">
      <div className="flex gap-8">
        {data.signatories.map((sig, i) => (
          <div key={i} className="flex-1">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-[9.5px] whitespace-nowrap">{sig.label}</span>
              <div className="flex-1 border-b border-black h-6"></div>
            </div>
          </div>
        ))}
        {data.showDate && (
          <div className="flex-1">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-[9.5px] whitespace-nowrap">Date</span>
              <div className="flex-1 border-b border-black h-6"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Matches: TableBlock.tsx
 * Added: data-binding resolution for field-type cells
 */
export function renderTable(
  data: TableData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full table-fixed text-[9.5px] border-collapse">
        {data.hasColumnHeaders && (
          <thead>
            <tr>
              {data.hasRowHeaders && (
                <th className="bg-gray-50 border border-gray-200 p-1 w-24"></th>
              )}
              {data.columnHeaders.map((header, i) => (
                <th
                  key={i}
                  className="bg-gray-100 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-left align-top break-words"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {data.hasRowHeaders && (
                <th className="bg-gray-50 border border-gray-200 p-2 font-bold text-gray-700 text-left w-24 align-top break-words">
                  {data.rowHeaders[rowIndex] || `Row ${rowIndex + 1}`}
                </th>
              )}
              {row.cells.map((cell, cellIndex) => {
                let content = cell.value;

                if (cell.type === 'field') {
                  const resolvedValue = resolveNestedKey(formData, cell.value);
                  content = (resolvedValue as string) || '';
                } else {
                  // Replace {{key}} template expressions in static text
                  content = content.replace(
                    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
                    (_match: string, key: string) => {
                      const resolvedValue = resolveNestedKey(formData, key);
                      return (resolvedValue as string) || _match;
                    },
                  );
                }

                return (
                  <td
                    key={cellIndex}
                    className="border border-gray-200 px-[6px] py-[5px] text-gray-600 align-top break-words"
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Matches: CheckboxTableBlock.tsx
 */
export function renderCheckboxTable(data: CheckboxTableData) {
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white overflow-hidden">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr>
            <th className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] w-1/3"></th>
            {data.columns.map((col, i) => (
              <th
                key={i}
                className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-center"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i}>
              <td className="border border-gray-200 px-[6px] py-[5px] font-medium text-gray-700">
                {row}
              </td>
              {data.columns.map((_, j) => (
                <td key={j} className="border border-gray-200 px-[6px] py-[5px] text-center">
                  <div
                    style={{
                      width: '4mm',
                      height: '4mm',
                      border: '1px solid #9ca3af',
                      borderRadius: '2px',
                      margin: '0 auto',
                    }}
                  ></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Matches: RadioOptionsBlock (via registry)
 */
export function renderRadioOptions(data: RadioOptionsData) {
  return (
    <div className="text-[9.5px]">
      {data.label && <div className="font-bold mb-2 text-gray-800">{data.label}</div>}
      <div
        className={cn('flex gap-4', data.layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap')}
      >
        {data.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              style={{
                width: '3mm',
                height: '3mm',
                border: '1px solid #9ca3af',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            ></div>
            <span className="text-gray-700">{opt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Matches: ClientSummaryBlock.tsx
 * Added: data-binding resolution
 */
