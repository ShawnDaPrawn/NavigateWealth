/**
 * Client summary, financial table, compliance, risk profile, fine print, office use, clause initials, attachments, callouts.
 * One slice of the PDF form-block renderers behind renderBlock.tsx —
 * see that file's header for the registry-alignment contract.
 */
import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '../../../../ui/utils';
import {
  ClientSummaryData,
  FinancialTableData,
  ComplianceQuestionData,
  RiskProfileData,
  FinePrintData,
  OfficeUseData,
  ClauseInitialData,
  AttachmentPlaceholderData,
  InstructionalCalloutData,
} from '../builder/types';
import { Paperclip, AlertTriangle } from 'lucide-react';
import type { ResolveFunction } from './renderBlockShared';

export function renderClientSummary(
  data: ClientSummaryData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  return (
    <div className="border border-gray-200 rounded p-4 bg-gray-50/50">
      <div className="font-bold text-[10px] mb-3 text-purple-800 uppercase tracking-wider border-b border-gray-200 pb-1">
        {data.title || 'Client Details'}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[9.5px]">
        {[
          {
            l: 'Full Name',
            v:
              resolveNestedKey(formData, 'client.name') ||
              resolveNestedKey(formData, 'personalInformation.firstName') ||
              '',
          },
          {
            l: 'ID Number',
            v:
              resolveNestedKey(formData, 'client.idNumber') ||
              resolveNestedKey(formData, 'personalInformation.idNumber') ||
              '',
          },
          { l: 'Email', v: resolveNestedKey(formData, 'client.email') || '' },
          { l: 'Address', v: resolveNestedKey(formData, 'client.address') || '' },
        ].map((item, i) => (
          <div key={i}>
            <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-0.5">{item.l}</div>
            <div className="font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {item.v as React.ReactNode}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Matches: FinancialTableBlock.tsx
 */
export function renderFinancialTable(data: FinancialTableData) {
  const items = data.items || [{ description: 'Example Asset', value: '100000' }];

  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">
              Description
            </th>
            <th className="border border-gray-200 px-2 py-1 text-right font-bold text-gray-700 w-32">
              Value ({data.currencySymbol || 'R'})
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-200 px-2 py-1">{item.description}</td>
              <td className="border border-gray-200 px-2 py-1 text-right">{item.value}</td>
            </tr>
          ))}
          {[1, 2, 3].map((i) => (
            <tr key={`empty-${i}`}>
              <td className="border border-gray-200 px-2 py-1 h-6"></td>
              <td className="border border-gray-200 px-2 py-1 h-6"></td>
            </tr>
          ))}
        </tbody>
        {data.showTotal && (
          <tfoot>
            <tr className="bg-gray-50 font-bold">
              <td className="border border-gray-200 px-2 py-1 text-right">Total</td>
              <td className="border border-gray-200 px-2 py-1 text-right">0.00</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Matches: ComplianceQuestionBlock.tsx
 */
export function renderComplianceQuestion(data: ComplianceQuestionData) {
  return (
    <div className="mb-2">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 text-[9.5px] font-medium leading-normal text-gray-800">
          {data.question || 'New Compliance Question'}
        </div>
        <div className="flex gap-4 flex-shrink-0 ml-4">
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '4mm',
                height: '4mm',
                border: '1px solid #9ca3af',
                borderRadius: '2px',
              }}
            ></div>
            <span className="text-[9px]">Yes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: '4mm',
                height: '4mm',
                border: '1px solid #9ca3af',
                borderRadius: '2px',
              }}
            ></div>
            <span className="text-[9px]">No</span>
          </div>
        </div>
      </div>
      {data.showDetails && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-100">
          <div className="text-[8px] text-gray-500 uppercase mb-1">
            {data.detailsLabel || 'If Yes, provide details:'}
          </div>
          <div className="border-b border-gray-300 h-5 mb-1 bg-gray-50/30"></div>
          <div className="border-b border-gray-300 h-5 bg-gray-50/30"></div>
        </div>
      )}
    </div>
  );
}

/**
 * Matches: RiskProfileBlock.tsx
 */
export function renderRiskProfile(data: RiskProfileData) {
  const level = data.level || 3;
  const labels = data.labels || [
    'Conservative',
    'Cautious',
    'Moderate',
    'Mod-Aggressive',
    'Aggressive',
  ];

  return (
    <div className="py-4 px-8 border border-gray-200 rounded-lg bg-white flex flex-col items-center">
      <div className="flex gap-1 w-full max-w-md">
        {labels.map((label, i) => {
          const isSelected = i + 1 === level;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-full h-3 rounded-full transition-colors',
                  isSelected ? 'bg-purple-600 ring-2 ring-offset-1 ring-purple-600' : 'bg-gray-200',
                )}
              />
              <div
                className={cn(
                  'text-[8px] text-center font-medium leading-tight',
                  isSelected ? 'text-purple-700' : 'text-gray-400',
                )}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
        Risk Profile Indicator
      </div>
    </div>
  );
}

/**
 * Matches: FinePrintBlock.tsx
 */
export function renderFinePrint(data: FinePrintData) {
  return (
    <div
      style={{
        columnCount: data.columns || 2,
        columnGap: '6mm',
        fontSize: '8px',
        textAlign: 'justify',
        color: '#4b5563',
        lineHeight: '1.4',
      }}
    >
      {data.content ? (
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }} />
      ) : (
        <div className="contents">
          <p className="mb-2">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
          <p className="mb-2">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
            nulla pariatur.
          </p>
          <p>
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque
            laudantium.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Matches: OfficeUseBlock.tsx
 */
export function renderOfficeUse(data: OfficeUseData) {
  return (
    <div className="border-2 border-dashed border-gray-300 bg-gray-50/50 p-4 relative mt-4 rounded">
      <div className="absolute -top-2.5 right-4 bg-white text-gray-400 text-[9px] px-2 border border-gray-200 font-bold uppercase tracking-wider">
        {data.title || 'Office Use Only'}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(
          data.fields || ['FICA Verified', 'Risk Analyzed', 'Loaded on CRM', 'Manager Approved']
        ).map((field, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              style={{
                width: '4mm',
                height: '4mm',
                border: '1px solid #9ca3af',
                background: 'white',
              }}
            ></div>
            <span className="text-[9px] text-gray-600 font-medium">{field}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Matches: ClauseInitialBlock.tsx
 */
export function renderClauseInitial(data: ClauseInitialData) {
  return (
    <div className="flex gap-4 items-stretch">
      <div className="flex-1 text-[9.5px] text-justify leading-relaxed">
        {data.text ||
          'I acknowledge that I have read and understood the terms and conditions set out in this agreement.'}
      </div>
      <div className="w-[18mm] flex-shrink-0 border border-gray-400 rounded-sm flex flex-col justify-end items-center p-1 bg-white min-h-[12mm]">
        <span className="text-[7px] text-gray-400 uppercase tracking-tighter">Initial</span>
      </div>
    </div>
  );
}

/**
 * Matches: AttachmentPlaceholderBlock.tsx
 * FIX: Uses data.height (string like "40mm"), NOT data.heightMm
 */
export function renderAttachmentPlaceholder(data: AttachmentPlaceholderData) {
  return (
    <div
      className="border-2 border-dotted border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-2"
      style={{ height: data.height || '40mm' }}
    >
      <Paperclip className="w-5 h-5 text-gray-300" />
      <div className="text-[9.5px] font-medium uppercase tracking-wide">
        {data.label || 'Attach Document Here'}
      </div>
    </div>
  );
}

/**
 * Matches: InstructionalCalloutBlock.tsx
 * FIX: Uses data.type (not data.style) and data.text (not data.content)
 */
export function renderInstructionalCallout(data: InstructionalCalloutData) {
  const type = data.type || 'info';
  const colors =
    type === 'stop'
      ? 'bg-red-50 border-red-500 text-red-900'
      : type === 'warning'
        ? 'bg-amber-50 border-amber-500 text-amber-900'
        : 'bg-blue-50 border-blue-500 text-blue-900';

  const iconColor =
    type === 'stop' ? 'text-red-500' : type === 'warning' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className={cn('border-l-4 p-3 text-[9.5px] flex gap-3 rounded-r-sm', colors)}>
      <AlertTriangle className={cn('w-4 h-4 flex-shrink-0', iconColor)} />
      <div className="font-medium leading-relaxed">
        {data.text || 'Important instruction for the client.'}
      </div>
    </div>
  );
}

/**
 * Matches: CombInputBlock.tsx
 * FIX: Uses data.charCount (not data.length) and data.value (not data.placeholder)
 * Added: data-binding via key
 */
