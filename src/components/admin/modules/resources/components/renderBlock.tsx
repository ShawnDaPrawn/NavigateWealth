/**
 * Form Block Renderer (PDF Output)
 * 
 * IMPORTANT: This file renders blocks for PDF/print output with data binding.
 * It MUST stay aligned with the registry block renderers in /builder/blocks/*.tsx
 * and the type definitions in /builder/types.ts.
 * 
 * The registry blocks render WYSIWYG previews (no data binding).
 * This file renders the same visual output BUT resolves data bindings.
 * 
 * When adding or modifying a block type:
 * 1. Update types.ts with the canonical property names
 * 2. Update the registry block's render function
 * 3. Update this file to match, adding data binding where needed
 */

import React from 'react';
import DOMPurify from 'dompurify';
import { cn } from '../../../../ui/utils';
import {
  FormBlock,
  SectionHeaderData,
  TextData,
  FieldGridData,
  TableData,
  SignatureData,
  CheckboxTableData,
  RadioOptionsData,
  ClientSummaryData,
  FinancialTableData,
  ComplianceQuestionData,
  RiskProfileData,
  FinePrintData,
  OfficeUseData,
  ClauseInitialData,
  AttachmentPlaceholderData,
  InstructionalCalloutData,
  CombInputData,
  BankDetailsData,
  BeneficiaryTableData,
  WitnessSignatureData,
  AddressBlockData,
  SpacerData,
  ImageData,
  RepeaterData,
  SmartClauseData,
  ContainerData,
  NonBreakingSignatureData,
} from '../builder/types';
import { Paperclip, AlertTriangle } from 'lucide-react';

type ResolveFunction = (obj: Record<string, unknown>, path: string) => unknown;

/**
 * Main block renderer function
 * Routes each block type to its specific renderer
 */
export const renderBlock = (
  block: FormBlock,
  data: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
): React.ReactNode => {
  switch (block.type) {
    case 'section_header':
      return renderSectionHeader(block.data as SectionHeaderData);
    
    case 'text':
      return renderText(block.data as TextData);
    
    case 'field_grid':
      return renderFieldGrid(block.data as FieldGridData, data, resolveNestedKey);
    
    case 'signature':
      return renderSignature(block.data as SignatureData);
    
    case 'table':
      return renderTable(block.data as TableData, data, resolveNestedKey);
    
    case 'checkbox_table':
      return renderCheckboxTable(block.data as CheckboxTableData);
    
    case 'radio_options':
      return renderRadioOptions(block.data as RadioOptionsData);
    
    case 'client_summary':
      return renderClientSummary(block.data as ClientSummaryData, data, resolveNestedKey);
    
    case 'financial_table':
      return renderFinancialTable(block.data as FinancialTableData);
    
    case 'compliance_question':
      return renderComplianceQuestion(block.data as ComplianceQuestionData);
    
    case 'risk_profile':
      return renderRiskProfile(block.data as RiskProfileData);
    
    case 'fine_print':
      return renderFinePrint(block.data as FinePrintData);
    
    case 'office_use':
      return renderOfficeUse(block.data as OfficeUseData);
    
    case 'clause_initial':
      return renderClauseInitial(block.data as ClauseInitialData);
    
    case 'attachment_placeholder':
      return renderAttachmentPlaceholder(block.data as AttachmentPlaceholderData);
    
    case 'instructional_callout':
      return renderInstructionalCallout(block.data as InstructionalCalloutData);
    
    case 'comb_input':
      return renderCombInput(block.data as CombInputData, data, resolveNestedKey);
    
    case 'bank_details':
      return renderBankDetails(block.data as BankDetailsData, data, resolveNestedKey);
    
    case 'beneficiary_table':
      return renderBeneficiaryTable(block.data as BeneficiaryTableData);
    
    case 'witness_signature':
      return renderWitnessSignature(block.data as WitnessSignatureData);
    
    case 'address_block':
      return renderAddressBlock(block.data as AddressBlockData, data, resolveNestedKey);
    
    case 'spacer':
      return renderSpacer(block.data as SpacerData);
    
    // Block type is 'image_asset' in the registry, not 'image'
    case 'image_asset':
      return renderImageAsset(block.data as ImageData);
    
    case 'repeater':
      return renderRepeater(block.data as RepeaterData, data, resolveNestedKey);
    
    case 'smart_clause':
      return renderSmartClause(block.data as SmartClauseData, data, resolveNestedKey);
    
    case 'container':
      return renderContainer(block.data as ContainerData, data, resolveNestedKey);
    
    case 'non_breaking_signature':
      return renderNonBreakingSignature(block.data as NonBreakingSignatureData);
    
    case 'page_break':
      // Page breaks are handled structurally by DynamicFormRenderer (page splitting).
      // If a page_break block reaches renderBlock, it should produce no output.
      return null;
    
    default:
      console.warn('[renderBlock] Unknown block type:', (block as Record<string, unknown>).type);
      return null;
  }
};

// ============================================================================
// INDIVIDUAL BLOCK RENDERERS
// Each renderer matches the visual output of its registry block counterpart
// while adding data-binding resolution where applicable.
// ============================================================================

/**
 * Matches: SectionHeaderBlock.tsx
 */
function renderSectionHeader(data: SectionHeaderData) {
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
function renderText(data: TextData) {
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
function renderFieldGrid(
  data: FieldGridData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  const gridCols = data.columns === 3 ? 'grid-cols-3' : data.columns === 4 ? 'grid-cols-4' : 'grid-cols-2';
  
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
              {value || ''}
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
function renderSignature(data: SignatureData) {
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
function renderTable(
  data: TableData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full table-fixed text-[9.5px] border-collapse">
        {data.hasColumnHeaders && (
          <thead>
            <tr>
              {data.hasRowHeaders && <th className="bg-gray-50 border border-gray-200 p-1 w-24"></th>}
              {data.columnHeaders.map((header, i) => (
                <th key={i} className="bg-gray-100 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-left align-top break-words">
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
                  content = resolvedValue || '';
                } else {
                  // Replace {{key}} template expressions in static text
                  content = content.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match: string, key: string) => {
                    const resolvedValue = resolveNestedKey(formData, key);
                    return resolvedValue || _match;
                  });
                }

                return (
                  <td key={cellIndex} className="border border-gray-200 px-[6px] py-[5px] text-gray-600 align-top break-words">
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
function renderCheckboxTable(data: CheckboxTableData) {
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white overflow-hidden">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr>
            <th className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] w-1/3"></th>
            {data.columns.map((col, i) => (
              <th key={i} className="bg-gray-50 border border-gray-200 px-[6px] py-[5px] font-bold text-gray-700 text-center">
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
                  <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px', margin: '0 auto' }}></div>
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
function renderRadioOptions(data: RadioOptionsData) {
  return (
    <div className="text-[9.5px]">
      {data.label && <div className="font-bold mb-2 text-gray-800">{data.label}</div>}
      <div className={cn(
        "flex gap-4",
        data.layout === 'vertical' ? "flex-col" : "flex-row flex-wrap"
      )}>
        {data.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: '3mm', height: '3mm', border: '1px solid #9ca3af', borderRadius: '50%', flexShrink: 0 }}></div>
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
function renderClientSummary(
  data: ClientSummaryData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  return (
    <div className="border border-gray-200 rounded p-4 bg-gray-50/50">
      <div className="font-bold text-[10px] mb-3 text-purple-800 uppercase tracking-wider border-b border-gray-200 pb-1">
        {data.title || "Client Details"}
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[9.5px]">
        {[
          { l: 'Full Name', v: resolveNestedKey(formData, 'client.name') || resolveNestedKey(formData, 'personalInformation.firstName') || '' },
          { l: 'ID Number', v: resolveNestedKey(formData, 'client.idNumber') || resolveNestedKey(formData, 'personalInformation.idNumber') || '' },
          { l: 'Email', v: resolveNestedKey(formData, 'client.email') || '' },
          { l: 'Address', v: resolveNestedKey(formData, 'client.address') || '' }
        ].map((item, i) => (
          <div key={i}>
            <div className="text-[8px] text-gray-500 uppercase tracking-wide mb-0.5">{item.l}</div>
            <div className="font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px]">
              {item.v}
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
function renderFinancialTable(data: FinancialTableData) {
  const items = data.items || [{ description: 'Example Asset', value: '100000' }];
  
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">Description</th>
            <th className="border border-gray-200 px-2 py-1 text-right font-bold text-gray-700 w-32">Value ({data.currencySymbol || 'R'})</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-200 px-2 py-1">{item.description}</td>
              <td className="border border-gray-200 px-2 py-1 text-right">{item.value}</td>
            </tr>
          ))}
          {[1,2,3].map(i => (
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
function renderComplianceQuestion(data: ComplianceQuestionData) {
  return (
    <div className="mb-2">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 text-[9.5px] font-medium leading-normal text-gray-800">
          {data.question || "New Compliance Question"}
        </div>
        <div className="flex gap-4 flex-shrink-0 ml-4">
          <div className="flex items-center gap-1.5">
            <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px' }}></div>
            <span className="text-[9px]">Yes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', borderRadius: '2px' }}></div>
            <span className="text-[9px]">No</span>
          </div>
        </div>
      </div>
      {data.showDetails && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-gray-100">
          <div className="text-[8px] text-gray-500 uppercase mb-1">{data.detailsLabel || "If Yes, provide details:"}</div>
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
function renderRiskProfile(data: RiskProfileData) {
  const level = data.level || 3;
  const labels = data.labels || ["Conservative", "Cautious", "Moderate", "Mod-Aggressive", "Aggressive"];
  
  return (
    <div className="py-4 px-8 border border-gray-200 rounded-lg bg-white flex flex-col items-center">
      <div className="flex gap-1 w-full max-w-md">
        {labels.map((label, i) => {
          const isSelected = (i + 1) === level;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className={cn(
                  "w-full h-3 rounded-full transition-colors",
                  isSelected 
                    ? "bg-purple-600 ring-2 ring-offset-1 ring-purple-600" 
                    : "bg-gray-200"
                )}
              />
              <div className={cn(
                "text-[8px] text-center font-medium leading-tight",
                isSelected ? "text-purple-700" : "text-gray-400"
              )}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">Risk Profile Indicator</div>
    </div>
  );
}

/**
 * Matches: FinePrintBlock.tsx
 */
function renderFinePrint(data: FinePrintData) {
  return (
    <div style={{ 
      columnCount: data.columns || 2, 
      columnGap: '6mm', 
      fontSize: '8px', 
      textAlign: 'justify',
      color: '#4b5563',
      lineHeight: '1.4'
    }}>
      {data.content ? (
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }} />
      ) : (
        <div className="contents">
          <p className="mb-2">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <p className="mb-2">Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
          <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Matches: OfficeUseBlock.tsx
 */
function renderOfficeUse(data: OfficeUseData) {
  return (
    <div className="border-2 border-dashed border-gray-300 bg-gray-50/50 p-4 relative mt-4 rounded">
      <div className="absolute -top-2.5 right-4 bg-white text-gray-400 text-[9px] px-2 border border-gray-200 font-bold uppercase tracking-wider">
        {data.title || "Office Use Only"}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(data.fields || ["FICA Verified", "Risk Analyzed", "Loaded on CRM", "Manager Approved"]).map((field, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ width: '4mm', height: '4mm', border: '1px solid #9ca3af', background: 'white' }}></div>
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
function renderClauseInitial(data: ClauseInitialData) {
  return (
    <div className="flex gap-4 items-stretch">
      <div className="flex-1 text-[9.5px] text-justify leading-relaxed">
        {data.text || "I acknowledge that I have read and understood the terms and conditions set out in this agreement."}
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
function renderAttachmentPlaceholder(data: AttachmentPlaceholderData) {
  return (
    <div 
      className="border-2 border-dotted border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-2"
      style={{ height: data.height || '40mm' }}
    >
      <Paperclip className="w-5 h-5 text-gray-300" />
      <div className="text-[9.5px] font-medium uppercase tracking-wide">{data.label || "Attach Document Here"}</div>
    </div>
  );
}

/**
 * Matches: InstructionalCalloutBlock.tsx
 * FIX: Uses data.type (not data.style) and data.text (not data.content)
 */
function renderInstructionalCallout(data: InstructionalCalloutData) {
  const type = data.type || 'info';
  const colors = type === 'stop' 
    ? 'bg-red-50 border-red-500 text-red-900' 
    : type === 'warning' 
      ? 'bg-amber-50 border-amber-500 text-amber-900' 
      : 'bg-blue-50 border-blue-500 text-blue-900';
  
  const iconColor = type === 'stop' ? 'text-red-500' : type === 'warning' ? 'text-amber-500' : 'text-blue-500';
      
  return (
    <div className={cn("border-l-4 p-3 text-[9.5px] flex gap-3 rounded-r-sm", colors)}>
      <AlertTriangle className={cn("w-4 h-4 flex-shrink-0", iconColor)} />
      <div className="font-medium leading-relaxed">
        {data.text || "Important instruction for the client."}
      </div>
    </div>
  );
}

/**
 * Matches: CombInputBlock.tsx
 * FIX: Uses data.charCount (not data.length) and data.value (not data.placeholder)
 * Added: data-binding via key
 */
function renderCombInput(
  data: CombInputData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  const count = data.charCount || 13;
  // Resolve value from data binding key, fall back to static value
  const value = data.key ? (resolveNestedKey(formData, data.key) || data.value || '') : (data.value || '');
  
  return (
    <div className="mb-2">
      <div className="text-[9.5px] font-bold text-gray-700 mb-1">{data.label || "Identity Number"}</div>
      <div className="flex">
        {Array.from({ length: count }).map((_, i) => (
          <div 
            key={i} 
            className="w-[5mm] h-[6mm] border border-gray-400 border-r-0 last:border-r flex items-center justify-center text-[10px] font-mono bg-white first:rounded-l-sm last:rounded-r-sm"
          >
            {value[i] || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Matches: BankDetailsBlock.tsx
 * FIX: Renders the same layout as registry (bank name, branch code, account number, 
 * account type radio, account holder) with showAuthorization support and data binding
 */
function renderBankDetails(
  data: BankDetailsData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  const bankName = resolveNestedKey(formData, 'banking.bankName') || resolveNestedKey(formData, 'bank.bankName') || '';
  const branchCode = resolveNestedKey(formData, 'banking.branchCode') || resolveNestedKey(formData, 'bank.branchCode') || '';
  const accountNumber = resolveNestedKey(formData, 'banking.accountNumber') || resolveNestedKey(formData, 'bank.accountNumber') || '';
  const accountHolder = resolveNestedKey(formData, 'banking.accountHolderName') || resolveNestedKey(formData, 'bank.accountHolderName') || '';

  return (
    <div className="border border-gray-300 rounded-sm p-4 bg-gray-50/50">
      <div className="font-bold text-[10px] uppercase tracking-wider text-gray-800 mb-3 border-b border-gray-200 pb-1">
        {data.title || "Banking Details"}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Bank Name</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">{bankName}</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Branch Code</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">{branchCode}</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Account Number</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">{accountNumber}</div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Account Type</div>
          <div className="flex gap-3 mt-1.5">
            <div className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-400 rounded-full"></div><span className="text-[9px]">Current</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 border border-gray-400 rounded-full"></div><span className="text-[9px]">Savings</span></div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[8px] text-gray-500 uppercase">Account Holder Name</div>
        <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">{accountHolder}</div>
      </div>
      {data.showAuthorization && (
        <div className="mt-3 text-[8px] text-gray-500 text-justify leading-tight">
          I/We hereby authorise the Financial Services Provider to deduct the agreed amount from my/our bank account. This authority may be cancelled by me/us by giving thirty days notice in writing.
        </div>
      )}
    </div>
  );
}

/**
 * Matches: BeneficiaryTableBlock.tsx
 * FIX: Uses data.rowCount (not hardcoded 3), matches column headers from registry
 */
function renderBeneficiaryTable(data: BeneficiaryTableData) {
  const rows = data.rowCount || 3;
  
  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">Surname & Initials</th>
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-32">ID Number</th>
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-24">Relationship</th>
            <th className="border border-gray-200 px-2 py-1 text-center font-bold text-gray-700 w-16">Share %</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="border border-gray-200 px-2 py-1 h-8"></td>
              <td className="border border-gray-200 px-2 py-1 h-8"></td>
              <td className="border border-gray-200 px-2 py-1 h-8"></td>
              <td className="border border-gray-200 px-2 py-1 h-8"></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-bold">
            <td colSpan={3} className="border border-gray-200 px-2 py-1 text-right">Total Share</td>
            <td className="border border-gray-200 px-2 py-1 text-center">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Matches: WitnessSignatureBlock.tsx
 * FIX: Uses data.mainLabel (not hardcoded), data.showWitnesses, and matches registry layout
 * (Signed at/on line, main signature box, optional 2 witness lines)
 */
function renderWitnessSignature(data: WitnessSignatureData) {
  return (
    <div className="mt-4 break-inside-avoid">
      <div className="flex justify-between items-end text-[9px] mb-2 text-gray-600">
        <div>Signed at ____________________</div>
        <div>on ____________________</div>
      </div>
      
      <div className="border border-gray-400 h-24 rounded-sm relative bg-gray-50/20 mb-2">
        <div className="absolute bottom-2 left-2 text-[8px] text-gray-500 uppercase">
          {data.mainLabel || "Signature of Client"}
        </div>
      </div>

      {data.showWitnesses && (
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <div className="border-b border-black h-8 mb-1"></div>
            <div className="text-[9px] text-gray-500">Witness 1</div>
          </div>
          <div className="flex-1">
            <div className="border-b border-black h-8 mb-1"></div>
            <div className="text-[9px] text-gray-500">Witness 2</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Matches: AddressBlock.tsx
 * FIX: Renders the same Physical + Postal address layout as registry
 * (Unit/Complex, Street, Suburb/City/Code with "Same as Physical" checkbox)
 * Added: data-binding resolution where applicable
 */
function renderAddressBlock(
  _data: AddressBlockData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  // Attempt to resolve address data if available
  const physLine1 = resolveNestedKey(formData, 'address.physicalLine1') || '';
  const physLine2 = resolveNestedKey(formData, 'address.physicalLine2') || '';
  const physSuburb = resolveNestedKey(formData, 'address.physicalSuburb') || resolveNestedKey(formData, 'address.physicalCity') || '';
  const physCode = resolveNestedKey(formData, 'address.physicalCode') || '';

  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <div className="font-bold text-[9.5px] text-gray-800 mb-2 border-b border-gray-200 pb-1">Physical Address</div>
        <div className="space-y-2">
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Unit / Complex</div>
            <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">{physLine1}</div>
          </div>
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Street Name & Number</div>
            <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">{physLine2}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <div className="text-[8px] text-gray-500 uppercase">Suburb / City</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">{physSuburb}</div>
            </div>
            <div>
              <div className="text-[8px] text-gray-500 uppercase">Code</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">{physCode}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-end mb-2 border-b border-gray-200 pb-1">
          <div className="font-bold text-[9.5px] text-gray-800">Postal Address</div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border border-gray-400 rounded-sm"></div>
            <span className="text-[8px] text-gray-500">Same as Physical</span>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Box / Street</div>
            <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <div className="text-[8px] text-gray-500 uppercase">City / Post Office</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
            </div>
            <div>
              <div className="text-[8px] text-gray-500 uppercase">Code</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Matches: SpacerBlock.tsx
 * FIX: Uses data.height (string like "10mm"), NOT data.heightMm (number)
 * Added: showLine support
 */
function renderSpacer(data: SpacerData) {
  const height = data.height || '10mm';
  return (
    <div style={{ height }} className="w-full flex items-center justify-center relative">
      {data.showLine && <div className="w-full border-b border-gray-300"></div>}
    </div>
  );
}

/**
 * Matches: ImageBlock.tsx (registered as 'image_asset')
 * FIX: Uses data.src (not data.url), data.width (not data.maxWidth), 
 * data.align, data.caption
 */
function renderImageAsset(data: ImageData) {
  return (
    <div className={cn("w-full flex mb-2", 
      data.align === 'center' ? 'justify-center' : data.align === 'right' ? 'justify-end' : 'justify-start'
    )}>
      <div className="flex flex-col gap-1">
        {data.src ? (
          <img 
            src={data.src} 
            alt="Form Asset" 
            style={{ 
              width: data.width || '100%', 
              maxHeight: '100mm', 
              objectFit: 'contain' 
            }} 
          />
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded p-8 text-center text-gray-400">
            Image placeholder
          </div>
        )}
        {data.caption && <div className="text-[8px] text-gray-500 italic text-center">{data.caption}</div>}
      </div>
    </div>
  );
}

/**
 * Matches: RepeaterBlock.tsx
 * FIX: Renders table-style header + data rows (matching registry layout)
 * Added: actual data iteration from formData when available
 */
function renderRepeater(
  data: RepeaterData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
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
                  {item[col.key] ?? ''}
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
function renderSmartClause(
  data: SmartClauseData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
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
    const variable = data.variables?.find(v => v.key === key.trim());
    if (variable?.defaultValue) return variable.defaultValue;
    return _match; // Keep unresolved template
  });

  // Pattern 2: resolve {key} (single-brace, legacy) — but skip HTML tags like <span>
  resolvedContent = resolvedContent.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_match: string, key: string) => {
    const variable = data.variables?.find(v => v.key === key);
    const resolved = resolveNestedKey(formData, key);
    if (resolved) return String(resolved);
    if (variable?.defaultValue) return variable.defaultValue;
    return _match;
  });

  return (
    <div className="flex gap-3 py-1">
      <div className="w-7 shrink-0 font-bold text-[10px] text-gray-900 pt-0.5 text-right">
        {data.clauseNumber || "#."}
      </div>
      <div className="flex-1">
        {data.title && <div className="font-bold text-gray-900 mb-0.5 uppercase text-[10px] tracking-wide">{data.title}</div>}
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
function renderContainer(
  data: ContainerData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction
) {
  // Evaluate condition using operator
  if (data.conditionVariable && formData) {
    const actualValue = resolveNestedKey(formData, data.conditionVariable);
    const operator = data.conditionOperator || 'equals';

    let conditionMet = true;
    switch (operator) {
      case 'equals':
        conditionMet = String(actualValue) === String(data.conditionValue || '');
        break;
      case 'not_equals':
        conditionMet = String(actualValue) !== String(data.conditionValue || '');
        break;
      case 'exists':
        conditionMet = actualValue !== undefined && actualValue !== null && actualValue !== '';
        break;
      case 'not_exists':
        conditionMet = actualValue === undefined || actualValue === null || actualValue === '';
        break;
    }

    if (!conditionMet) {
      return null; // Condition not met — don't render
    }
  }

  // Render nested blocks only (no visual wrapper in PDF output)
  if (data.blocks && data.blocks.length > 0) {
    return (
      <div className="w-full">
        {data.blocks.map((nestedBlock) => (
          <div key={nestedBlock.id}>
            {renderBlock(nestedBlock, formData, resolveNestedKey)}
          </div>
        ))}
      </div>
    );
  }

  return null; // Empty container — nothing to render in PDF
}

/**
 * Matches: NonBreakingSignatureBlock.tsx
 * FIX: Uses data.signatories only (no phantom showDate), renders grid grid-cols-2 layout
 * with signature line + label + date for each signatory
 */
function renderNonBreakingSignature(data: NonBreakingSignatureData) {
  const style = {
    pageBreakInside: 'avoid',
    breakInside: 'avoid'
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