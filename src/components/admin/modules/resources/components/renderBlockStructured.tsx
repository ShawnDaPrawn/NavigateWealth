/**
 * Comb inputs, bank details, beneficiary tables, witness signatures, address blocks, spacers, images.
 * One slice of the PDF form-block renderers behind renderBlock.tsx —
 * see that file's header for the registry-alignment contract.
 */
import React from 'react';
import { cn } from '../../../../ui/utils';
import {
  CombInputData,
  BankDetailsData,
  BeneficiaryTableData,
  WitnessSignatureData,
  AddressBlockData,
  SpacerData,
  ImageData,
} from '../builder/types';
import type { ResolveFunction } from './renderBlockShared';

export function renderCombInput(
  data: CombInputData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  const count = data.charCount || 13;
  // Resolve value from data binding key, fall back to static value
  const value = (
    data.key ? resolveNestedKey(formData, data.key) || data.value || '' : data.value || ''
  ) as string;

  return (
    <div className="mb-2">
      <div className="text-[9.5px] font-bold text-gray-700 mb-1">
        {data.label || 'Identity Number'}
      </div>
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
export function renderBankDetails(
  data: BankDetailsData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  const bankName = (resolveNestedKey(formData, 'banking.bankName') ||
    resolveNestedKey(formData, 'bank.bankName') ||
    '') as React.ReactNode;
  const branchCode = (resolveNestedKey(formData, 'banking.branchCode') ||
    resolveNestedKey(formData, 'bank.branchCode') ||
    '') as React.ReactNode;
  const accountNumber = (resolveNestedKey(formData, 'banking.accountNumber') ||
    resolveNestedKey(formData, 'bank.accountNumber') ||
    '') as React.ReactNode;
  const accountHolder = (resolveNestedKey(formData, 'banking.accountHolderName') ||
    resolveNestedKey(formData, 'bank.accountHolderName') ||
    '') as React.ReactNode;

  return (
    <div className="border border-gray-300 rounded-sm p-4 bg-gray-50/50">
      <div className="font-bold text-[10px] uppercase tracking-wider text-gray-800 mb-3 border-b border-gray-200 pb-1">
        {data.title || 'Banking Details'}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Bank Name</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">
            {bankName}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Branch Code</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">
            {branchCode}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Account Number</div>
          <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">
            {accountNumber}
          </div>
        </div>
        <div>
          <div className="text-[8px] text-gray-500 uppercase">Account Type</div>
          <div className="flex gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-400 rounded-full"></div>
              <span className="text-[9px]">Current</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border border-gray-400 rounded-full"></div>
              <span className="text-[9px]">Savings</span>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[8px] text-gray-500 uppercase">Account Holder Name</div>
        <div className="border border-gray-300 bg-white h-7 w-full p-1 text-[9.5px] font-medium text-blue-900">
          {accountHolder}
        </div>
      </div>
      {data.showAuthorization && (
        <div className="mt-3 text-[8px] text-gray-500 text-justify leading-tight">
          I/We hereby authorise the Financial Services Provider to deduct the agreed amount from
          my/our bank account. This authority may be cancelled by me/us by giving thirty days notice
          in writing.
        </div>
      )}
    </div>
  );
}

/**
 * Matches: BeneficiaryTableBlock.tsx
 * FIX: Uses data.rowCount (not hardcoded 3), matches column headers from registry
 */
export function renderBeneficiaryTable(data: BeneficiaryTableData) {
  const rows = data.rowCount || 3;

  return (
    <div className="w-full border border-gray-300 rounded-sm bg-white">
      <table className="w-full text-[9.5px] border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700">
              Surname & Initials
            </th>
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-32">
              ID Number
            </th>
            <th className="border border-gray-200 px-2 py-1 text-left font-bold text-gray-700 w-24">
              Relationship
            </th>
            <th className="border border-gray-200 px-2 py-1 text-center font-bold text-gray-700 w-16">
              Share %
            </th>
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
            <td colSpan={3} className="border border-gray-200 px-2 py-1 text-right">
              Total Share
            </td>
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
export function renderWitnessSignature(data: WitnessSignatureData) {
  return (
    <div className="mt-4 break-inside-avoid">
      <div className="flex justify-between items-end text-[9px] mb-2 text-gray-600">
        <div>Signed at ____________________</div>
        <div>on ____________________</div>
      </div>

      <div className="border border-gray-400 h-24 rounded-sm relative bg-gray-50/20 mb-2">
        <div className="absolute bottom-2 left-2 text-[8px] text-gray-500 uppercase">
          {data.mainLabel || 'Signature of Client'}
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
export function renderAddressBlock(
  _data: AddressBlockData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
) {
  // Attempt to resolve address data if available
  const physLine1 = (resolveNestedKey(formData, 'address.physicalLine1') || '') as React.ReactNode;
  const physLine2 = (resolveNestedKey(formData, 'address.physicalLine2') || '') as React.ReactNode;
  const physSuburb = (resolveNestedKey(formData, 'address.physicalSuburb') ||
    resolveNestedKey(formData, 'address.physicalCity') ||
    '') as React.ReactNode;
  const physCode = (resolveNestedKey(formData, 'address.physicalCode') || '') as React.ReactNode;

  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <div className="font-bold text-[9.5px] text-gray-800 mb-2 border-b border-gray-200 pb-1">
          Physical Address
        </div>
        <div className="space-y-2">
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Unit / Complex</div>
            <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">
              {physLine1}
            </div>
          </div>
          <div>
            <div className="text-[8px] text-gray-500 uppercase">Street Name & Number</div>
            <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">
              {physLine2}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <div className="text-[8px] text-gray-500 uppercase">Suburb / City</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">
                {physSuburb}
              </div>
            </div>
            <div>
              <div className="text-[8px] text-gray-500 uppercase">Code</div>
              <div className="border-b border-gray-300 bg-gray-50/30 h-5 text-[9px] text-blue-900">
                {physCode}
              </div>
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
export function renderSpacer(data: SpacerData) {
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
export function renderImageAsset(data: ImageData) {
  return (
    <div
      className={cn(
        'w-full flex mb-2',
        data.align === 'center'
          ? 'justify-center'
          : data.align === 'right'
            ? 'justify-end'
            : 'justify-start',
      )}
    >
      <div className="flex flex-col gap-1">
        {data.src ? (
          <img
            src={data.src}
            alt="Form Asset"
            style={{
              width: data.width || '100%',
              maxHeight: '100mm',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded p-8 text-center text-gray-400">
            Image placeholder
          </div>
        )}
        {data.caption && (
          <div className="text-[8px] text-gray-500 italic text-center">{data.caption}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Matches: RepeaterBlock.tsx
 * FIX: Renders table-style header + data rows (matching registry layout)
 * Added: actual data iteration from formData when available
 */
