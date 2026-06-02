import React, { useState, useEffect } from 'react';
import { logger } from '../../../../../utils/logger';
import { filterDocuments, groupDocumentsByPack, type DocumentItem } from './documentsUtils';
import { DocumentStatsCards } from './DocumentStatsCards';
import { DocumentFiltersBar } from './DocumentFiltersBar';
import { DocumentList } from './DocumentList';
import { UploadDocumentDialog } from './UploadDocumentDialog';
import {
  DeleteDocumentDialog,
  DeletePackDialog,
  ResendPackDialog,
  UploadSuccessDialog,
  EmailComposeDialog,
} from './DocumentDialogs';
import { Button } from '../../../../ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { api } from '../../../../../utils/api';
import { toast } from 'sonner';
import { useSearchInputAutofillGuard } from '@/shared/forms/useSearchInputAutofillGuard';

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

  const [sendingEmail, setSendingEmail] = useState(false);
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);
  const [ccAdmin, setCcAdmin] = useState(false);

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

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.type === 'link') {
      window.open(doc.url, '_blank');
      return;
    }

    try {
      logger.info('Downloading document', { fileName: doc.fileName });

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
      logger.info('Deleting document', { title: documentToDelete.title });

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
      logger.info('Deleting document pack', { packId: packToDelete.id, documentCount: docsToDelete.length });

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
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        selectedClient={selectedClient}
        onUploaded={(newDocs, newDocIds) => {
          setDocuments((prev) => [...newDocs, ...prev]);
          setUploadedDocIds(newDocIds);
          setUploadEmailMessage('');
          setUploadSuccessDialogOpen(true);
        }}
        onLinkAdded={(doc) => {
          setDocuments((prev) => [doc, ...prev]);
          setUploadEmailMessage('');
        }}
      />

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
