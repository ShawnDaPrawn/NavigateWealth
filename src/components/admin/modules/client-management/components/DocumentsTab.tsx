import React, { useState, useEffect } from 'react';
import { filterDocuments, groupDocumentsByPack, type DocumentItem } from './documentsUtils';
import { DocumentStatsCards } from './DocumentStatsCards';
import { DocumentFiltersBar } from './DocumentFiltersBar';
import { DocumentList } from './DocumentList';
import {
  DeleteDocumentDialog,
  DeletePackDialog,
  ResendPackDialog,
  UploadSuccessDialog,
  EmailComposeDialog,
} from './DocumentDialogs';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Upload, FileText, Trash2, Link as LinkIcon, Plus, Folder, RefreshCw } from 'lucide-react';
import { api } from '../../../../../utils/api';
import { toast } from 'sonner';
import { useAuth } from '../../../../auth/AuthContext';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

const SUBCATEGORIES = [
  'Compliance',
  'New Business Welcome Pack',
  'FICA Documents',
  'Application Forms',
  'Policy Schedule',
  'Other',
];

interface DocumentsTabProps {
  selectedClient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    idNumber?: string;
    profile?: Record<string, unknown>;
    personalInformation?: Record<string, unknown>;
  };
}

export function DocumentsTab({ selectedClient }: DocumentsTabProps) {
  const { user } = useAuth();
  const searchInputGuard = useSearchInputAutofillGuard({ id: 'client-documents-search' });
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packDeleteDialogOpen, setPackDeleteDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [uploadSuccessDialogOpen, setUploadSuccessDialogOpen] = useState(false);
  const [emailComposeDialogOpen, setEmailComposeDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const [packToDelete, setPackToDelete] = useState<{ id: string; count: number } | null>(null);
  const [packToResend, setPackToResend] = useState<{
    id: string;
    documents: DocumentItem[];
  } | null>(null);
  const [resendMessage, setResendMessage] = useState('');
  const [uploadEmailMessage, setUploadEmailMessage] = useState('');
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());

  // Form states
  const [uploadType, setUploadType] = useState<'document' | 'link'>('document');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);
  const [ccAdmin, setCcAdmin] = useState(false);

  // New subcategory state
  interface SubcategoryGroup {
    id: string;
    name: string;
    customName: string;
    files: File[];
  }

  const [uploadMode, setUploadMode] = useState<'general' | 'subcategory'>('general');
  const [subcategoryGroups, setSubcategoryGroups] = useState<SubcategoryGroup[]>([
    { id: '1', name: '', customName: '', files: [] },
  ]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  useEffect(() => {
    if (selectedClient?.id) {
      fetchDocuments();
    }
  }, [selectedClient?.id]);

  const fetchDocuments = async () => {
    if (!selectedClient?.id) return;

    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setLoading(true);

        const data = await api.get<{ documents: DocumentItem[] }>(
          `/documents/${selectedClient.id}`,
        );

        // Sort by upload date, newest first
        const sortedDocs = data.documents.sort(
          (a: DocumentItem, b: DocumentItem) =>
            new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime(),
        );

        setDocuments(sortedDocs);
        return; // Success — exit retry loop
      } catch (error) {
        if (attempt < maxRetries) {
          // Retry after delay (handles cold-start / transient network failures)
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        console.error('Error fetching documents after retries:', error);
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedClient?.id) return;

    if (!productCategory) {
      toast.error('Please select a category');
      return;
    }

    const isSubcategoryMode = uploadMode === 'subcategory';
    const filesToUpload: { file: File; subcategory?: string }[] = [];

    if (isSubcategoryMode) {
      // Validate Groups
      if (subcategoryGroups.length === 0) {
        toast.error('Please add at least one subcategory group');
        return;
      }

      for (const group of subcategoryGroups) {
        const name = group.name === 'Other' ? group.customName : group.name;
        if (!name) {
          toast.error('All subcategory groups must have a name');
          return;
        }
        if (group.files.length === 0) {
          toast.error(`Please add files to the "${name}" group`);
          return;
        }
        group.files.forEach((f) => filesToUpload.push({ file: f, subcategory: name }));
      }

      // Master Title Required for Subcategory Mode
      if (!documentTitle) {
        toast.error('Please provide a Pack Name (Title)');
        return;
      }
    } else {
      // General Mode
      if (selectedFiles.length === 0) {
        toast.error('Please select at least one file');
        return;
      }
      if (selectedFiles.length === 1 && !documentTitle) {
        toast.error('Please provide a title');
        return;
      }
      selectedFiles.forEach((f) => filesToUpload.push({ file: f }));
    }

    try {
      setUploading(true);
      const newDocIds: string[] = [];
      const newDocs: DocumentItem[] = [];

      // Generate pack ID
      // If Subcategory Mode: Always Pack
      // If General Mode: Pack if > 1 file
      const isPack = isSubcategoryMode || selectedFiles.length > 1;
      const packId = isPack ? `pack_${Date.now()}` : undefined;

      // Pack Title
      let packTitle = documentTitle;
      if (!packTitle && !isSubcategoryMode && selectedFiles.length > 0) {
        // Fallback to filename if single/multi general upload without title (though single requires title)
        packTitle = selectedFiles[0].name.replace(/\.[^/.]+$/, '');
      }
      if (!packTitle) packTitle = 'Document Pack';

      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, subcategory } = filesToUpload[i];
        console.log(`📤 Uploading document: ${file.name}`);

        const formData = new FormData();
        formData.append('file', file);

        // Determine title logic
        let titleToUse = file.name.replace(/\.[^/.]+$/, '');
        if (documentTitle && !isSubcategoryMode) {
          if (filesToUpload.length > 1) {
            titleToUse = `${documentTitle} (${i + 1})`;
          } else {
            titleToUse = documentTitle;
          }
        }

        formData.append('title', titleToUse);
        formData.append('productCategory', productCategory);
        formData.append('policyNumber', policyNumber);
        formData.append('uploadedBy', user?.id || 'admin');
        if (packId) {
          formData.append('packId', packId);
          formData.append('packTitle', packTitle);
        }
        if (subcategory) {
          formData.append('subcategory', subcategory);
        }

        const data = await api.post<{ document: DocumentItem }>(
          `/documents/${selectedClient.id}/upload`,
          formData,
        );
        console.log('✅ Document uploaded:', data.document);
        newDocIds.push(data.document.id);
        newDocs.push(data.document);
      }

      toast.success(`${newDocs.length} document(s) uploaded successfully`);
      setDocuments((prev) => [...newDocs, ...prev]);

      // Prepare for email dialog
      setUploadedDocIds(newDocIds);
      resetForm();
      setUploadDialogOpen(false);
      setUploadSuccessDialogOpen(true);
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedClient?.id || uploadedDocIds.length === 0) return;

    // Get client details for email - Robust extraction
    // Check root email first, then profile email, then personal info email
    const clientEmail =
      selectedClient.email ||
      selectedClient.profile?.email ||
      (selectedClient.personalInformation as Record<string, unknown> | undefined)?.email ||
      (selectedClient.profile?.personalInformation as Record<string, unknown> | undefined)?.email;

    // Try to get ID number from various possible locations in the client object
    const clientIdNumber =
      selectedClient.idNumber ||
      (selectedClient.profile?.personalInformation as Record<string, unknown> | undefined)
        ?.idNumber ||
      selectedClient.personalInformation?.idNumber;

    if (!clientIdNumber) {
      toast.error('Client ID number is missing (required for encryption)');
      return;
    }

    try {
      setSendingEmail(true);
      await api.post(`/documents/${selectedClient.id}/email`, {
        documentIds: uploadedDocIds,
        email: clientEmail,
        idNumber: clientIdNumber,
        customMessage: uploadEmailMessage,
        isHtml: true, // Using WYSIWYG
        ccAdmin, // Pass CC preference
      });

      toast.success('Documents emailed to client successfully');
      setEmailComposeDialogOpen(false);
      setUploadedDocIds([]);
      setCcAdmin(false); // Reset CC preference
    } catch (error) {
      console.error('❌ Error sending email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddLink = async () => {
    if (!selectedClient?.id || !linkTitle || !linkUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      console.log(`🔗 Creating link: ${linkTitle}`);

      const data = await api.post<{ document: DocumentItem }>(
        `/documents/${selectedClient.id}/link`,
        {
          title: linkTitle,
          url: linkUrl,
          description: linkDescription,
          productCategory,
          policyNumber,
          uploadedBy: user?.id || 'admin',
        },
      );
      console.log('✅ Link created:', data.document);

      toast.success('Link added successfully');
      setDocuments((prev) => [data.document, ...prev]);
      resetForm();
      setUploadDialogOpen(false);
    } catch (error) {
      console.error('❌ Error creating link:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add link');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.type === 'link') {
      window.open(doc.url, '_blank');
      return;
    }

    try {
      console.log(`⬇️ Downloading: ${doc.fileName}`);

      const data = await api.get<{ url: string }>(`/documents/${doc.userId}/${doc.id}/download`);

      // Open signed URL in new tab
      window.open(data.url, '_blank');

      // Mark as viewed
      handleMarkAsViewed(doc);
    } catch (error) {
      console.error('❌ Error downloading:', error);
      toast.error('Failed to download document');
    }
  };

  const handleMarkAsViewed = async (doc: DocumentItem) => {
    if (doc.status === 'viewed') return;

    try {
      const data = await api.patch<{ success?: boolean }>(`/documents/${doc.userId}/${doc.id}`, {
        status: 'viewed',
      });

      if (data.success) {
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'viewed' } : d)));
      }
    } catch (error) {
      console.error('❌ Error marking as viewed:', error);
      // Silently fail - this is not critical functionality
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      console.log(`🗑️ Deleting: ${documentToDelete.title}`);

      await api.delete(`/documents/${documentToDelete.userId}/${documentToDelete.id}`);

      toast.success('Document deleted successfully');
      setDocuments((prev) => prev.filter((d) => d.id !== documentToDelete.id));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('❌ Error deleting:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete document');
    }
  };

  const handleDeletePack = async () => {
    if (!packToDelete) return;

    // Find all documents in this pack
    const docsToDelete = documents.filter((d) => d.packId === packToDelete.id);

    if (docsToDelete.length === 0) {
      setPackDeleteDialogOpen(false);
      setPackToDelete(null);
      return;
    }

    const toastId = toast.loading('Deleting document pack...');

    try {
      console.log(`🗑️ Deleting pack: ${packToDelete.id} (${docsToDelete.length} documents)`);

      // Delete all documents in parallel
      await Promise.all(
        docsToDelete.map(async (doc) => {
          await api.delete(`/documents/${doc.userId}/${doc.id}`);
        }),
      );

      toast.dismiss(toastId);
      toast.success('Document pack deleted successfully');

      // Remove all deleted documents from state
      const deletedIds = new Set(docsToDelete.map((d) => d.id));
      setDocuments((prev) => prev.filter((d) => !deletedIds.has(d.id)));

      setPackDeleteDialogOpen(false);
      setPackToDelete(null);

      // Also remove from expanded packs if present
      if (expandedPacks.has(packToDelete.id)) {
        const newExpanded = new Set(expandedPacks);
        newExpanded.delete(packToDelete.id);
        setExpandedPacks(newExpanded);
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('❌ Error deleting pack:', error);
      toast.error('Failed to delete some documents in the pack');
      // Refresh to ensure consistency
      fetchDocuments();
    }
  };

  const handleConfirmResend = async () => {
    if (!selectedClient?.id || !packToResend) return;

    // Get client details - Robust extraction
    const clientEmail =
      selectedClient.email ||
      selectedClient.profile?.email ||
      (selectedClient.personalInformation as Record<string, unknown> | undefined)?.email ||
      (selectedClient.profile?.personalInformation as Record<string, unknown> | undefined)?.email;

    const clientIdNumber =
      selectedClient.idNumber ||
      (selectedClient.profile?.personalInformation as Record<string, unknown> | undefined)
        ?.idNumber ||
      selectedClient.personalInformation?.idNumber;

    if (!clientIdNumber) {
      toast.error('Client ID number is missing (required for encryption)');
      return;
    }

    try {
      setSendingEmail(true);
      const docIds = packToResend.documents.map((d) => d.id);

      await api.post(`/documents/${selectedClient.id}/email`, {
        documentIds: docIds,
        email: clientEmail,
        idNumber: clientIdNumber,
        emailType: 'resend',
        customMessage: resendMessage,
        isHtml: true, // Use WYSIWYG for resend too
        ccAdmin,
      });

      toast.success('Document pack resent successfully');
      setResendDialogOpen(false);
      setPackToResend(null);
      setResendMessage('');
      setCcAdmin(false);
    } catch (error) {
      console.error('❌ Error resending pack:', error);
      toast.error('Failed to resend document pack');
    } finally {
      setSendingEmail(false);
    }
  };

  const addSubcategoryGroup = () => {
    setSubcategoryGroups((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', customName: '', files: [] },
    ]);
  };

  const removeSubcategoryGroup = (id: string) => {
    if (subcategoryGroups.length <= 1) return;
    setSubcategoryGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const updateSubcategoryGroup = (id: string, updates: Partial<SubcategoryGroup>) => {
    setSubcategoryGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setLinkTitle('');
    setLinkUrl('');
    setLinkDescription('');
    setDocumentTitle('');
    setProductCategory('');
    setPolicyNumber('');
    setUploadEmailMessage('');
    setUploadMode('general');
    setSubcategoryGroups([{ id: '1', name: '', customName: '', files: [] }]);
  };

  const togglePack = (packId: string) => {
    const newSet = new Set(expandedPacks);
    if (newSet.has(packId)) newSet.delete(packId);
    else newSet.add(packId);
    setExpandedPacks(newSet);
  };

  const filteredDocuments = filterDocuments(documents, {
    searchQuery,
    filterCategory,
    filterDateStart,
    filterDateEnd,
  });

  const groupedItems = groupDocumentsByPack(filteredDocuments);

  if (!selectedClient) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a client to view their documents
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Document Management</h3>
          <p className="text-sm text-muted-foreground">
            Upload documents and links for {selectedClient.firstName} {selectedClient.lastName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocuments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <DocumentStatsCards totalPacks={groupedItems.length} filteredDocuments={filteredDocuments} />

      {/* Filters */}
      <DocumentFiltersBar
        searchInputGuard={searchInputGuard}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterDateStart={filterDateStart}
        setFilterDateStart={setFilterDateStart}
        filterDateEnd={filterDateEnd}
        setFilterDateEnd={setFilterDateEnd}
      />

      {/* Documents List */}
      <DocumentList
        loading={loading}
        documents={documents}
        filteredDocuments={filteredDocuments}
        groupedItems={groupedItems}
        expandedPacks={expandedPacks}
        onTogglePack={togglePack}
        onDownload={handleDownload}
        onDeleteDocument={(doc) => {
          setDocumentToDelete(doc);
          setDeleteDialogOpen(true);
        }}
        onDeletePack={(id, count) => {
          setPackToDelete({ id, count });
          setPackDeleteDialogOpen(true);
        }}
        onResendPack={(pack) => {
          setPackToResend(pack);
          setResendMessage('Please find attached the documents you requested.');
          setResendDialogOpen(true);
        }}
        onUploadClick={() => setUploadDialogOpen(true)}
      />

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-4xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 pb-2 flex-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Add Document or Link
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                Upload a document file or add a link to an external resource
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs
            value={uploadType}
            onValueChange={(v) => setUploadType(v as 'document' | 'link')}
            className="w-full flex-1 flex flex-col min-h-0"
          >
            <div className="px-6 flex-none">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger
                  value="document"
                  className="rounded-lg data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white data-[state=inactive]:text-slate-600 font-medium transition-all"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </TabsTrigger>
                <TabsTrigger
                  value="link"
                  className="rounded-lg data-[state=active]:bg-[#7c3aed] data-[state=active]:text-white data-[state=inactive]:text-slate-600 font-medium transition-all"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Add Link
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <TabsContent value="document" className="space-y-5 mt-0 focus-visible:ring-0">
                {/* Upload Mode Selection */}
                <div className="space-y-3">
                  <Label className="font-medium text-slate-900">Upload Type</Label>
                  <RadioGroup
                    value={uploadMode}
                    onValueChange={(v) => setUploadMode(v as 'general' | 'subcategory')}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="general" id="mode-general" className="peer sr-only" />
                      <Label
                        htmlFor="mode-general"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-violet-600 peer-data-[state=checked]:bg-violet-50 [&:has([data-state=checked])]:border-violet-600 cursor-pointer transition-all"
                      >
                        <FileText className="mb-2 h-6 w-6 text-slate-500 peer-data-[state=checked]:text-violet-600" />
                        <span className="font-medium">General Upload</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="subcategory"
                        id="mode-subcategory"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="mode-subcategory"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-violet-600 peer-data-[state=checked]:bg-violet-50 [&:has([data-state=checked])]:border-violet-600 cursor-pointer transition-all"
                      >
                        <Folder className="mb-2 h-6 w-6 text-slate-500 peer-data-[state=checked]:text-violet-600" />
                        <span className="font-medium">Subcategory Group</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {uploadMode === 'general' ? (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label htmlFor="file-upload" className="font-medium text-slate-900">
                        Choose File(s) *
                      </Label>
                      <div className="relative">
                        <Input
                          id="file-upload"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                          onChange={(e) => {
                            if (e.target.files) {
                              setSelectedFiles(Array.from(e.target.files));
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-start mt-1">
                        <p className="text-xs text-slate-400">
                          Supported: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 50MB)
                        </p>
                        {selectedFiles.length > 0 && (
                          <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}{' '}
                            selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doc-title" className="font-medium text-slate-900">
                        Title {selectedFiles.length <= 1 && '*'}
                      </Label>
                      <Input
                        id="doc-title"
                        placeholder={
                          selectedFiles.length > 1
                            ? 'Enter title for all files (optional)'
                            : 'Enter document title'
                        }
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                      />
                      {selectedFiles.length > 1 && (
                        <p className="text-xs text-slate-500">
                          Leave blank to use filenames, or enter a title to apply to all files
                          (numbered)
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    {/* Master Pack Title */}
                    <div className="space-y-2">
                      <Label htmlFor="master-title" className="font-medium text-slate-900">
                        Pack Name (Required)
                      </Label>
                      <Input
                        id="master-title"
                        placeholder="e.g. Onboarding Documents 2024"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                      />
                      <p className="text-xs text-slate-500">
                        This will be the main title of the document pack in the client's profile.
                      </p>
                    </div>

                    {/* Subcategory Groups */}
                    <div className="space-y-4">
                      <Label className="font-medium text-slate-900">Subcategory Groups</Label>

                      {subcategoryGroups.map((group) => (
                        <div
                          key={group.id}
                          className="p-4 border rounded-lg bg-slate-50 space-y-4 relative"
                        >
                          <div className="absolute top-2 right-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeSubcategoryGroup(group.id)}
                              disabled={subcategoryGroups.length <= 1}
                              title="Remove Group"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                            {/* Name Selection */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-slate-500">
                                Subcategory Name
                              </Label>
                              <Select
                                value={group.name}
                                onValueChange={(val) =>
                                  updateSubcategoryGroup(group.id, { name: val })
                                }
                              >
                                <SelectTrigger className="h-9 bg-white border-slate-200">
                                  <SelectValue placeholder="Select name" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUBCATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {group.name === 'Other' && (
                                <Input
                                  placeholder="Custom Name"
                                  value={group.customName}
                                  onChange={(e) =>
                                    updateSubcategoryGroup(group.id, { customName: e.target.value })
                                  }
                                  className="h-9 mt-2 bg-white border-slate-200"
                                />
                              )}
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-slate-500">Files</Label>
                              <div className="relative">
                                <Input
                                  type="file"
                                  multiple
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                  className="cursor-pointer file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 h-9 text-sm"
                                  onChange={(e) => {
                                    if (e.target.files) {
                                      updateSubcategoryGroup(group.id, {
                                        files: Array.from(e.target.files),
                                      });
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">
                                  {group.files.length} file{group.files.length !== 1 ? 's' : ''}{' '}
                                  selected
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addSubcategoryGroup}
                        className="w-full border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Subcategory Group
                      </Button>
                    </div>

                    <div className="bg-blue-50 text-blue-700 p-3 rounded-md text-sm flex gap-2 border border-blue-100">
                      <Folder className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p>
                        Each group created above will be sent as a separate, encrypted ZIP file in
                        the email to the client.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-category" className="font-medium text-slate-900">
                      Category *
                    </Label>
                    <Select value={productCategory} onValueChange={setProductCategory}>
                      <SelectTrigger
                        id="doc-category"
                        className={`h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500 ${!productCategory ? 'text-slate-400' : ''}`}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Life">Life Insurance</SelectItem>
                        <SelectItem value="Short-Term">Short-Term</SelectItem>
                        <SelectItem value="Investment">Investment</SelectItem>
                        <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                        <SelectItem value="Retirement">Retirement</SelectItem>
                        <SelectItem value="Estate">Estate Planning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doc-policy" className="font-medium text-slate-900">
                      Policy Number
                    </Label>
                    <Input
                      id="doc-policy"
                      placeholder="e.g., LIF-2024-00123"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="link" className="space-y-5 mt-0 focus-visible:ring-0">
                <div className="space-y-2">
                  <Label htmlFor="link-title" className="font-medium text-slate-900">
                    Title *
                  </Label>
                  <Input
                    id="link-title"
                    placeholder="e.g., Old Mutual Online Portal"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link-url" className="font-medium text-slate-900">
                    URL *
                  </Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="link-url"
                      type="url"
                      placeholder="https://example.com"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="pl-9 h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link-description" className="font-medium text-slate-900">
                    Description
                  </Label>
                  <Textarea
                    id="link-description"
                    placeholder="Brief description of this resource"
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    rows={3}
                    className="resize-none border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="link-category" className="font-medium text-slate-900">
                      Category *
                    </Label>
                    <Select value={productCategory} onValueChange={setProductCategory}>
                      <SelectTrigger
                        id="link-category"
                        className={`h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500 ${!productCategory ? 'text-slate-400' : ''}`}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        <SelectItem value="Life">Life Insurance</SelectItem>
                        <SelectItem value="Short-Term">Short-Term</SelectItem>
                        <SelectItem value="Investment">Investment</SelectItem>
                        <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                        <SelectItem value="Retirement">Retirement</SelectItem>
                        <SelectItem value="Estate">Estate Planning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="link-policy" className="font-medium text-slate-900">
                      Policy Number
                    </Label>
                    <Input
                      id="link-policy"
                      placeholder="e.g., LIF-2024-00123"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-end gap-3 p-6 pt-2 border-t border-slate-100 bg-slate-50/50 flex-none">
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                resetForm();
              }}
              className="h-10 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={uploadType === 'document' ? handleFileUpload : handleAddLink}
              disabled={
                uploading ||
                (uploadType === 'document' &&
                  (uploadMode === 'general'
                    ? selectedFiles.length === 0 ||
                      !productCategory ||
                      (selectedFiles.length === 1 && !documentTitle)
                    : !documentTitle ||
                      !productCategory ||
                      !subcategoryGroups.some((g) => g.files.length > 0))) ||
                (uploadType === 'link' && (!linkTitle || !linkUrl || !productCategory))
              }
              className="h-10 px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-sm"
            >
              {uploading ? (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {uploadType === 'document' ? 'Uploading...' : 'Adding...'}
                </div>
              ) : (
                <div className="contents">
                  {uploadType === 'document' ? (
                    <div className="contents">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </div>
                  ) : (
                    <div className="contents">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Link
                    </div>
                  )}
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteDocumentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
      />

      {/* Pack Delete Confirmation */}
      <DeletePackDialog
        open={packDeleteDialogOpen}
        onOpenChange={setPackDeleteDialogOpen}
        count={packToDelete?.count || 0}
        onConfirm={handleDeletePack}
      />

      {/* Resend Pack Dialog */}
      <ResendPackDialog
        open={resendDialogOpen}
        onOpenChange={setResendDialogOpen}
        message={resendMessage}
        onMessageChange={setResendMessage}
        ccAdmin={ccAdmin}
        onCcAdminChange={setCcAdmin}
        sending={sendingEmail}
        onConfirm={handleConfirmResend}
      />

      {/* Step 1: Upload Success & Prompt */}
      <UploadSuccessDialog
        open={uploadSuccessDialogOpen}
        onOpenChange={setUploadSuccessDialogOpen}
        uploadedCount={uploadedDocIds.length}
        onSkip={() => {
          setUploadSuccessDialogOpen(false);
          setUploadedDocIds([]); // Clear state if skipping
        }}
        onNotify={() => {
          setUploadSuccessDialogOpen(false);
          setEmailComposeDialogOpen(true);
        }}
      />

      {/* Step 2: Compose Email (WYSIWYG) */}
      <EmailComposeDialog
        open={emailComposeDialogOpen}
        onOpenChange={setEmailComposeDialogOpen}
        message={uploadEmailMessage}
        onMessageChange={setUploadEmailMessage}
        ccAdmin={ccAdmin}
        onCcAdminChange={setCcAdmin}
        sending={sendingEmail}
        onSend={handleSendEmail}
      />
    </div>
  );
}
