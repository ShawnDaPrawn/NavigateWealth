/**
 * Letter Renderer
 *
 * Renders company letters from JSON block definitions using the
 * professional LetterheadPdfLayout. Analogous to DynamicFormRenderer
 * but tailored for correspondence.
 *
 * Letter metadata (recipient, subject, reference, closing) is stored
 * in a top-level `letterMeta` property on the resource and passed
 * through to the layout.
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { LetterheadPdfLayout, LetterMeta } from '../templates/LetterheadPdfLayout';
import { FormBlock } from '../builder/types';
import { renderBlock } from './renderBlock';
import { resolveNestedKey } from './DynamicFormRenderer';

// ============================================================================
// TYPES
// ============================================================================

export interface LetterRendererProps {
  data?: Record<string, unknown>;
  blocks?: FormBlock[];
  formName?: string;
  letterMeta?: LetterMeta;
}

// ============================================================================
// PAGE CONTENT RENDERER
// ============================================================================

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

// ============================================================================
// LETTER RENDERER COMPONENT
// ============================================================================

export const LetterRenderer: React.FC<LetterRendererProps> = ({
  data = {},
  blocks = [],
  letterMeta = {},
}) => {
  // Split blocks into pages at page_break markers. Declared before the early
  // return below so the hook always runs in the same order (rules-of-hooks);
  // guarded internally for the empty case.
  const pages = React.useMemo(() => {
    const pagesList: React.ReactNode[] = [];
    if (!blocks || blocks.length === 0) return pagesList;
    let currentBlocks: FormBlock[] = [];

    blocks.forEach((block) => {
      if (block.type === 'page_break') {
        pagesList.push(renderPageContent(currentBlocks, data));
        currentBlocks = [];
      } else {
        currentBlocks.push(block);
      }
    });

    if (currentBlocks.length > 0) {
      pagesList.push(renderPageContent(currentBlocks, data));
    }

    return pagesList;
  }, [blocks, data]);

  // Empty state
  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Letter Preview</h3>
        <p className="text-sm text-gray-500 max-w-sm mt-2">
          Add blocks in the editor to compose your letter content.
        </p>
      </div>
    );
  }

  return <LetterheadPdfLayout pages={pages} meta={letterMeta} />;
};

export default LetterRenderer;
