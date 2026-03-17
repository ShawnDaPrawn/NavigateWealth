import React, { useMemo, useCallback, useState } from 'react';
import { FormBlock, BlockType } from './types';
import { cn } from '../../../../ui/utils';
import { BASE_PDF_CSS } from '../templates/BasePdfLayout';
import { LETTER_CSS } from '../templates/LetterheadPdfLayout';
import type { LetterMeta } from '../templates/LetterheadPdfLayout';
import { resolveSignatories } from '../templates/LetterheadPdfLayout';
import { resolveRecipients } from '../templates/LetterheadPdfLayout';
import { getBlockDefinition } from './registry';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  GripVertical,
} from 'lucide-react';

interface FormCanvasProps {
  blocks: FormBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onDeleteBlock?: (id: string) => void;
  onMoveBlock?: (id: string, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (id: string) => void;
  onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
  /** Called when a block is moved from top-level into a container */
  onMoveBlockToContainer?: (blockId: string, containerId: string) => void;
  /** Called when a toolbox item is dropped into a container */
  onAddBlockToContainer?: (type: BlockType, containerId: string) => void;
  /** Called when a toolbox item is dropped on the canvas (not into a container) */
  onAddToolboxBlock?: (type: BlockType, atIndex?: number) => void;
  docTitle?: string;
  issueDate?: string;
  category?: string;
  letterMeta?: LetterMeta;
}

// ============================================================================
// DRAG AND DROP STATE (module-level for cross-component communication)
// ============================================================================
interface DragState {
  blockId: string;
  blockIndex: number; // Index in the flat blocks array
}

// ============================================================================
// BLOCK ACTION TOOLBAR
// Shows move up/down, duplicate, delete on hover/selection
// ============================================================================
const BlockActionToolbar = ({
  blockId,
  isFirst,
  isLast,
  onMove,
  onDuplicate,
  onDelete,
}: {
  blockId: string;
  isFirst: boolean;
  isLast: boolean;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) => (
  <div
    className="absolute -right-1 top-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={(e) => { e.stopPropagation(); onMove?.(blockId, 'up'); }}
      disabled={isFirst}
      className={cn(
        "w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm transition-colors",
        isFirst ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
      )}
      title="Move Up (Alt+↑)"
    >
      <ChevronUp className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onMove?.(blockId, 'down'); }}
      disabled={isLast}
      className={cn(
        "w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm transition-colors",
        isLast ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
      )}
      title="Move Down (Alt+↓)"
    >
      <ChevronDown className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onDuplicate?.(blockId); }}
      className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors"
      title="Duplicate (Ctrl+D)"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete?.(blockId); }}
      className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
      title="Delete (Del)"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ============================================================================
// DROP INDICATOR — visual line shown between blocks during drag
// ============================================================================
const DropIndicator = ({ isActive }: { isActive: boolean }) => (
  <div
    className={cn(
      "h-1 w-full rounded-full transition-all duration-150",
      isActive
        ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)] my-0.5"
        : "bg-transparent my-0"
    )}
  />
);

// ============================================================================
// CONTAINER DROP ZONE — wraps container blocks on the canvas to accept drops
// ============================================================================
const ContainerDropZone = ({
  containerId,
  children,
  onMoveBlockToContainer,
  onAddBlockToContainer,
}: {
  containerId: string;
  children: React.ReactNode;
  onMoveBlockToContainer?: (blockId: string, containerId: string) => void;
  onAddBlockToContainer?: (type: BlockType, containerId: string) => void;
}) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        // Accept drops from toolbox or canvas blocks
        if (
          e.dataTransfer.types.includes('application/x-block-type') ||
          e.dataTransfer.types.includes('text/plain')
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          setIsOver(true);
        }
      }}
      onDragLeave={(e) => {
        // Only clear when truly leaving this element, not entering a child
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);

        // Check if it's a toolbox item
        const blockType = e.dataTransfer.getData('application/x-block-type');
        if (blockType) {
          onAddBlockToContainer?.(blockType as BlockType, containerId);
          return;
        }

        // Otherwise it's an existing canvas block
        const blockId = e.dataTransfer.getData('text/plain');
        if (blockId && blockId !== containerId) {
          onMoveBlockToContainer?.(blockId, containerId);
        }
      }}
    >
      {children}

      {/* Drop overlay — shown when dragging over the container */}
      {isOver && (
        <div className="absolute inset-0 bg-purple-100/60 border-2 border-dashed border-purple-400 rounded pointer-events-none z-10 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-purple-600 text-white text-[10px] px-3 py-1.5 rounded-full font-medium shadow-lg flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Drop inside container
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DRAGGABLE BLOCK WRAPPER
// Handles native HTML5 drag/drop for block reordering
// ============================================================================
const DraggableBlock = ({
  block,
  flatIndex,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onDelete,
  onMove,
  onDuplicate,
  dragState,
  dropTargetIndex,
  onDragStart,
  onDragEnd,
  onDragOverBlock,
  onDropOnBlock,
  renderBlockContent,
  isPageFirstBlock,
  onAddToolboxBlock,
  isToolboxDragActive,
}: {
  block: FormBlock;
  flatIndex: number;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  onDuplicate?: (id: string) => void;
  dragState: DragState | null;
  dropTargetIndex: number | null;
  onDragStart: (blockId: string, flatIndex: number) => void;
  onDragEnd: () => void;
  onDragOverBlock: (targetIndex: number) => void;
  onDropOnBlock: () => void;
  renderBlockContent: (block: FormBlock) => React.ReactNode;
  isPageFirstBlock: boolean;
  onAddToolboxBlock?: (type: BlockType, atIndex?: number) => void;
  isToolboxDragActive?: boolean;
}) => {
  const isDragging = dragState?.blockId === block.id;
  // Show drop indicators for both canvas block reordering and toolbox drops
  const isAnyDragActive = (dragState !== null) || !!isToolboxDragActive;
  const showDropBefore = dropTargetIndex === flatIndex && isAnyDragActive && (dragState === null || (dragState.blockIndex !== flatIndex && dragState.blockIndex !== flatIndex - 1));
  const showDropAfter = dropTargetIndex === flatIndex + 1 && isAnyDragActive && (dragState === null || (dragState.blockIndex !== flatIndex && dragState.blockIndex !== flatIndex + 1));

  return (
    <div className="contents">
      {/* Drop indicator before block */}
      {isPageFirstBlock && <DropIndicator isActive={showDropBefore} />}

      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', block.id);
          e.dataTransfer.setData('text/x-source', 'canvas');
          // Use a small delay so the drag image captures properly
          setTimeout(() => onDragStart(block.id, flatIndex), 0);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          // Determine if dropping before or after based on mouse Y position
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const targetIdx = e.clientY < midY ? flatIndex : flatIndex + 1;
          onDragOverBlock(targetIdx);
        }}
        onDrop={(e) => {
          e.preventDefault();
          // Check if this is a toolbox item drop (not a canvas block reorder)
          const blockType = e.dataTransfer.getData('application/x-block-type');
          if (blockType && onAddToolboxBlock) {
            // Determine insert position based on mouse Y relative to block
            const rect = e.currentTarget.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertIndex = e.clientY < midY ? flatIndex : flatIndex + 1;
            onAddToolboxBlock(blockType as BlockType, insertIndex);
            return;
          }
          onDropOnBlock();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        className={cn(
          "relative group cursor-pointer transition-all duration-200 rounded",
          // Use ring (box-shadow) instead of border so selection/hover doesn't shift layout
          isSelected
            ? "ring-2 ring-blue-500 ring-offset-1 bg-blue-50/10"
            : "hover:ring-2 hover:ring-blue-200",
          isDragging && "opacity-40 scale-[0.98]",
          // Section headers get the PDF's .section margin (except if first on page)
          block.type === 'section_header' && !isPageFirstBlock ? 'mt-[6mm]' : ''
        )}
      >
        {/* Drag Handle — visible on hover, left side */}
        <div
          className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <div className="w-5 h-8 flex items-center justify-center rounded bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-gray-600 hover:border-gray-300">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Block Action Toolbar — visible on hover, right side */}
        <BlockActionToolbar
          blockId={block.id}
          isFirst={isFirst}
          isLast={isLast}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />

        {/* Block Type Label — visible on selection */}
        {isSelected && (
          <div className="absolute -top-2.5 left-2 z-10 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded font-medium tracking-wide uppercase">
            {getBlockDefinition(block.type)?.label || block.type}
          </div>
        )}

        {renderBlockContent(block)}
      </div>

      {/* Drop indicator after block */}
      <DropIndicator isActive={showDropAfter} />
    </div>
  );
};

// ============================================================================
// MAIN FORM CANVAS COMPONENT
// ============================================================================
export const FormCanvas = ({ 
    blocks, 
    selectedBlockId, 
    onSelectBlock,
    onDeleteBlock,
    onMoveBlock,
    onDuplicateBlock,
    onReorderBlocks,
    onMoveBlockToContainer,
    onAddBlockToContainer,
    onAddToolboxBlock,
    docTitle = "Client Consent Form",
    issueDate = new Date().toLocaleDateString('en-GB'),
    category = "General",
    letterMeta
}: FormCanvasProps) => {

  // -- DRAG STATE --
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  // Track if a toolbox drag is happening over the canvas
  const [isToolboxDragActive, setIsToolboxDragActive] = useState(false);

  const handleDragStart = useCallback((blockId: string, flatIndex: number) => {
    setDragState({ blockId, blockIndex: flatIndex });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTargetIndex(null);
    setIsToolboxDragActive(false);
  }, []);

  const handleDragOverBlock = useCallback((targetIndex: number) => {
    setDropTargetIndex(targetIndex);
  }, []);

  const handleDropOnBlock = useCallback(() => {
    if (dragState && dropTargetIndex !== null && onReorderBlocks) {
      let adjustedTarget = dropTargetIndex;
      // If dropping after the dragged item's original position, adjust for removal
      if (dragState.blockIndex < adjustedTarget) {
        adjustedTarget -= 1;
      }
      onReorderBlocks(dragState.blockIndex, adjustedTarget);
    }
    setDragState(null);
    setDropTargetIndex(null);
    setIsToolboxDragActive(false);
  }, [dragState, dropTargetIndex, onReorderBlocks]);
  
  // -- PAGE SPLITTING LOGIC --
  const pages = useMemo(() => {
    const pagesList: { id: string, blocks: { block: FormBlock, flatIndex: number }[], breakBlockId?: string }[] = [];
    let currentBlocks: { block: FormBlock, flatIndex: number }[] = [];
    
    blocks.forEach((block, flatIndex) => {
      if (block.type === 'page_break') {
        pagesList.push({ 
          id: `page-${pagesList.length}`, 
          blocks: [...currentBlocks], 
          breakBlockId: block.id 
        });
        currentBlocks = [];
      } else {
        currentBlocks.push({ block, flatIndex });
      }
    });
    
    // Push the final page
    pagesList.push({ 
      id: `page-${pagesList.length}`, 
      blocks: [...currentBlocks] 
    });
    
    return pagesList;
  }, [blocks]);

  // -- BLOCK RENDERERS --
  // Note: Container blocks are wrapped with ContainerDropZone via the render loop,
  // not inside this function, so we don't add dependencies here.
  const renderBlockContent = useCallback((block: FormBlock) => {
    const definition = getBlockDefinition(block.type);
    if (definition) {
      return definition.render({ block });
    }

    switch (block.type) {
      case 'page_break':
        return null;
      default:
        return <div className="p-2 bg-red-50 text-red-500 text-xs">Unknown Block: {block.type}</div>;
    }
  }, []);

  // Wrap render for containers to include drop zone
  const renderBlockWithDropZone = useCallback((block: FormBlock) => {
    const content = renderBlockContent(block);

    if (block.type === 'container') {
      return (
        <ContainerDropZone
          containerId={block.id}
          onMoveBlockToContainer={onMoveBlockToContainer}
          onAddBlockToContainer={onAddBlockToContainer}
        >
          {content}
        </ContainerDropZone>
      );
    }

    return content;
  }, [renderBlockContent, onMoveBlockToContainer, onAddBlockToContainer]);

  // Handle drops on the canvas background (from toolbox)
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    const blockType = e.dataTransfer.getData('application/x-block-type');
    if (blockType && onAddToolboxBlock) {
      e.preventDefault();
      onAddToolboxBlock(blockType as BlockType);
    }
    setDropTargetIndex(null);
    setIsToolboxDragActive(false);
  }, [onAddToolboxBlock]);

  // Wrap toolbox block drop on existing blocks to also clean up drag state
  const handleToolboxDropOnBlock = useCallback((type: BlockType, atIndex?: number) => {
    if (onAddToolboxBlock) {
      onAddToolboxBlock(type, atIndex);
    }
    setDropTargetIndex(null);
    setIsToolboxDragActive(false);
  }, [onAddToolboxBlock]);

  return (
    <div 
      className="flex-1 bg-gray-100 overflow-y-auto p-8 flex flex-col items-center gap-8"
      onDragOver={(e) => {
        e.preventDefault();
        // Accept toolbox drops on canvas background
        if (e.dataTransfer.types.includes('application/x-block-type')) {
          e.dataTransfer.dropEffect = 'copy';
          if (!isToolboxDragActive) setIsToolboxDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        // Clear toolbox drag state when leaving the canvas entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsToolboxDragActive(false);
          setDropTargetIndex(null);
        }
      }}
      onDrop={handleCanvasDrop}
    >
      {/* Inject PDF styles for canvas WYSIWYG matching */}
      <style dangerouslySetInnerHTML={{ __html: category === 'Letters' ? LETTER_CSS : BASE_PDF_CSS }} />

      {/* Keyboard shortcuts hint */}
      <div className="w-[210mm] flex justify-end">
        <div className="text-[10px] text-gray-400 flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">S</kbd> Save</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Z</kbd> Undo</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">⇧Z</kbd> Redo</span>
          <span className="w-px h-3 bg-gray-300"></span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Alt</kbd>+<kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">↑↓</kbd> Move</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">D</kbd> Duplicate</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Esc</kbd> Deselect</span>
        </div>
      </div>
      
      {pages.map((page, pageIndex) => (
        <div className="contents" key={page.id}>
            {/* A4 Page Container — 210mm x 297mm */}
            <div 
                className="bg-white shadow-lg relative transition-all duration-200 pdf-preview-container"
                style={{ 
                    width: '210mm', 
                    minHeight: '297mm',
                    paddingLeft: '10mm',
                    paddingRight: '10mm',
                    paddingBottom: '23mm',
                    paddingTop: pageIndex === 0 ? '5mm' : '12.5mm',
                    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
                    fontSize: category === 'Letters' ? '10px' : '9.5px',
                    color: '#111827',
                }}
            >
                {/* DELETE PAGE BUTTON (For pages > 0) */}
                {pageIndex > 0 && onDeleteBlock && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const prevPage = pages[pageIndex - 1];
                      if (prevPage && prevPage.breakBlockId) {
                        onDeleteBlock(prevPage.breakBlockId);
                      }
                    }}
                    className="absolute -top-3 -right-3 z-50 bg-white text-red-500 border border-gray-200 shadow-sm p-1.5 rounded-full hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                    title="Delete Page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* ============================================================ */}
                {/* PAGE CHROME: Letterhead vs Form layout based on category     */}
                {/* ============================================================ */}

                {/* LETTER MODE — Professional letterhead */}
                {pageIndex === 0 && category === 'Letters' && (
                    <div className="contents">
                      {/* Letterhead Block */}
                      <div className="letterhead-block">
                        <div className="letterhead-brand">
                          <div className="letterhead-logo">
                            Navigate <span className="lh-accent">Wealth</span>
                          </div>
                          <div className="letterhead-tagline">
                            Independent Financial Advisory Services
                          </div>
                          <div className="letterhead-fsp">
                            Authorised Financial Services Provider &mdash; FSP 54606
                          </div>
                        </div>
                        <div className="letterhead-contact">
                          <strong>Wealthfront (Pty) Ltd</strong><br/>
                          t/a Navigate Wealth<br/>
                          Route 21 Corporate Park<br/>
                          25 Sovereign Drive, Milestone Place A<br/>
                          Centurion, 0178<br/><br/>
                          Tel: (012) 667 2505<br/>
                          Email: info@navigatewealth.co
                        </div>
                      </div>

                      {/* Date */}
                      <div className="letter-date">
                        {letterMeta?.date || new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>

                      {/* Recipients */}
                      {(() => {
                        const recipients = letterMeta ? resolveRecipients(letterMeta) : [];
                        return (
                          <div className="letter-recipient" style={{ opacity: recipients.length > 0 ? 1 : 0.4, fontSize: '10px', lineHeight: '1.6' }}>
                            {recipients.length > 0 ? (
                              <div className="contents">
                                {recipients.map((recipient, idx) => (
                                  <div key={idx} style={{ marginBottom: idx < recipients.length - 1 ? '3mm' : undefined }}>
                                    {recipient.name && <div style={{ fontWeight: 600 }}>{recipient.name}</div>}
                                    {recipient.title && <div>{recipient.title}</div>}
                                    {recipient.company && <div>{recipient.company}</div>}
                                    {recipient.address && <div style={{ whiteSpace: 'pre-line' }}>{recipient.address}</div>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="contents">
                                [Recipient Name]<br/>
                                [Title / Company]<br/>
                                [Address Line 1]<br/>
                                [City, Postal Code]
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Subject / Reference */}
                      {(() => {
                        const hasSubject = letterMeta?.subject || letterMeta?.reference;
                        const subjectText = letterMeta?.subject || (docTitle !== 'Company Letter' ? docTitle : '');
                        return (
                          <div className="letter-subject" style={{ opacity: (hasSubject || subjectText) ? 1 : 0.4 }}>
                            {letterMeta?.reference && (
                              <span>
                                <span className="subject-label">Ref: </span>
                                {letterMeta.reference}
                                {subjectText && <span>&nbsp;&mdash;&nbsp;</span>}
                              </span>
                            )}
                            <span>
                              <span className="subject-label">RE: </span>
                              {subjectText || '[Subject of correspondence]'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                )}

                {/* Subsequent page header for letters */}
                {pageIndex > 0 && category === 'Letters' && (
                    <div className="letter-continuation-header">
                      <span className="cont-brand">
                        Navigate <span className="cont-accent">Wealth</span>
                      </span>
                      <span>
                        {docTitle} &mdash; Page {pageIndex + 1}
                      </span>
                    </div>
                )}

                {/* FORM MODE — Standard form chrome */}
                {pageIndex === 0 && category !== 'Letters' && (
                  <div className="contents">
                    {/* MASTHEAD */}
                    <div className="top-masthead">
                        <div className="masthead-left">{(docTitle || 'DOCUMENT').toUpperCase()}</div>
                        <div className="masthead-right">
                            <strong>Wealthfront (Pty) Ltd</strong> t/a Navigate Wealth &nbsp;|&nbsp; <strong>FSP 54606</strong><br/>
                            Email: info@navigatewealth.co
                        </div>
                    </div>

                    {/* HEADER */}
                    <div>
                        <header className="page-header-full">
                            <div className="header-row">
                                <div className="brand-block">
                                    <div className="logo">Navigate <span className="wealth">Wealth</span></div>
                                    <div className="brand-subline">Independent Financial Advisory Services</div>
                                </div>

                                <div className="doc-block">
                                    <h1 className="doc-title">{docTitle}</h1>
                                    <div className="meta-grid">
                                        <div className="meta-k">Issue date</div>
                                        <div className="meta-v">{issueDate}</div>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <hr className="section-divider" style={{ borderTop: '2px solid #6b7280', margin: '4mm 0 6mm 0' }} />
                    </div>
                  </div>
                )}

                {/* BLOCKS RENDERER — no gap; spacing is handled by individual
                     block styles (e.g. .section margin on section_headers)
                     to match the PDF output exactly */}
                <div className="flex flex-col" style={
                  category === 'Letters' && letterMeta
                    ? { fontSize: `${letterMeta.fontSize || 10}px`, lineHeight: letterMeta.lineHeight || 1.65 }
                    : undefined
                }>
                    {page.blocks.length === 0 && pageIndex === 0 && pages.length === 1 && (
                        <div className="text-center py-20 text-gray-300 border-2 border-dashed border-gray-200 rounded-lg">
                            Drag or click blocks from the toolbox to start building
                        </div>
                    )}

                    {page.blocks.map(({ block, flatIndex }, indexInPage) => (
                        <DraggableBlock
                          key={block.id}
                          block={block}
                          flatIndex={flatIndex}
                          isSelected={selectedBlockId === block.id}
                          isFirst={flatIndex === 0}
                          isLast={flatIndex === blocks.length - 1}
                          onSelect={onSelectBlock}
                          onDelete={onDeleteBlock}
                          onMove={onMoveBlock}
                          onDuplicate={onDuplicateBlock}
                          dragState={dragState}
                          dropTargetIndex={dropTargetIndex}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOverBlock={handleDragOverBlock}
                          onDropOnBlock={handleDropOnBlock}
                          renderBlockContent={renderBlockWithDropZone}
                          isPageFirstBlock={indexInPage === 0}
                          onAddToolboxBlock={handleToolboxDropOnBlock}
                          isToolboxDragActive={isToolboxDragActive}
                        />
                    ))}
                </div>

                {/* LETTER CLOSING / SIGNATORY — rendered from letterMeta after all blocks on the last page */}
                {category === 'Letters' && pageIndex === pages.length - 1 && (() => {
                  const signatories = letterMeta ? resolveSignatories(letterMeta) : [];
                  const hasClosing = letterMeta?.closing || signatories.length > 0;
                  if (!hasClosing) return null;
                  return (
                    <div className="letter-closing">
                      {letterMeta?.closing && (
                        <div className="closing-regards">{letterMeta.closing},</div>
                      )}
                      {signatories.length > 0 && (
                        <div className="closing-signatories">
                          {signatories.map((signatory, index) => (
                            <div key={index} className="closing-signatory">
                              <div className="closing-signature-line" />
                              {signatory.name && (
                                <div className="closing-name">{signatory.name}</div>
                              )}
                              {signatory.title && (
                                <div className="closing-title">{signatory.title} &mdash; Navigate Wealth</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* FOOTER */}
                {category === 'Letters' ? (
                  <footer className="letter-footer">
                    <div className="letter-footer-cols">
                      <div className="lf-col">
                        <span className="footer-company">Wealthfront (Pty) Ltd</span>
                        {' '}trading as Navigate Wealth is an Authorised Financial Services Provider &ndash; FSP 54606.
                        Registration Number: 2024/071953/07.
                      </div>
                      <div className="lf-col">
                        Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178.
                        Tel: (012) 667 2505 | Email: info@navigatewealth.co
                      </div>
                      <div className="lf-page">
                        Page {pageIndex + 1}/{pages.length}
                      </div>
                    </div>
                  </footer>
                ) : (
                  <footer className="pdf-footer">
                    <div className="footer-row">
                      <div className="footer-page">Page {pageIndex + 1} of {pages.length}</div>
                      <div className="footer-text">
                        Wealthfront (Pty) Ltd, trading as Navigate Wealth, is an Authorised Financial Services Provider – FSP 54606. Registration Number: 2024/071953/07. Located at Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178. For inquiries, please contact us at Tel: (012) 667 2505.
                      </div>
                    </div>
                  </footer>
                )}
            </div>

            {/* PAGE BREAK SEPARATOR / HANDLE */}
            {page.breakBlockId && (
                <div 
                    onClick={() => onSelectBlock(page.breakBlockId!)}
                    className={cn(
                        "w-[210mm] relative h-6 flex items-center justify-center cursor-pointer group",
                        "opacity-40 hover:opacity-100 transition-opacity duration-200",
                        selectedBlockId === page.breakBlockId ? "opacity-100" : ""
                    )}
                >
                    <div className="h-px w-full bg-blue-300 absolute top-1/2 -translate-y-1/2"></div>
                    <div className="relative z-10 bg-blue-50 text-blue-600 text-[10px] font-medium px-3 py-1 rounded-full border border-blue-200 shadow-sm">
                        Page Break (Click to Select)
                    </div>
                </div>
            )}
        </div>
      ))}
      
      {/* Spacer for bottom scrolling */}
      <div className="h-20"></div>
    </div>
  );
};