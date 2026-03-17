/**
 * Dynamic Form Renderer
 * Renders forms dynamically from JSON block definitions
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { BasePdfLayout } from '../templates/BasePdfLayout';
import { FormBlock } from '../builder/types';
import { DynamicFormRendererProps } from '../types';
import { renderBlock } from './renderBlock';

/**
 * Helper function to resolve nested object paths
 * @example resolveNestedKey(obj, 'client.firstName') => obj.client.firstName
 * @example resolveNestedKey(obj, '{{personalInformation.idNumber}}') => obj.personalInformation.idNumber
 */
export const resolveNestedKey = (obj: Record<string, unknown>, path: string): unknown => {
  if (!path) return undefined;
  
  // Strip template syntax if present: {{ key }} -> key
  const cleanPath = path.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  
  // First try direct access (flat key)
  if (obj[cleanPath] !== undefined) {
    return obj[cleanPath];
  }
  
  // Then try nested path
  const keys = cleanPath.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
};

/**
 * Render page content from blocks.
 * Only section_header blocks receive the `.section` class (which carries the 6mm
 * top margin defined in BASE_PDF_CSS). All other blocks flow naturally without
 * extra margin to match the compact sizing of the consent form reference.
 */
const renderPageContent = (blocks: FormBlock[], data: Record<string, unknown>) => {
  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} className={block.type === 'section_header' ? 'section' : undefined}>
          {renderBlock(block, data, resolveNestedKey)}
        </div>
      ))}
    </div>
  );
};

/**
 * Dynamic Form Renderer Component
 * Renders forms from JSON schema with proper pagination
 */
export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  data = {},
  blocks = [],
  formName = 'Untitled Form',
}) => {
  // If no blocks, show empty state
  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Dynamic Form Preview</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-2">
          This form is generated from a JSON schema and stored in the database.
          Add blocks in the editor to see content here.
        </p>
      </div>
    );
  }

  // Split blocks into pages
  const pages = React.useMemo(() => {
    const pagesList: React.ReactNode[] = [];
    let currentBlocks: FormBlock[] = [];
    
    blocks.forEach((block) => {
      if (block.type === 'page_break') {
        pagesList.push(renderPageContent(currentBlocks, data));
        currentBlocks = [];
      } else {
        currentBlocks.push(block);
      }
    });
    
    // Push final page
    if (currentBlocks.length > 0) {
      pagesList.push(renderPageContent(currentBlocks, data));
    }
    
    return pagesList;
  }, [blocks, data]);

  return (
    <BasePdfLayout 
      docTitle={formName}
      pages={pages}
    />
  );
};

export default DynamicFormRenderer;