/**
 * Resources Module (Refactored v2)
 * Clean UI with pre-fill workflow, form grouping, and category filtering.
 */

import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert';
import {
  FileText,
  Settings,
  PenTool,
  Printer,
  AlertTriangle,
  Database,
  Scale,
  Loader2,
  MoreHorizontal,
  Users,
  ChevronRight,
  X,
  Mail,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';

// Module imports
import { useResources } from './hooks/useResources';
import { FormDefinition } from './types';
import { generatePreviewData, getCategoryColor } from './utils';
import { LEGAL_DOCUMENTS } from './legal-constants';
import { api } from '../../../../utils/api';

import { useCurrentUserPermissions } from '../personnel';

// Phase 1 — Form status config
import { FormsFilterBar } from './components/FormsFilterBar';
import { FormsList } from './components/FormsList';

// ---------------------------------------------------------------------------
// Heavy sub-components — lazy-loaded to reduce initial chunk size.
// These are only rendered on user action (edit, preview, tab switch).
// ---------------------------------------------------------------------------
const FormBuilder = React.lazy(() =>
  import('./builder/FormBuilder').then((m) => ({ default: m.FormBuilder })),
);
const PdfTemplateViewer = React.lazy(() =>
  import('./PdfTemplateViewer').then((m) => ({ default: m.PdfTemplateViewer })),
);
const CalculatorsManager = React.lazy(() =>
  import('./calculators/CalculatorsManager').then((m) => ({ default: m.CalculatorsManager })),
);
const DynamicFormRenderer = React.lazy(() => import('./components/DynamicFormRenderer'));
const LetterRenderer = React.lazy(() =>
  import('./components/LetterRenderer').then((m) => ({ default: m.LetterRenderer })),
);
const ClientConsentForm = React.lazy(() => import('./forms/ClientConsentForm'));
const ClientPicker = React.lazy(() =>
  import('./components/ClientPicker').then((m) => ({ default: m.ClientPicker })),
);
const UniversalKeyManager = React.lazy(() =>
  import('./UniversalKeyManager').then((m) => ({ default: m.UniversalKeyManager })),
);
const FormTemplateTool = React.lazy(() =>
  import('./tools/FormTemplateTool').then((m) => ({ default: m.FormTemplateTool })),
);
const ZipEncryptTool = React.lazy(() =>
  import('./tools/ZipEncryptTool').then((m) => ({ default: m.ZipEncryptTool })),
);
const PdfDecryptTool = React.lazy(() =>
  import('./tools/PdfDecryptTool').then((m) => ({ default: m.PdfDecryptTool })),
);
const CorporateIdentityTab = React.lazy(() =>
  import('./components/CorporateIdentityTab').then((m) => ({ default: m.CorporateIdentityTab })),
);
const LegalDocumentsManager = React.lazy(() => import('./legal-documents/LegalDocumentsManager'));

/** Shared spinner for lazy-loaded sub-components */
function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface SelectedClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber?: string;
  profile?: Record<string, unknown>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ResourcesModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const formTemplatesClientId = searchParams.get('formTemplatesClientId') ?? undefined;
  const resourcesTab = searchParams.get('resourcesTab') ?? 'forms';

  const handleResourcesTabChange = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'forms') {
            next.delete('resourcesTab');
          } else {
            next.set('resourcesTab', value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const {
    filteredForms,
    categories,
    clientTypes,
    loading,
    filters,
    updateFilters,
    deleteResource,
    duplicateResource,
    updateResource,
    refresh,
  } = useResources();

  const { canDo } = useCurrentUserPermissions();
  const canCreate = canDo('resources', 'create');
  const canDelete = canDo('resources', 'delete');
  const canEdit = canDo('resources', 'edit');

  // ---- UI State ----
  const [isBuilderMode, setIsBuilderMode] = useState(false);
  const [builderMode, setBuilderMode] = useState<'form' | 'letter'>('form');
  const [formToEdit, setFormToEdit] = useState<FormDefinition | null>(null);
  const [seedingLegal, setSeedingLegal] = useState(false);

  // ---- Preview & Pre-fill State ----
  const [showPdfTemplate, setShowPdfTemplate] = useState(false);
  const [previewingForms, setPreviewingForms] = useState<FormDefinition[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [prefillClient, setPrefillClient] = useState<SelectedClient | null>(null);
  const [showPrefillDialog, setShowPrefillDialog] = useState(false);

  // ---- Multi-select State ----
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // ---- Delete Modal State ----
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormDefinition | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /** Generate pre-fill data from selected client */
  const getPrefillData = useCallback(() => {
    if (!prefillClient) return generatePreviewData();

    const profile = prefillClient.profile || {};
    // These nested sections are loosely typed ({}); read them as string records.
    const pi = (profile.personalInformation || {}) as Record<string, string | undefined>;
    const contact = (profile.contactInformation || {}) as Record<string, string | undefined>;
    const addr = (profile.residentialAddress || {}) as Record<string, string | undefined>;

    return generatePreviewData(
      {
        firstName: prefillClient.firstName,
        lastName: prefillClient.lastName,
        email: prefillClient.email,
        idNumber: prefillClient.idNumber || pi.idNumber || pi.passportNumber || '',
        profile: {
          dateOfBirth: pi.dateOfBirth || '',
          gender: pi.gender || '',
          maritalStatus: pi.maritalStatus || '',
          phone: contact.cellphone || contact.phone || '',
          address: addr.streetAddress
            ? `${addr.streetAddress}, ${addr.suburb || ''}, ${addr.city || ''}, ${addr.postalCode || ''}`
            : '',
        },
      },
      {
        name: '', // Adviser data could be loaded separately
        email: '',
        phone: '',
        title: '',
        licenseNumber: '',
      },
    );
  }, [prefillClient]);

  /** Open pre-fill dialog for one or more forms */
  const handlePrefill = useCallback((formsToFill: FormDefinition[]) => {
    setPreviewingForms(formsToFill);
    setCurrentPreviewIndex(0);
    setShowPrefillDialog(true);
  }, []);

  /** Confirm pre-fill and open viewer */
  const handleConfirmPrefill = useCallback(() => {
    setShowPrefillDialog(false);
    setShowPdfTemplate(true);
  }, []);

  /** Quick preview without pre-fill (empty data) */
  const handleQuickPreview = useCallback((form: FormDefinition) => {
    setPrefillClient(null);
    setPreviewingForms([form]);
    setCurrentPreviewIndex(0);
    setShowPdfTemplate(true);
  }, []);

  /** Open demo consent form */
  const openDemo = useCallback(() => {
    setPrefillClient(null);
    setPreviewingForms([
      {
        id: 'demo_consent',
        name: 'Client Consent Form (Demo)',
        category: 'Demo',
        description: 'Demo template',
        version: '1.0',
        lastUpdated: 'N/A',
        downloads: 0,
        size: '0',
        isPopular: false,
        fields: [],
        clientTypes: [],
        renderer: 'custom',
        previewComponent: ClientConsentForm,
      },
    ]);
    setCurrentPreviewIndex(0);
    setShowPdfTemplate(true);
  }, []);

  /** Handle form edit */
  const handleEdit = useCallback((form: FormDefinition) => {
    setFormToEdit(form);
    setBuilderMode(form.category === 'Letters' ? 'letter' : 'form');
    setIsBuilderMode(true);
  }, []);

  /** Handle form delete (open confirmation) */
  const handleDelete = useCallback((form: FormDefinition) => {
    setFormToDelete(form);
    setDeleteModalOpen(true);
    setDeleteConfirmation('');
  }, []);

  /** Confirm delete */
  const confirmDelete = async () => {
    if (!formToDelete || deleteConfirmation !== formToDelete.name) return;
    try {
      await deleteResource(formToDelete.id);
      setDeleteModalOpen(false);
      setFormToDelete(null);
      setDeleteConfirmation('');
    } catch (error: unknown) {
      console.error('[ResourcesModule] Delete error:', error);
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /** Toggle form selection */
  const toggleFormSelection = useCallback((formId: string) => {
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  }, []);

  /** Select / deselect all visible forms */
  const toggleSelectAll = useCallback(() => {
    if (selectedFormIds.size === filteredForms.length) {
      setSelectedFormIds(new Set());
    } else {
      setSelectedFormIds(new Set(filteredForms.map((f) => f.id)));
    }
  }, [filteredForms, selectedFormIds]);

  /** Pre-fill selected forms */
  const handlePrefillSelected = useCallback(() => {
    const selected = filteredForms.filter((f) => selectedFormIds.has(f.id));
    if (selected.length === 0) {
      toast.error('No forms selected');
      return;
    }
    handlePrefill(selected);
  }, [filteredForms, selectedFormIds, handlePrefill]);

  /** Seed legal documents */
  const handleSeedLegalDocuments = async () => {
    setSeedingLegal(true);
    try {
      const result = await api.post<{ seeded?: number; skipped?: number; total?: number }>(
        '/resources/legal/seed',
        { documents: LEGAL_DOCUMENTS },
      );
      const { seeded = 0, skipped = 0, total = 0 } = result;

      if (seeded > 0) {
        toast.success(`${seeded} legal document${seeded !== 1 ? 's' : ''} created`, {
          description:
            skipped > 0
              ? `${skipped} already existed and were skipped.`
              : `All ${total} templates are now available.`,
        });
        refresh();
      } else {
        toast.info('All legal documents already exist', {
          description: `${skipped} document${skipped !== 1 ? 's' : ''} were already seeded.`,
        });
      }
    } catch (error: unknown) {
      console.error('[ResourcesModule] Legal seed error:', error);
      toast.error('Failed to seed legal documents', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSeedingLegal(false);
    }
  };

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const currentPreviewForm = previewingForms[currentPreviewIndex] || null;
  const hasMultiplePreviews = previewingForms.length > 1;

  /** Category counts for filter badges */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredForms.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [filteredForms]);

  // ============================================================================
  // BUILDER MODE
  // ============================================================================

  if (isBuilderMode) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <FormBuilder
          initialData={(formToEdit ?? undefined) as unknown as Record<string, unknown> | undefined}
          mode={builderMode}
          onBack={() => {
            setIsBuilderMode(false);
            setFormToEdit(null);
            setBuilderMode('form');
            refresh();
          }}
          onSave={() => {
            refresh();
          }}
        />
      </Suspense>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-8 p-6">
      {/* PDF Template Viewer (supports multi-form navigation) */}
      <Suspense fallback={<LazyFallback />}>
        <PdfTemplateViewer
          open={showPdfTemplate}
          onOpenChange={(open) => {
            setShowPdfTemplate(open);
            if (!open) {
              setPreviewingForms([]);
              setCurrentPreviewIndex(0);
            }
          }}
          title={
            hasMultiplePreviews
              ? `${currentPreviewForm?.name || 'Form'} (${currentPreviewIndex + 1} of ${previewingForms.length})`
              : currentPreviewForm?.name || 'Form Preview'
          }
          isLetter={currentPreviewForm?.renderer === 'letter'}
          letterMeta={
            currentPreviewForm?.renderer === 'letter' ? currentPreviewForm.letterMeta : undefined
          }
          letterBlocks={
            currentPreviewForm?.renderer === 'letter' ? currentPreviewForm.blocks : undefined
          }
        >
          {/* Multi-form navigation bar */}
          {hasMultiplePreviews && (
            <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
              {previewingForms.map((f, idx) => (
                <button
                  key={f.id}
                  onClick={() => setCurrentPreviewIndex(idx)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    idx === currentPreviewIndex
                      ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Render current form */}
          {currentPreviewForm?.renderer === 'dynamic' ? (
            <DynamicFormRenderer
              data={getPrefillData()}
              blocks={currentPreviewForm.blocks}
              formName={currentPreviewForm.name}
            />
          ) : currentPreviewForm?.renderer === 'letter' ? (
            <LetterRenderer
              data={getPrefillData()}
              blocks={currentPreviewForm.blocks}
              formName={currentPreviewForm.name}
              letterMeta={currentPreviewForm.letterMeta}
            />
          ) : currentPreviewForm?.renderer === 'custom' && currentPreviewForm.previewComponent ? (
            <currentPreviewForm.previewComponent
              data={getPrefillData()}
              blocks={currentPreviewForm.blocks}
            />
          ) : null}
        </PdfTemplateViewer>
      </Suspense>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Resource Center</h1>
          <p className="text-muted-foreground text-lg">
            Manage forms, pre-fill with client data, and access tools
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={resourcesTab} onValueChange={handleResourcesTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 h-12">
          <TabsTrigger value="forms" className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Forms & Documents
          </TabsTrigger>
          <TabsTrigger value="legal-docs" className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4" />
            Legal Documents
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="calculators" className="flex items-center gap-2 text-base">
            <PenTool className="h-4 w-4" />
            Calculators
          </TabsTrigger>
          <TabsTrigger value="keys" className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Key Manager
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Corporate Identity
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* FORMS TAB */}
        {/* ============================================================ */}
        <TabsContent value="forms" className="space-y-6">
          {/* Header Row: title + primary actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Form Management & Pre-filling</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Preview, pre-fill with client data, or build new form templates
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Primary actions */}
              {canCreate && (
                <div className="contents">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBuilderMode('letter');
                      setIsBuilderMode(true);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Compose Letter
                  </Button>
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setBuilderMode('form');
                      setIsBuilderMode(true);
                    }}
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Build New Form
                  </Button>
                </div>
              )}

              {/* Secondary actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={openDemo}>
                    <Printer className="h-4 w-4 mr-2" />
                    View Demo Template
                  </DropdownMenuItem>
                  {canCreate && (
                    <div className="contents">
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSeedLegalDocuments} disabled={seedingLegal}>
                        {seedingLegal ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Scale className="h-4 w-4 mr-2" />
                        )}
                        {seedingLegal ? 'Seeding...' : 'Seed Legal Documents'}
                      </DropdownMenuItem>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filter Bar */}
          <FormsFilterBar
            categories={categories}
            clientTypes={clientTypes}
            filters={filters}
            updateFilters={updateFilters}
            isSelectMode={isSelectMode}
            setIsSelectMode={setIsSelectMode}
            setSelectedFormIds={setSelectedFormIds}
          />
          {/* Selection action bar */}
          {isSelectMode && selectedFormIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Badge className="bg-primary text-white">{selectedFormIds.size} selected</Badge>
              <Button size="sm" variant="outline" onClick={toggleSelectAll}>
                {selectedFormIds.size === filteredForms.length ? 'Deselect All' : 'Select All'}
              </Button>
              <div className="flex-1" />
              <Button size="sm" onClick={handlePrefillSelected}>
                <Users className="h-4 w-4 mr-1.5" />
                Pre-fill with Client Data
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedFormIds(new Set());
                  setIsSelectMode(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Forms List */}
          <FormsList
            filteredForms={filteredForms}
            loading={loading}
            filters={filters}
            updateFilters={updateFilters}
            isSelectMode={isSelectMode}
            selectedFormIds={selectedFormIds}
            toggleFormSelection={toggleFormSelection}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
            categoryCounts={categoryCounts}
            handleQuickPreview={handleQuickPreview}
            handlePrefill={handlePrefill}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            duplicateResource={duplicateResource}
            updateResource={updateResource}
          />
        </TabsContent>

        <TabsContent value="legal-docs">
          <Suspense fallback={<LazyFallback />}>
            <LegalDocumentsManager />
          </Suspense>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools">
          <Suspense fallback={<LazyFallback />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormTemplateTool selectedClientId={formTemplatesClientId} />
              <ZipEncryptTool />
              <PdfDecryptTool />
            </div>
          </Suspense>
        </TabsContent>

        {/* Calculators Tab */}
        <TabsContent value="calculators">
          <Suspense fallback={<LazyFallback />}>
            <CalculatorsManager />
          </Suspense>
        </TabsContent>

        {/* Key Manager Tab */}
        <TabsContent value="keys">
          <Suspense fallback={<LazyFallback />}>
            <UniversalKeyManager />
          </Suspense>
        </TabsContent>

        {/* Corporate Identity Tab */}
        <TabsContent value="brand">
          <Suspense fallback={<LazyFallback />}>
            <CorporateIdentityTab />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* PRE-FILL CLIENT PICKER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showPrefillDialog} onOpenChange={setShowPrefillDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Pre-fill with Client Data
            </DialogTitle>
            <DialogDescription>
              Select a client to populate form fields with their information.
              {previewingForms.length > 1 && (
                <span className="font-medium text-foreground">
                  {' '}
                  All {previewingForms.length} selected forms will be pre-filled.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Selected forms summary */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Forms to Pre-fill ({previewingForms.length})
              </Label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {previewingForms.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm py-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${getCategoryColor(f.category)}`}
                    >
                      {f.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Client search */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Select Client
              </Label>
              <Suspense fallback={<LazyFallback />}>
                <ClientPicker selectedClient={prefillClient} onSelect={setPrefillClient} />
              </Suspense>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPrefillDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPrefillClient(null);
                handleConfirmPrefill();
              }}
            >
              Preview Empty
            </Button>
            <Button onClick={handleConfirmPrefill} disabled={!prefillClient}>
              <Users className="h-4 w-4 mr-2" />
              Pre-fill & Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Form Template
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              <span className="font-semibold text-foreground"> "{formToDelete?.name}" </span>
              template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Please type <span className="font-bold select-all">{formToDelete?.name}</span> below
                to confirm deletion.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Confirmation</Label>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type the form name to confirm"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteConfirmation !== formToDelete?.name}
            >
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
