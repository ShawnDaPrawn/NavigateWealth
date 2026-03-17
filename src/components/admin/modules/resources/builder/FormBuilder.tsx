import React, { useState, useCallback, useMemo } from 'react';
import { Toolbox } from './Toolbox';
import { FormCanvas } from './FormCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { FormBlock, BlockType } from './types';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useAutosave, AutosaveStatus } from './hooks/useAutosave';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import { ArrowLeft, Save, Loader2, Undo2, Redo2, Check, AlertCircle, Cloud, CloudOff, Eye, PenTool } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { getBlockDefinition } from './registry';
import type { LetterMeta } from '../templates/LetterheadPdfLayout';

// Phase 1/Phase 2 imports
import { TemplateGallery } from './components/TemplateGallery';
import { STARTER_TEMPLATES, type StarterTemplate, FORM_STATUS_CONFIG, type FormStatus } from './constants';

// Helper to get auth token from localStorage
const getAuthToken = (): string => {
  try {
    const storageKey = `sb-${projectId}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const session = JSON.parse(stored);
      return session.access_token || publicAnonKey;
    }
  } catch (e) {
    console.error('[FormBuilder] Error reading auth token:', e);
  }
  return publicAnonKey;
};

// Simple ID generator
const generateId = () => {
    return Math.random().toString(36).substring(2, 15);
};

// ============================================================================
// Payload shape sent to the API
// ============================================================================
interface SavePayload {
  title: string;
  description: string;
  category: string;
  blocks: FormBlock[];
  clientTypes: string[];
  version: string;
  letterMeta?: LetterMeta;
}

// ============================================================================
// Core API save — shared by manual save and autosave
// Returns the response data on success, throws on failure.
// ============================================================================
async function saveToApi(
  payload: SavePayload,
  resourceId: string | undefined
): Promise<Record<string, unknown>> {
  const token = getAuthToken();

  if (token === publicAnonKey) {
    throw new Error('You must be logged in to save templates');
  }

  const url = resourceId
    ? `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/${resourceId}`
    : `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources`;

  const method = resourceId ? 'PUT' : 'POST';

  console.log('[FormBuilder] Saving form:', {
    isUpdate: !!resourceId,
    formId: resourceId,
    title: payload.title,
    blocksCount: payload.blocks.length,
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[FormBuilder] Save failed:', response.status, errorData);
    throw new Error(errorData.error || 'Failed to save form');
  }

  const data = await response.json();
  console.log('[FormBuilder] Save successful:', data);
  return data;
}

// ============================================================================
// FormBuilder component
// ============================================================================

interface FormBuilderProps {
  onBack: () => void;
  onSave?: (resource?: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>; // For editing existing forms later
  /** When set, opens the builder in letter mode with starter content */
  mode?: 'form' | 'letter';
}

export const FormBuilder = ({ onBack, onSave, initialData, mode = 'form' }: FormBuilderProps) => {
  // Determine if this is letter mode (from prop or from loaded category)
  const isLetterMode = mode === 'letter' || initialData?.category === 'Letters';

  // -- Phase 1: Template Gallery for new resources --
  const [showTemplateGallery, setShowTemplateGallery] = useState(
    !initialData && mode !== 'letter' // Show gallery for new forms, not edits or letters
  );
  const [templateBlocks, setTemplateBlocks] = useState<FormBlock[] | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState<string | null>(null);

  const handleSelectTemplate = useCallback((template: StarterTemplate) => {
    // Deep-clone blocks to avoid sharing references
    const clonedBlocks = template.blocks.length > 0
      ? JSON.parse(JSON.stringify(template.blocks)).map((b: FormBlock) => ({
          ...b,
          id: generateId(), // Fresh IDs to avoid collisions
        }))
      : [];
    setTemplateBlocks(clonedBlocks);
    setTemplateCategory(template.category);
    setTemplateTitle(template.id === 'blank' || template.id === 'blank_letter' ? null : template.name);
    setShowTemplateGallery(false);
  }, []);

  // Show Template Gallery overlay for new forms
  if (showTemplateGallery) {
    return (
      <TemplateGallery
        mode={mode}
        onSelectTemplate={handleSelectTemplate}
        onCancel={onBack}
      />
    );
  }

  // Resolve initial blocks: template selection > initialData > defaults
  const resolvedInitialBlocks = templateBlocks ?? initialData?.blocks ?? (isLetterMode && !initialData ? getLetterStarterBlocks() : []);
  const resolvedCategory = templateCategory ?? initialData?.category ?? (isLetterMode ? 'Letters' : 'Forms');
  const resolvedTitle = templateTitle ?? initialData?.name ?? (isLetterMode ? 'Company Letter' : 'Client Consent Form');

  return (
    <FormBuilderWorkspace
      onBack={onBack}
      onSave={onSave}
      initialData={initialData}
      mode={mode}
      resolvedInitialBlocks={resolvedInitialBlocks}
      resolvedCategory={resolvedCategory}
      resolvedTitle={resolvedTitle}
      isLetterMode={isLetterMode}
    />
  );
};

// ============================================================================
// FormBuilderWorkspace — the actual builder UI (extracted for template flow)
// ============================================================================

interface FormBuilderWorkspaceProps extends FormBuilderProps {
  resolvedInitialBlocks: FormBlock[];
  resolvedCategory: string;
  resolvedTitle: string;
  isLetterMode: boolean;
}

const FormBuilderWorkspace = ({
  onBack,
  onSave,
  initialData,
  mode = 'form',
  resolvedInitialBlocks,
  resolvedCategory,
  resolvedTitle,
  isLetterMode,
}: FormBuilderWorkspaceProps) => {

  // -- UNDO/REDO HISTORY --
  const {
    state: blocks,
    set: setBlocks,
    setWithMerge: setBlocksMerged,
    undo,
    redo,
    reset: resetBlocks,
    canUndo,
    canRedo,
    historySize,
    futureSize,
  } = useUndoRedo<FormBlock[]>(
    resolvedInitialBlocks,
    50
  );

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState(resolvedTitle);
  const [formCategory, setFormCategory] = useState(resolvedCategory);
  const [manualSaving, setManualSaving] = useState(false);

  // -- Phase 2: Preview mode toggle --
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewResponses, setPreviewResponses] = useState<Record<string, unknown>>({});

  // -- Letter metadata state (only relevant for letter-category resources) --
  const [letterMeta, setLetterMeta] = useState<LetterMeta>(
    initialData?.letterMeta || (isLetterMode && !initialData ? {
      closing: 'Yours faithfully',
      recipients: [{ name: '', title: '', company: '', address: '' }],
      signatories: [{ name: '', title: '' }],
    } : {})
  );

  // Resource ID — stateful so a new resource transitions to update mode after first save.
  // This prevents duplicate creation on subsequent saves and enables autosave.
  const [resourceId, setResourceId] = useState<string | undefined>(initialData?.id);
  const isNewResource = !resourceId;

  // If initialData changes (e.g. fresh edit), reset history
  React.useEffect(() => {
    if (initialData) {
      resetBlocks(initialData.blocks || []);
      setFormTitle(initialData.name || "Client Consent Form");
      setFormCategory(initialData.category || "Forms");
      setLetterMeta(initialData.letterMeta || {});
      setResourceId(initialData.id);
    }
  }, [initialData, resetBlocks]);

  // -- Memoised payload to track in autosave --
  const currentPayload: SavePayload = useMemo(() => ({
    title: formTitle,
    description: initialData?.description || "Created with Form Builder",
    category: formCategory,
    blocks: blocks,
    clientTypes: initialData?.clientTypes || ["Universal"],
    version: initialData?.version || "1.0",
    letterMeta: formCategory === 'Letters' ? letterMeta : undefined,
  }), [formTitle, formCategory, blocks, letterMeta, initialData?.description, initialData?.clientTypes, initialData?.version]);

  // -- AUTOSAVE (only for existing resources) --
  const autosaveOnSave = useCallback(
    async (payload: SavePayload) => {
      await saveToApi(payload, resourceId);
    },
    [resourceId]
  );

  const {
    status: autosaveStatus,
    isDirty,
    lastSavedAt,
    saveNow: autosaveSaveNow,
    markSaved,
  } = useAutosave<SavePayload>({
    data: currentPayload,
    onSave: autosaveOnSave,
    debounceMs: 5000, // 5 seconds of inactivity
    enabled: !isNewResource, // Only autosave existing resources
    isNew: isNewResource,
  });

  // Mark initial state as saved baseline when editing existing resource
  React.useEffect(() => {
    if (!isNewResource) {
      markSaved();
    }
  }, [isNewResource, markSaved]);

  // -- BLOCK OPERATIONS (structural -> `setBlocks` creates history entry) --

  const handleAddBlock = useCallback((type: BlockType) => {
    const newBlock: FormBlock = {
      id: generateId(),
      type,
      data: getInitialBlockData(type)
    };
    
    // Insert after selected block if one is selected, otherwise append
    setBlocks((prevBlocks: FormBlock[]) => {
      if (selectedBlockId) {
        const selectedIndex = prevBlocks.findIndex(b => b.id === selectedBlockId);
        if (selectedIndex !== -1) {
          const newBlocks = [...prevBlocks];
          newBlocks.splice(selectedIndex + 1, 0, newBlock);
          return newBlocks;
        }
      }
      return [...prevBlocks, newBlock];
    });
    setSelectedBlockId(newBlock.id);
  }, [selectedBlockId, setBlocks]);

  // Property edits use merged updates (debounced history entries)
  const handleUpdateBlock = useCallback((id: string, data: Record<string, unknown>) => {
    setBlocksMerged((prevBlocks: FormBlock[]) => 
      prevBlocks.map(b => b.id === id ? { ...b, data } : b)
    );
  }, [setBlocksMerged]);

  const handleDeleteBlock = useCallback((id: string) => {
    setBlocks((prevBlocks: FormBlock[]) => prevBlocks.filter(b => b.id !== id));
    setSelectedBlockId(prev => prev === id ? null : prev);
  }, [setBlocks]);

  const handleMoveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks((prevBlocks: FormBlock[]) => {
      const index = prevBlocks.findIndex(b => b.id === id);
      if (index === -1) return prevBlocks;
      if (direction === 'up' && index === 0) return prevBlocks;
      if (direction === 'down' && index === prevBlocks.length - 1) return prevBlocks;

      const newBlocks = [...prevBlocks];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      return newBlocks;
    });
  }, [setBlocks]);

  const handleDuplicateBlock = useCallback((id: string) => {
    let duplicateId = '';
    setBlocks((prevBlocks: FormBlock[]) => {
      const index = prevBlocks.findIndex(b => b.id === id);
      if (index === -1) return prevBlocks;

      const original = prevBlocks[index];
      duplicateId = generateId();
      const duplicate: FormBlock = {
        id: duplicateId,
        type: original.type,
        data: JSON.parse(JSON.stringify(original.data))
      };

      const newBlocks = [...prevBlocks];
      newBlocks.splice(index + 1, 0, duplicate);
      return newBlocks;
    });
    // Select the duplicate after state updates
    if (duplicateId) setSelectedBlockId(duplicateId);
  }, [setBlocks]);

  const handleReorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setBlocks((prevBlocks: FormBlock[]) => {
      const newBlocks = [...prevBlocks];
      const [moved] = newBlocks.splice(fromIndex, 1);
      newBlocks.splice(toIndex, 0, moved);
      return newBlocks;
    });
  }, [setBlocks]);

  // -- CONTAINER DROP OPERATIONS --

  /** Move an existing top-level block into a container's nested blocks */
  const handleMoveBlockToContainer = useCallback((blockId: string, containerId: string) => {
    setBlocks((prevBlocks: FormBlock[]) => {
      // Find the block to move
      const blockToMove = prevBlocks.find(b => b.id === blockId);
      if (!blockToMove) return prevBlocks;
      // Don't allow moving a container into itself
      if (blockId === containerId) return prevBlocks;
      // Don't move page_break or container blocks into containers
      if (blockToMove.type === 'page_break' || blockToMove.type === 'container' || blockToMove.type === 'repeater') {
        return prevBlocks;
      }

      // Remove from top-level
      const withoutBlock = prevBlocks.filter(b => b.id !== blockId);

      // Add to container's nested blocks
      return withoutBlock.map(b => {
        if (b.id === containerId && b.type === 'container') {
          const containerBlocks = b.data.blocks || [];
          return {
            ...b,
            data: {
              ...b.data,
              blocks: [...containerBlocks, blockToMove],
            },
          };
        }
        return b;
      });
    });
    setSelectedBlockId(containerId);
  }, [setBlocks]);

  /** Create a new block from toolbox type and add it inside a container */
  const handleAddBlockToContainer = useCallback((type: BlockType, containerId: string) => {
    // Don't allow structural blocks inside containers
    if (type === 'page_break' || type === 'container' || type === 'repeater') return;

    const newBlock: FormBlock = {
      id: generateId(),
      type,
      data: getInitialBlockData(type),
    };

    setBlocks((prevBlocks: FormBlock[]) =>
      prevBlocks.map(b => {
        if (b.id === containerId && b.type === 'container') {
          const containerBlocks = b.data.blocks || [];
          return {
            ...b,
            data: {
              ...b.data,
              blocks: [...containerBlocks, newBlock],
            },
          };
        }
        return b;
      })
    );
    setSelectedBlockId(containerId);
  }, [setBlocks]);

  /** Handle toolbox drag-and-drop onto the canvas (not into a container) */
  const handleAddToolboxBlock = useCallback((type: BlockType, atIndex?: number) => {
    const newBlock: FormBlock = {
      id: generateId(),
      type,
      data: getInitialBlockData(type),
    };

    setBlocks((prevBlocks: FormBlock[]) => {
      if (atIndex !== undefined && atIndex >= 0 && atIndex <= prevBlocks.length) {
        const newBlocks = [...prevBlocks];
        newBlocks.splice(atIndex, 0, newBlock);
        return newBlocks;
      }
      return [...prevBlocks, newBlock];
    });
    setSelectedBlockId(newBlock.id);
  }, [setBlocks]);

  // -- MANUAL SAVE (with explicit toast feedback) --
  // Saves in place without exiting the builder. On first save of a new resource,
  // captures the returned ID so subsequent saves become PUT updates and autosave kicks in.
  const handleManualSave = useCallback(async () => {
    setManualSaving(true);
    try {
      const data = await saveToApi(currentPayload, resourceId);
      const isCreate = !resourceId;
      toast.success(`${isLetterMode ? 'Letter' : 'Form template'} ${isCreate ? 'created' : 'updated'} successfully`);

      // If this was a new resource, capture the ID so future saves are updates
      if (isCreate && data?.resource?.id) {
        setResourceId(data.resource.id);
      }

      markSaved();
    } catch (error: unknown) {
      console.error('[FormBuilder] Manual save error:', error);
      toast.error('Failed to save template', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setManualSaving(false);
    }
  }, [currentPayload, resourceId, markSaved, isLetterMode]);

  // -- KEYBOARD SHORTCUTS --
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const isContentEditable = (e.target as HTMLElement).isContentEditable;

      // Ctrl+S — manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
        return;
      }

      // Undo/Redo — always available (even in inputs via Ctrl+Z convention)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept if not in a native input (let browser handle undo in inputs)
        if (!isInput && !isContentEditable) {
          e.preventDefault();
          undo();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        if (!isInput && !isContentEditable) {
          e.preventDefault();
          redo();
          return;
        }
      }
      // Ctrl+Y also triggers redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (!isInput && !isContentEditable) {
          e.preventDefault();
          redo();
          return;
        }
      }

      // Block-specific shortcuts require a selected block and no input focus
      if (!selectedBlockId) return;
      if (isInput || isContentEditable) return;

      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        handleMoveBlock(selectedBlockId, 'up');
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        handleMoveBlock(selectedBlockId, 'down');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateBlock(selectedBlockId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteBlock(selectedBlockId);
      } else if (e.key === 'Escape') {
        setSelectedBlockId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, undo, redo, handleMoveBlock, handleDuplicateBlock, handleDeleteBlock, handleManualSave]);

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  // -- Determine combined saving state --
  const isSaving = manualSaving || autosaveStatus === 'saving';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen bg-gray-50 fixed inset-0 z-50">
        {/* HEADER */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
            <div className="h-6 w-px bg-gray-200"></div>
            <Input
               className="h-8 w-64 border-transparent hover:border-gray-200 focus:border-purple-500 font-bold text-lg text-gray-800 px-2 -ml-2"
               value={formTitle}
               onChange={(e) => setFormTitle(e.target.value)}
            />
            <div className="w-[140px]">
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-8 border-transparent hover:border-gray-200 focus:ring-0 bg-transparent text-sm font-medium">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Forms">Forms</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Requests">Requests</SelectItem>
                  <SelectItem value="Letters">Letters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
              {/* AUTOSAVE STATUS INDICATOR */}
              <AutosaveIndicator
                status={autosaveStatus}
                isDirty={isDirty}
                lastSavedAt={lastSavedAt}
                isNew={isNewResource}
                manualSaving={manualSaving}
              />

              <div className="h-6 w-px bg-gray-200 mx-1"></div>

              {/* UNDO / REDO BUTTONS */}
              <div className="flex items-center gap-0.5 mr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={!canUndo}
                      onClick={undo}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>Undo <kbd className="ml-1 px-1 py-0.5 bg-gray-700 rounded text-[10px] font-mono">Ctrl+Z</kbd></p>
                    {canUndo && <p className="text-gray-400 mt-0.5">{historySize} step{historySize !== 1 ? 's' : ''} available</p>}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={!canRedo}
                      onClick={redo}
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>Redo <kbd className="ml-1 px-1 py-0.5 bg-gray-700 rounded text-[10px] font-mono">Ctrl+Shift+Z</kbd></p>
                    {canRedo && <p className="text-gray-400 mt-0.5">{futureSize} step{futureSize !== 1 ? 's' : ''} available</p>}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="h-6 w-px bg-gray-200 mr-1"></div>

              {/* Phase 2: Preview Mode Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isPreviewMode ? 'default' : 'outline'}
                    size="sm"
                    className={`h-8 px-3 ${isPreviewMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                    onClick={() => {
                      setIsPreviewMode(!isPreviewMode);
                      if (!isPreviewMode) {
                        setSelectedBlockId(null); // Deselect when entering preview
                      }
                    }}
                  >
                    {isPreviewMode ? (
                      <PenTool className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isPreviewMode ? 'Edit' : 'Preview'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {isPreviewMode ? 'Switch back to builder mode' : 'Preview the form as users will see it'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                      onClick={handleManualSave} 
                      className="bg-purple-700 hover:bg-purple-800"
                      disabled={isSaving}
                  >
                      {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                          <Save className="h-4 w-4 mr-2" />
                      )}
                      {isSaving ? 'Saving...' : isLetterMode ? 'Save Letter' : 'Save Template'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>Save now <kbd className="ml-1 px-1 py-0.5 bg-gray-700 rounded text-[10px] font-mono">Ctrl+S</kbd></p>
                </TooltipContent>
              </Tooltip>
          </div>
        </div>

        {/* MAIN WORKSPACE */}
        <div className="flex-1 flex overflow-hidden">
          {isPreviewMode ? (
            /* Phase 2: Interactive Preview Mode */
            <div className="flex-1 overflow-y-auto bg-gray-100">
              <div className="max-w-3xl mx-auto my-8 bg-white rounded-lg shadow-md border border-gray-200 p-8">
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Interactive Preview</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{formTitle}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Fill in the fields below to test the form experience. Responses are not saved.
                  </p>
                </div>
                <InteractiveFormRenderer
                  blocks={blocks}
                  responses={previewResponses}
                  onChange={(key, value) =>
                    setPreviewResponses((prev) => ({ ...prev, [key]: value }))
                  }
                />
                {Object.keys(previewResponses).length > 0 && (
                  <div className="mt-8 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Preview Responses ({Object.keys(previewResponses).length} fields)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-gray-400"
                        onClick={() => setPreviewResponses({})}
                      >
                        Clear All
                      </Button>
                    </div>
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto max-h-40 font-mono text-gray-600">
                      {JSON.stringify(previewResponses, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Builder Mode — standard three-pane layout */
            <div className="contents">
              <Toolbox onAddBlock={handleAddBlock} />
              <FormCanvas 
                  blocks={blocks} 
                  selectedBlockId={selectedBlockId} 
                  onSelectBlock={setSelectedBlockId}
                  onDeleteBlock={handleDeleteBlock}
                  onMoveBlock={handleMoveBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onReorderBlocks={handleReorderBlocks}
                  onMoveBlockToContainer={handleMoveBlockToContainer}
                  onAddBlockToContainer={handleAddBlockToContainer}
                  onAddToolboxBlock={handleAddToolboxBlock}
                  docTitle={formTitle}
                  category={formCategory}
                  letterMeta={letterMeta}
              />
              <PropertiesPanel 
                  block={selectedBlock} 
                  onUpdate={handleUpdateBlock}
                  onDelete={handleDeleteBlock}
                  onMove={handleMoveBlock}
                  onDuplicate={handleDuplicateBlock}
                  isFirst={selectedBlock ? blocks.findIndex(b => b.id === selectedBlock.id) === 0 : false}
                  isLast={selectedBlock ? blocks.findIndex(b => b.id === selectedBlock.id) === blocks.length - 1 : false}
                  category={formCategory}
                  letterMeta={letterMeta}
                  onLetterMetaChange={setLetterMeta}
              />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

// ============================================================================
// AutosaveIndicator — shows save status in the header
// ============================================================================

function AutosaveIndicator({
  status,
  isDirty,
  lastSavedAt,
  isNew,
  manualSaving,
}: {
  status: AutosaveStatus;
  isDirty: boolean;
  lastSavedAt: Date | null;
  isNew: boolean;
  manualSaving: boolean;
}) {
  // Format relative time
  const timeAgo = lastSavedAt ? formatTimeAgo(lastSavedAt) : null;

  // During manual save, show saving state
  if (manualSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
        <span>Saving…</span>
      </div>
    );
  }

  // New resource — no autosave yet
  if (isNew) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Not saved yet</span>
      </div>
    );
  }

  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center gap-1.5 text-xs text-purple-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Saving…</span>
        </div>
      );

    case 'saved':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-green-600 cursor-default">
              <Cloud className="h-3.5 w-3.5" />
              <span>Saved</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {timeAgo ? `Last saved ${timeAgo}` : 'All changes saved'}
          </TooltipContent>
        </Tooltip>
      );

    case 'unsaved':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 cursor-default">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved changes</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Changes will be auto-saved in a few seconds
            {timeAgo && <p className="text-gray-400 mt-0.5">Last saved {timeAgo}</p>}
          </TooltipContent>
        </Tooltip>
      );

    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-red-600 cursor-default">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Save failed</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Auto-save failed. Will retry shortly — or save manually.
            {timeAgo && <p className="text-gray-400 mt-0.5">Last saved {timeAgo}</p>}
          </TooltipContent>
        </Tooltip>
      );

    default:
      return null;
  }
}

// ============================================================================
// Relative time formatter — e.g. "just now", "2 min ago", "1 hr ago"
// ============================================================================
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
}

// ============================================================================
// INITIAL DATA FACTORIES
// ============================================================================

const getInitialBlockData = (type: BlockType) => {
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
                    { id: 'row-1', cells: [{ type: 'static', value: '' }, { type: 'static', value: '' }] },
                    { id: 'row-2', cells: [{ type: 'static', value: '' }, { type: 'static', value: '' }] }
                ]
            };
        case 'checkbox_table':
            return {
                columns: ['Yes', 'No', 'N/A'],
                rows: ['Question 1', 'Question 2', 'Question 3']
            };
        case 'radio_options':
            return {
                label: 'Select an option:',
                options: ['Option 1', 'Option 2', 'Option 3'],
                layout: 'vertical'
            };
        default:
            return {};
    }
};

// ============================================================================
// LETTER STARTER BLOCKS — pre-populated content for new letters
// ============================================================================

function getLetterStarterBlocks(): FormBlock[] {
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