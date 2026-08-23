/**
 * Model for the form builder: the save payload shape, the API save call
 * shared by manual save and autosave, the per-block initial data, and the
 * letter starter content. Moved verbatim from FormBuilder.tsx.
 */
import type { FormBlock, BlockType } from './types';
import type { LetterMeta } from '../templates/LetterheadPdfLayout';
import { api } from '../../../../../utils/api';
import { logger } from '../../../../../utils/logger';
import { getBlockDefinition } from './registry';

// Simple ID generator
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15);
};

// ============================================================================
// Payload shape sent to the API
// ============================================================================
export interface SavePayload {
  title: string;
  description: string;
  category: string;
  blocks: FormBlock[];
  clientTypes: string[];
  version: string;
  letterMeta?: LetterMeta;
}

// initialData arrives as a loose Record from callers; this is the subset of
// fields the builder actually reads. Aliased locally (not on the prop) so
// callers passing a looser record are unaffected.
export interface FormResourceData {
  id?: string;
  name?: string;
  category?: string;
  description?: string;
  blocks?: FormBlock[];
  letterMeta?: LetterMeta;
  clientTypes?: string[];
  version?: string;
}

// ============================================================================
// Core API save — shared by manual save and autosave
// Returns the response data on success, throws on failure.
// ============================================================================
export async function saveToApi(
  payload: SavePayload,
  resourceId: string | undefined,
): Promise<Record<string, unknown>> {
  logger.info('[FormBuilder] Saving form', {
    isUpdate: !!resourceId,
    formId: resourceId,
    title: payload.title,
    blocksCount: payload.blocks.length,
  });

  const data = resourceId
    ? await api.put<Record<string, unknown>>(`/resources/${resourceId}`, payload)
    : await api.post<Record<string, unknown>>('/resources', payload);

  logger.info('[FormBuilder] Save successful', { data });
  return data;
}

// ============================================================================
// INITIAL DATA FACTORIES
// ============================================================================

export const getInitialBlockData = (type: BlockType) => {
  const definition = getBlockDefinition(type);
  if (definition) {
    return { ...definition.initialData }; // Return a copy
  }

  switch (type) {
    case 'section_header':
      return { number: '1.', title: 'SECTION TITLE' };
    case 'text':
      return { content: '<p>Enter your text here...</p>' };
    case 'field_grid':
      return { columns: 2, fields: [{ label: 'First Name' }, { label: 'Last Name' }] };
    case 'signature':
      return { signatories: [{ label: 'Client Signature', key: 'client' }], showDate: true };
    case 'table':
      return {
        hasColumnHeaders: true,
        hasRowHeaders: false,
        columnHeaders: ['Column 1', 'Column 2'],
        rowHeaders: ['Row 1', 'Row 2'],
        rows: [
          {
            id: 'row-1',
            cells: [
              { type: 'static', value: '' },
              { type: 'static', value: '' },
            ],
          },
          {
            id: 'row-2',
            cells: [
              { type: 'static', value: '' },
              { type: 'static', value: '' },
            ],
          },
        ],
      };
    case 'checkbox_table':
      return {
        columns: ['Yes', 'No', 'N/A'],
        rows: ['Question 1', 'Question 2', 'Question 3'],
      };
    case 'radio_options':
      return {
        label: 'Select an option:',
        options: ['Option 1', 'Option 2', 'Option 3'],
        layout: 'vertical',
      };
    default:
      return {};
  }
};

// ============================================================================
// LETTER STARTER BLOCKS — pre-populated content for new letters
// ============================================================================

export function getLetterStarterBlocks(): FormBlock[] {
  return [
    {
      id: generateId(),
      type: 'text',
      data: {
        content: '<p>Dear Sir / Madam,</p>',
      },
    },
    {
      id: generateId(),
      type: 'text',
      data: {
        content:
          '<p>We write to you regarding your financial planning portfolio with Navigate Wealth. Please find the details outlined below.</p>',
      },
    },
    {
      id: generateId(),
      type: 'text',
      data: {
        content:
          '<p>[Continue composing your letter here. You can add tables, field grids, signature blocks, and other components from the toolbox on the left.]</p>',
      },
    },
    {
      id: generateId(),
      type: 'text',
      data: {
        content:
          '<p>Should you have any queries or require further clarification, please do not hesitate to contact our office.</p>',
      },
    },
  ];
}
