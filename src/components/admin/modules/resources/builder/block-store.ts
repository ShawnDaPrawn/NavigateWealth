/**
 * Block Store — the runtime registry of block definitions.
 *
 * Separated from registry.ts so that block files that need to look up
 * sibling blocks (e.g. ContainerBlock rendering nested children) can
 * import from here without creating a circular dependency with the
 * registration entry-point.
 *
 * Dependency graph:
 *   block-store.ts  ← registry.ts  (imports store + registers blocks)
 *   block-store.ts  ← blocks/*.tsx  (import BlockDefinition type + getBlockDefinition)
 *   registry.ts     ← blocks/*.tsx  (registry re-exports everything for convenience)
 */

import { ReactNode } from 'react';
import { BlockType, FormBlock } from './types';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// BlockDefinition — the canonical shape every block must satisfy
// ============================================================================
export interface BlockDefinition {
  type: BlockType;
  label: string;
  icon: LucideIcon;
  category: 'layout' | 'content' | 'data_entry' | 'tables' | 'signatures' | 'client_data' | 'compliance' | 'admin';
  description?: string;
  initialData: Record<string, unknown>;
  /** Render the block on the A4 canvas (WYSIWYG preview). */
  render: (props: { block: FormBlock }) => ReactNode;
  /** Render the properties-panel editor for this block. */
  editor: (props: { block: FormBlock; onChange: (key: string | Record<string, unknown>, value?: unknown) => void }) => ReactNode;
}

// ============================================================================
// Registry store and accessors
// ============================================================================
export const BLOCK_REGISTRY: Record<string, BlockDefinition> = {};

export const registerBlock = (definition: BlockDefinition) => {
  BLOCK_REGISTRY[definition.type] = definition;
};

export const getBlockDefinition = (type: BlockType): BlockDefinition | undefined => {
  return BLOCK_REGISTRY[type];
};