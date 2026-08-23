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
import type { ResolveFunction } from './renderBlockShared';
import {
  renderSectionHeader,
  renderText,
  renderFieldGrid,
  renderSignature,
  renderTable,
  renderCheckboxTable,
  renderRadioOptions,
} from './renderBlockBasics';
import {
  renderClientSummary,
  renderFinancialTable,
  renderComplianceQuestion,
  renderRiskProfile,
  renderFinePrint,
  renderOfficeUse,
  renderClauseInitial,
  renderAttachmentPlaceholder,
  renderInstructionalCallout,
} from './renderBlockSummaries';
import {
  renderCombInput,
  renderBankDetails,
  renderBeneficiaryTable,
  renderWitnessSignature,
  renderAddressBlock,
  renderSpacer,
  renderImageAsset,
} from './renderBlockStructured';
import {
  renderRepeater,
  renderSmartClause,
  renderNonBreakingSignature,
} from './renderBlockComposites';

/**
 * Main block renderer function
 * Routes each block type to its specific renderer
 */
export const renderBlock = (
  block: FormBlock,
  data: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
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
      console.warn(
        '[renderBlock] Unknown block type:',
        (block as unknown as Record<string, unknown>).type,
      );
      return null;
  }
};

// renderContainer stays beside the dispatcher: it recursively calls
// renderBlock for its children, and living here keeps the module graph
// acyclic (the slices never import this file).
function renderContainer(
  data: ContainerData,
  formData: Record<string, unknown>,
  resolveNestedKey: ResolveFunction,
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
          <div key={nestedBlock.id}>{renderBlock(nestedBlock, formData, resolveNestedKey)}</div>
        ))}
      </div>
    );
  }

  return null; // Empty container — nothing to render in PDF
}
