/**
 * Resources Module (Refactored v2)
 * Clean UI with pre-fill workflow, form grouping, and category filtering.
 */

import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { Card, CardContent } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
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
  FileText, Search, Settings, PenTool, Printer, AlertTriangle,
  Database, Scale, Loader2, MoreHorizontal, Eye, Edit, Trash2,
  CheckSquare, Square, Users, ChevronRight, X, Mail, Palette
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// Module imports
import { useResources } from './hooks/useResources';
import { FormDefinition } from './types';
import { generatePreviewData, getCategoryColor } from './utils';
import { LEGAL_DOCUMENTS } from './legal-constants';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { Skeleton } from '../../../ui/skeleton';

import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

// Phase 1 — Form status config
import { FORM_STATUS_CONFIG, type FormStatus } from './builder/constants';

// ---------------------------------------------------------------------------
// Heavy sub-components — lazy-loaded to reduce initial chunk size.
// These are only rendered on user action (edit, preview, tab switch).
// ---------------------------------------------------------------------------
const FormBuilder = React.lazy(() => import('./builder/FormBuilder').then(m => ({ default: m.FormBuilder })));
const PdfTemplateViewer = React.lazy(() => import('./PdfTemplateViewer').then(m => ({ default: m.PdfTemplateViewer })));
const CalculatorsManager = React.lazy(() => import('./calculators/CalculatorsManager').then(m => ({ default: m.CalculatorsManager })));
const DynamicFormRenderer = React.lazy(() => import('./components/DynamicFormRenderer'));
const LetterRenderer = React.lazy(() => import('./components/LetterRenderer').then(m => ({ default: m.LetterRenderer })));
const ClientConsentForm = React.lazy(() => import('./forms/ClientConsentForm'));
const ClientPicker = React.lazy(() => import('./components/ClientPicker').then(m => ({ default: m.ClientPicker })));
const UniversalKeyManager = React.lazy(() => import('./UniversalKeyManager').then(m => ({ default: m.UniversalKeyManager })));
const ZipEncryptTool = React.lazy(() => import('./tools/ZipEncryptTool').then(m => ({ default: m.ZipEncryptTool })));
const PdfDecryptTool = React.lazy(() => import('./tools/PdfDecryptTool').then(m => ({ default: m.PdfDecryptTool })));
const CorporateIdentityTab = React.lazy(() => import('./components/CorporateIdentityTab').then(m => ({ default: m.CorporateIdentityTab })));

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
  const {
    filteredForms,
    forms,
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
    const pi = profile.personalInformation || {};
    const contact = profile.contactInformation || {};
    const addr = profile.residentialAddress || {};

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
      }
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
    setPreviewingForms([{
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
    }]);
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
      toast.error('Delete failed', { description: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  /** Toggle form selection */
  const toggleFormSelection = useCallback((formId: string) => {
    setSelectedFormIds(prev => {
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
      setSelectedFormIds(new Set(filteredForms.map(f => f.id)));
    }
  }, [filteredForms, selectedFormIds]);

  /** Pre-fill selected forms */
  const handlePrefillSelected = useCallback(() => {
    const selected = filteredForms.filter(f => selectedFormIds.has(f.id));
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
      const storageKey = `sb-${projectId}-auth-token`;
      const stored = localStorage.getItem(storageKey);
      const token = stored ? JSON.parse(stored).access_token : publicAnonKey;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/resources/legal/seed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documents: LEGAL_DOCUMENTS }),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Seed failed (${response.status})`);
      }

      const result = await response.json();
      const { seeded = 0, skipped = 0, total = 0 } = result;

      if (seeded > 0) {
        toast.success(`${seeded} legal document${seeded !== 1 ? 's' : ''} created`, {
          description: skipped > 0 ? `${skipped} already existed and were skipped.` : `All ${total} templates are now available.`,
        });
        refresh();
      } else {
        toast.info('All legal documents already exist', {
          description: `${skipped} document${skipped !== 1 ? 's' : ''} were already seeded.`,
        });
      }
    } catch (error: unknown) {
      console.error('[ResourcesModule] Legal seed error:', error);
      toast.error('Failed to seed legal documents', { description: error instanceof Error ? error.message : 'Unknown error' });
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
    filteredForms.forEach(f => {
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
          initialData={formToEdit}
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
          letterMeta={currentPreviewForm?.renderer === 'letter' ? currentPreviewForm.letterMeta : undefined}
          letterBlocks={currentPreviewForm?.renderer === 'letter' ? currentPreviewForm.blocks : undefined}
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
      <Tabs defaultValue="forms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="forms" className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Forms & Documents
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
                      <DropdownMenuItem
                        onClick={handleSeedLegalDocuments}
                        disabled={seedingLegal}
                      >
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
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-end gap-4">
                {/* Search */}
                <div className="flex-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search forms by name or description..."
                      value={filters.search}
                      onChange={(e) => updateFilters({ search: e.target.value })}
                      className="pl-10 h-10"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="w-44">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => updateFilters({ category: value })}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Client Type */}
                <div className="w-40">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Type</Label>
                  <Select
                    value={filters.clientType}
                    onValueChange={(value) => updateFilters({ clientType: value })}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {clientTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Phase 1: Status Filter */}
                <div className="w-36">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(value) => updateFilters({ status: value })}
                  >
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Draft
                        </span>
                      </SelectItem>
                      <SelectItem value="published">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                          Published
                        </span>
                      </SelectItem>
                      <SelectItem value="archived">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Archived
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Select mode toggle */}
                <Button
                  variant={isSelectMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedFormIds(new Set());
                  }}
                >
                  {isSelectMode ? <CheckSquare className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />}
                  {isSelectMode ? 'Done' : 'Select'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Selection action bar */}
          {isSelectMode && selectedFormIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Badge className="bg-primary text-white">
                {selectedFormIds.size} selected
              </Badge>
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
          <div>
            {loading ? (
              <div className="border rounded-lg divide-y bg-white">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border">
                    <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-3 w-8 hidden lg:block" />
                    <Skeleton className="h-3 w-16 hidden lg:block" />
                    <Skeleton className="h-7 w-16 rounded-md" />
                    <Skeleton className="h-7 w-16 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredForms.length > 0 ? (
              <div className="border rounded-lg divide-y bg-white">
                {filteredForms.map((form) => {
                  const isSelected = selectedFormIds.has(form.id);
                  return (
                    <div
                      key={form.id}
                      className={`flex items-center gap-4 px-4 py-3 group hover:bg-gray-50/50 transition-colors ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Selection checkbox */}
                      {isSelectMode && (
                        <button
                          onClick={() => toggleFormSelection(form.id)}
                          className="shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-300 hover:text-gray-500" />
                          )}
                        </button>
                      )}

                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        form.category === 'Letters' ? 'bg-violet-50' : 'bg-gray-100'
                      }`}>
                        {form.category === 'Letters' ? (
                          <Mail className="h-4 w-4 text-violet-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-gray-500" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{form.name}</h3>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 ${getCategoryColor(form.category)}`}>
                            {form.category}
                          </Badge>
                          {/* Phase 1: Status badge */}
                          {form.status && FORM_STATUS_CONFIG[form.status as FormStatus] && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 ${FORM_STATUS_CONFIG[form.status as FormStatus].badgeClass}`}
                            >
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${FORM_STATUS_CONFIG[form.status as FormStatus].dotClass}`} />
                              {FORM_STATUS_CONFIG[form.status as FormStatus].label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {form.description || 'No description'}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="hidden lg:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span>v{form.version}</span>
                        <span>{form.clientTypes[0] || 'Universal'}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleQuickPreview(form)}
                          title="Quick preview (empty data)"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs text-primary"
                          onClick={() => handlePrefill([form])}
                          title="Pre-fill with client data"
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Pre-fill
                        </Button>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() => handleEdit(form)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {/* Phase 1: Row-level actions menu (duplicate, status, delete) */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => handleEdit(form)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit in Builder
                              </DropdownMenuItem>
                            )}
                            {canCreate && (
                              <DropdownMenuItem onClick={() => duplicateResource(form.id)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                            )}
                            {canEdit && (
                              <div className="contents">
                                <DropdownMenuSeparator />
                                {form.status !== 'published' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateResource(form.id, { status: 'published' } as Record<string, unknown>)
                                    }
                                  >
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" />
                                    Publish
                                  </DropdownMenuItem>
                                )}
                                {form.status !== 'draft' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateResource(form.id, { status: 'draft' } as Record<string, unknown>)
                                    }
                                  >
                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                                    Revert to Draft
                                  </DropdownMenuItem>
                                )}
                                {form.status !== 'archived' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateResource(form.id, { status: 'archived' } as Record<string, unknown>)
                                    }
                                  >
                                    <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                )}
                              </div>
                            )}
                            {canDelete && (
                              <div className="contents">
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-700"
                                  onClick={() => handleDelete(form)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground border rounded-lg bg-white">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No forms available</p>
                <p className="text-sm mt-1">
                  {filters.search
                    ? 'Try adjusting your search or filters'
                    : 'Build a new form to get started'}
                </p>
              </div>
            )}

            {/* Count footer */}
            {!loading && filteredForms.length > 0 && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground px-1">
                <span>{filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  {Object.entries(categoryCounts).map(([cat, count]) => (
                    <span key={cat}>{cat}: {count}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools">
          <Suspense fallback={<LazyFallback />}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  {' '}All {previewingForms.length} selected forms will be pre-filled.
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
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${getCategoryColor(f.category)}`}>
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
                <ClientPicker
                  selectedClient={prefillClient}
                  onSelect={setPrefillClient}
                />
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
                Please type <span className="font-bold select-all">{formToDelete?.name}</span> below to confirm deletion.
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
