export type BlockType = 
  | 'section_header' 
  | 'text' 
  | 'field_grid' 
  | 'table' 
  | 'checkbox_table' 
  | 'radio_options' 
  | 'signature' 
  | 'page_break'
  | 'client_summary'
  | 'financial_table'
  | 'compliance_question'
  | 'risk_profile'
  | 'fine_print'
  | 'office_use'
  | 'clause_initial'
  | 'attachment_placeholder'
  | 'instructional_callout'
  | 'comb_input'
  | 'bank_details'
  | 'beneficiary_table'
  | 'witness_signature'
  | 'address_block'
  | 'spacer'
  | 'image_asset'
  | 'repeater'
  | 'smart_clause'
  | 'container'
  | 'non_breaking_signature';

export interface BlockData {
  [key: string]: unknown;
}

export interface FormBlock {
  id: string;
  type: BlockType;
  data: BlockData;
  /** Phase 2 — Conditional visibility rule (show/hide based on field values) */
  visibilityRule?: {
    matchAny: boolean;
    conditions: Array<{
      fieldKey: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'is_empty' | 'greater_than' | 'less_than';
      value?: string | number;
    }>;
  };
}

export interface FormPage {
  id: string;
  blocks: FormBlock[];
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string;
  pages: FormPage[];
  lastUpdated: string;
}

// Block Specific Data Interfaces

export interface SectionHeaderData extends BlockData {
  number: string;
  title: string;
}

export interface TextData extends BlockData {
  content: string; // HTML or Markdown
}

export interface FieldGridItem {
  label: string;
  placeholder?: string;
  key?: string; // For data binding
  required?: boolean;
  /** Phase 2 — Validation rules for interactive form rendering */
  validationRules?: Array<{
    type: string;
    value?: string | number;
    message: string;
  }>;
}

export interface FieldGridData extends BlockData {
  columns: 2 | 3 | 4;
  fields: FieldGridItem[];
}

export interface TableCell {
  type: 'static' | 'field';
  value: string; // Static text or Field ID/Path
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableData extends BlockData {
  hasColumnHeaders: boolean;
  hasRowHeaders: boolean;
  columnHeaders: string[]; // Text for column headers
  rowHeaders: string[];    // Text for row headers
  rows: TableRow[];
}

export interface CheckboxTableData extends BlockData {
  columns: string[];
  rows: string[];
}

export interface RadioOptionsData extends BlockData {
  label: string;
  options: string[];
  layout: 'horizontal' | 'vertical';
}

export interface SignatureData extends BlockData {
  signatories: { label: string; key: string }[];
  showDate: boolean;
}

export interface ClientSummaryData extends BlockData {
  title: string; // e.g. "Personal Details"
}

export interface FinancialTableData extends BlockData {
  items: { description: string; value: string }[];
  showTotal: boolean;
  currencySymbol: string;
}

export interface ComplianceQuestionData extends BlockData {
  question: string;
  showDetails: boolean;
  detailsLabel?: string;
}

export interface RiskProfileData extends BlockData {
  level: 1 | 2 | 3 | 4 | 5;
  labels: string[]; // e.g. ["Conservative", "Moderate", "Aggressive"]
}

export interface FinePrintData extends BlockData {
  content: string;
  columns: 2 | 3;
}

export interface OfficeUseData extends BlockData {
  title: string;
  fields: string[];
}

export interface ClauseInitialData extends BlockData {
  text: string;
  initialLabel: string;
}

export interface AttachmentPlaceholderData extends BlockData {
  label: string;
  height: string; // e.g. "40mm"
}

export interface InstructionalCalloutData extends BlockData {
  text: string;
  type: 'info' | 'warning' | 'stop';
}

export interface CombInputData extends BlockData {
  label: string;
  charCount: number; // e.g. 13 for SA ID
  value?: string;
  key?: string; // Mapped key ID
}

export interface BankDetailsData extends BlockData {
  title: string;
  showAuthorization: boolean;
}

export interface BeneficiaryTableData extends BlockData {
  rowCount: number;
}

export interface WitnessSignatureData extends BlockData {
  mainLabel: string;
  showWitnesses: boolean;
}

export interface AddressBlockData extends BlockData {
  showPostal: boolean;
}

export interface SpacerData extends BlockData {
  height: string; // e.g. "10mm" or "2rem"
  showLine: boolean;
}

export interface ImageData extends BlockData {
  src: string;
  width: string; // "100%", "50%", "200px"
  align: 'left' | 'center' | 'right';
  caption?: string;
}

export interface SmartClauseData extends BlockData {
  clauseNumber?: string; // If empty, auto-calc (future) or hidden
  title?: string;
  content: string; // "I give {amount} to {name}"
  variables: { key: string; label: string; defaultValue?: string }[];
}

export interface RepeaterColumn {
  header: string;
  key: string;
  width?: string; // e.g. "30%"
}

export interface RepeaterData extends BlockData {
  title?: string;
  variableName: string; // e.g. "assets"
  columns: RepeaterColumn[];
  emptyMessage?: string;
  userPopulated?: boolean; // When true, users can add/edit/delete rows in interactive mode
}

export interface ContainerData extends BlockData {
  conditionVariable?: string; // e.g. "hasChildren"
  conditionValue?: string; // e.g. "true"
  conditionOperator?: 'equals' | 'not_equals' | 'exists' | 'not_exists';
  blocks: FormBlock[]; // Nested blocks
}

export interface NonBreakingSignatureData extends BlockData {
  signatories: { label: string; key: string }[];
}