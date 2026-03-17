import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Folder,
  RefreshCw,
  Heart,
  Shield,
  TrendingUp,
  Activity,
  Briefcase,
  Home,
  Search,
  Filter,
  Calendar,
  X,
  ChevronDown,
  ChevronRight,
  Files,
  ArrowRight,
  Mail
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../../../auth/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../../ui/alert-dialog';
import { Checkbox } from '../../../../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';

const SUBCATEGORIES = [
  "Compliance",
  "New Business Welcome Pack",
  "FICA Documents",
  "Application Forms",
  "Policy Schedule",
  "Other"
];

interface DocumentsTabProps {
  selectedClient: { id: string; firstName: string; lastName: string; email: string; idNumber?: string; profile?: Record<string, unknown>; personalInformation?: Record<string, unknown> };
}

interface DocumentItem {
  id: string;
  userId: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: string;
  productCategory: string;
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  uploadedBy: string;
  // Grouping
  packId?: string;
  packTitle?: string;
  subcategory?: string;
  // Document specific
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific
  url?: string;
  description?: string;
}

export function DocumentsTab({ selectedClient }: DocumentsTabProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packDeleteDialogOpen, setPackDeleteDialogOpen] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [uploadSuccessDialogOpen, setUploadSuccessDialogOpen] = useState(false);
  const [emailComposeDialogOpen, setEmailComposeDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentItem | null>(null);
  const [packToDelete, setPackToDelete] = useState<{ id: string, count: number } | null>(null);
  const [packToResend, setPackToResend] = useState<{ id: string, documents: DocumentItem[] } | null>(null);
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
    { id: '1', name: '', customName: '', files: [] }
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

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${selectedClient.id}`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch documents');
        }

        const data = await response.json();

        // Sort by upload date, newest first
        const sortedDocs = data.documents.sort((a: DocumentItem, b: DocumentItem) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );

        setDocuments(sortedDocs);
        return; // Success — exit retry loop
      } catch (error) {
        if (attempt < maxRetries) {
          // Retry after delay (handles cold-start / transient network failures)
          await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
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
        group.files.forEach(f => filesToUpload.push({ file: f, subcategory: name }));
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
      selectedFiles.forEach(f => filesToUpload.push({ file: f }));
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

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${selectedClient.id}/upload`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
            body: formData
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to upload ${file.name}`);
        }

        const data = await response.json();
        console.log('✅ Document uploaded:', data.document);
        newDocIds.push(data.document.id);
        newDocs.push(data.document);
      }

      toast.success(`${newDocs.length} document(s) uploaded successfully`);
      setDocuments(prev => [...newDocs, ...prev]);
      
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
    const clientEmail = selectedClient.email || 
                       selectedClient.profile?.email || 
                       selectedClient.personalInformation?.email ||
                       selectedClient.profile?.personalInformation?.email;
    
    // Try to get ID number from various possible locations in the client object
    const clientIdNumber = selectedClient.idNumber || 
                          selectedClient.profile?.personalInformation?.idNumber || 
                          selectedClient.personalInformation?.idNumber;

    if (!clientIdNumber) {
      toast.error('Client ID number is missing (required for encryption)');
      return;
    }

    try {
      setSendingEmail(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${selectedClient.id}/email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            documentIds: uploadedDocIds,
            email: clientEmail,
            idNumber: clientIdNumber,
            customMessage: uploadEmailMessage,
            isHtml: true, // Using WYSIWYG
            ccAdmin // Pass CC preference
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${selectedClient.id}/link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: linkTitle,
            url: linkUrl,
            description: linkDescription,
            productCategory,
            policyNumber,
            uploadedBy: user?.id || 'admin'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create link');
      }

      const data = await response.json();
      console.log('✅ Link created:', data.document);

      toast.success('Link added successfully');
      setDocuments(prev => [data.document, ...prev]);
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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${doc.userId}/${doc.id}/download`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${doc.userId}/${doc.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'viewed' })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to mark as viewed:', response.status, errorData);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? { ...d, status: 'viewed' } : d
        ));
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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${documentToDelete.userId}/${documentToDelete.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete document');
      }

      toast.success('Document deleted successfully');
      setDocuments(prev => prev.filter(d => d.id !== documentToDelete.id));
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
    const docsToDelete = documents.filter(d => d.packId === packToDelete.id);
    
    if (docsToDelete.length === 0) {
      setPackDeleteDialogOpen(false);
      setPackToDelete(null);
      return;
    }

    const toastId = toast.loading('Deleting document pack...');

    try {
      console.log(`🗑️ Deleting pack: ${packToDelete.id} (${docsToDelete.length} documents)`);

      // Delete all documents in parallel
      await Promise.all(docsToDelete.map(async (doc) => {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${doc.userId}/${doc.id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete ${doc.id}`);
        }
      }));

      toast.dismiss(toastId);
      toast.success('Document pack deleted successfully');
      
      // Remove all deleted documents from state
      const deletedIds = new Set(docsToDelete.map(d => d.id));
      setDocuments(prev => prev.filter(d => !deletedIds.has(d.id)));
      
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
    const clientEmail = selectedClient.email || 
                       selectedClient.profile?.email || 
                       selectedClient.personalInformation?.email ||
                       selectedClient.profile?.personalInformation?.email;

    const clientIdNumber = selectedClient.idNumber || 
                          selectedClient.profile?.personalInformation?.idNumber || 
                          selectedClient.personalInformation?.idNumber;

    if (!clientIdNumber) {
      toast.error('Client ID number is missing (required for encryption)');
      return;
    }

    try {
      setSendingEmail(true);
      const docIds = packToResend.documents.map(d => d.id);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${selectedClient.id}/email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            documentIds: docIds,
            email: clientEmail,
            idNumber: clientIdNumber,
            emailType: 'resend',
            customMessage: resendMessage,
            isHtml: true, // Use WYSIWYG for resend too
            ccAdmin
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend documents');
      }

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
    setSubcategoryGroups(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', customName: '', files: [] }
    ]);
  };

  const removeSubcategoryGroup = (id: string) => {
    if (subcategoryGroups.length <= 1) return;
    setSubcategoryGroups(prev => prev.filter(g => g.id !== id));
  };

  const updateSubcategoryGroup = (id: string, updates: Partial<SubcategoryGroup>) => {
    setSubcategoryGroups(prev => prev.map(g => 
      g.id === id ? { ...g, ...updates } : g
    ));
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Life':
        return <Heart className="h-4 w-4" />;
      case 'Short-Term':
        return <Shield className="h-4 w-4" />;
      case 'Investment':
        return <TrendingUp className="h-4 w-4" />;
      case 'Medical Aid':
        return <Activity className="h-4 w-4" />;
      case 'Retirement':
        return <Briefcase className="h-4 w-4" />;
      case 'Estate':
        return <Home className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Life':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Short-Term':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Investment':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Medical Aid':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Retirement':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Estate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const togglePack = (packId: string) => {
    const newSet = new Set(expandedPacks);
    if (newSet.has(packId)) newSet.delete(packId);
    else newSet.add(packId);
    setExpandedPacks(newSet);
  };

  const filteredDocuments = documents.filter(doc => {
    // Search query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      doc.title.toLowerCase().includes(searchLower) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchLower)) ||
      (doc.policyNumber && doc.policyNumber.toLowerCase().includes(searchLower)) ||
      (doc.description && doc.description.toLowerCase().includes(searchLower));

    // Category filter
    const matchesCategory = filterCategory === 'All' || doc.productCategory === filterCategory;

    // Date range filter
    let matchesDate = true;
    if (filterDateStart) {
      matchesDate = matchesDate && new Date(doc.uploadDate) >= new Date(filterDateStart);
    }
    if (filterDateEnd) {
      // Add 1 day to include the end date fully (since date inputs are usually 00:00)
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(doc.uploadDate) <= endDate;
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Group documents by packId
  const groupedItems: (DocumentItem | { type: 'pack', id: string, title: string, documents: DocumentItem[], category: string, date: string, status: string, policyNumber?: string })[] = [];
  const processedPackIds = new Set<string>();

  filteredDocuments.forEach(doc => {
    // Group if packId exists (Subcategory upload or multi-file upload)
    if (doc.packId) {
      if (!processedPackIds.has(doc.packId)) {
        processedPackIds.add(doc.packId);
        const packDocs = filteredDocuments.filter(d => d.packId === doc.packId);
        // Sort inside pack
        const sortedPackDocs = [...packDocs].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

        groupedItems.push({
          type: 'pack',
          id: doc.packId,
          title: doc.packTitle || doc.title.replace(/\s\(\d+\)$/, ''),
          documents: sortedPackDocs,
          category: doc.productCategory,
          date: doc.uploadDate,
          status: packDocs.some(d => d.status === 'new') ? 'new' : 'viewed',
          policyNumber: doc.policyNumber // Assuming shared policy number for pack
        });
      }
    } else {
      // Single document (no packId)
      groupedItems.push(doc);
    }
  });

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
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDocuments}
            disabled={loading}
          >
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
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Packs</p>
                <p className="text-2xl font-semibold">{groupedItems.length}</p>
              </div>
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-semibold">
                  {filteredDocuments.filter(d => d.type === 'document').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Links</p>
                <p className="text-2xl font-semibold">
                  {filteredDocuments.filter(d => d.type === 'link').length}
                </p>
              </div>
              <LinkIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-2xl font-semibold">
                  {filteredDocuments.filter(d => d.status === 'new').length}
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800">New</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, filename, or policy..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="w-full md:w-[200px]">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
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

          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                type="date"
                className="w-[140px]"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                title="Start Date"
              />
            </div>
            <span className="text-muted-foreground">-</span>
            <div className="relative">
              <Input
                type="date"
                className="w-[140px]"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                title="End Date"
              />
            </div>
          </div>
          
          {(filterCategory !== 'All' || filterDateStart || filterDateEnd) && (
             <Button 
               variant="ghost" 
               size="sm"
               onClick={() => {
                 setFilterCategory('All');
                 setFilterDateStart('');
                 setFilterDateEnd('');
               }}
               className="px-2"
               title="Clear Filters"
             >
               <X className="h-4 w-4" />
             </Button>
          )}
        </div>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Client Documents & Links
            {documents.length > 0 && filteredDocuments.length !== documents.length && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Showing {filteredDocuments.length} of {documents.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading documents...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents found'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {documents.length === 0 ? 'Upload documents or add links to get started' : 'Try adjusting your filters or search terms'}
              </p>
              {documents.length === 0 && (
                <Button
                  className="mt-4"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedItems.map((item) => {
                if ('documents' in item) {
                  // Render Pack
                  const isExpanded = expandedPacks.has(item.id);
                  return (
                    <div key={item.id} className="border rounded-lg overflow-hidden transition-all hover:border-gray-300">
                      {/* Pack Header */}
                      <div 
                        className="flex items-center gap-4 p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50"
                        onClick={() => togglePack(item.id)}
                      >
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                            <Files className="h-6 w-6" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{item.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {item.documents.length} files
                            </Badge>
                            {item.status === 'new' && <Badge className="bg-blue-100 text-blue-800">New</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Document Pack • Uploaded {formatDate(item.date)}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`${getCategoryColor(item.category)} border`}>
                              <span className="flex items-center gap-1">
                                {getCategoryIcon(item.category)}
                                <span className="text-xs">{item.category}</span>
                              </span>
                            </Badge>
                            {item.policyNumber && (
                              <Badge variant="outline" className="text-xs">
                                {item.policyNumber}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPackToResend({ id: item.id, documents: item.documents });
                              setResendMessage("Please find attached the documents you requested.");
                              setResendDialogOpen(true);
                            }}
                            title="Resend Pack"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPackToDelete({ id: item.id, count: item.documents.length });
                              setPackDeleteDialogOpen(true);
                            }}
                            title="Delete Entire Pack"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </div>
                        </div>
                      </div>
                      
                      {/* Pack Content (Expanded) */}
                      {isExpanded && (
                        <div className="bg-slate-50 border-t p-3 pl-8 space-y-4">
                          {(() => {
                            // Group docs by subcategory
                            const docsBySubcat: Record<string, DocumentItem[]> = {};
                            const looseDocs: DocumentItem[] = [];
                            
                            item.documents.forEach(d => {
                              if (d.subcategory) {
                                if (!docsBySubcat[d.subcategory]) docsBySubcat[d.subcategory] = [];
                                docsBySubcat[d.subcategory].push(d);
                              } else {
                                looseDocs.push(d);
                              }
                            });
                            
                            const hasSubcats = Object.keys(docsBySubcat).length > 0;
                            
                            const renderDoc = (doc: DocumentItem) => (
                              <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded border hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{doc.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{doc.fileName} • {formatFileSize(doc.fileSize)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => { e.stopPropagation(); setDocumentToDelete(doc); setDeleteDialogOpen(true); }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                            
                            return (
                              <div className="contents">
                                {/* Render Subcategories */}
                                {Object.entries(docsBySubcat).map(([subcatName, docs]) => (
                                  <div key={subcatName} className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-1 border-b border-slate-200">
                                      <Folder className="h-4 w-4 text-violet-500" />
                                      {subcatName}
                                    </div>
                                    {docs.map(doc => renderDoc(doc))}
                                  </div>
                                ))}

                                {/* Render Loose Docs (if mixed) */}
                                {looseDocs.length > 0 && (
                                  <div className="space-y-2">
                                    {hasSubcats && (
                                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-1 border-b border-slate-200">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        Other Documents
                                      </div>
                                    )}
                                    {looseDocs.map(doc => renderDoc(doc))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // Render Single Document
                  const doc = item;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div
                          className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                            doc.type === 'link' ? 'bg-purple-50' : 'bg-red-50'
                          }`}
                        >
                          {doc.type === 'link' ? (
                            <LinkIcon className="h-6 w-6 text-purple-600" />
                          ) : (
                            <FileText className="h-6 w-6 text-red-600" />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{doc.title}</h4>
                              {doc.status === 'new' && (
                                <Badge className="bg-blue-100 text-blue-800">New</Badge>
                              )}
                            </div>
                            {doc.type === 'document' ? (
                              <p className="text-sm text-muted-foreground">
                                {doc.fileName} • {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.uploadDate)}
                              </p>
                            ) : (
                              <div>
                                <p className="text-sm text-blue-600 truncate">{doc.url}</p>
                                {doc.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                                )}
                                <p className="text-sm text-muted-foreground mt-1">
                                  Added {formatDate(doc.uploadDate)}
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`${getCategoryColor(doc.productCategory)} border`}>
                                <span className="flex items-center gap-1">
                                  {getCategoryIcon(doc.productCategory)}
                                  <span className="text-xs">{doc.productCategory}</span>
                                </span>
                              </Badge>
                              {doc.policyNumber && (
                                <Badge variant="outline" className="text-xs">
                                  {doc.policyNumber}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              title={doc.type === 'link' ? 'Open Link' : 'Download'}
                            >
                              {doc.type === 'link' ? (
                                <ExternalLink className="h-4 w-4" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDocumentToDelete(doc);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-4xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 pb-2 flex-none">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">Add Document or Link</DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                Upload a document file or add a link to an external resource
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as 'document' | 'link')} className="w-full flex-1 flex flex-col min-h-0">
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
                  <RadioGroup value={uploadMode} onValueChange={(v) => setUploadMode(v as 'general' | 'subcategory')} className="grid grid-cols-2 gap-4">
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
                      <RadioGroupItem value="subcategory" id="mode-subcategory" className="peer sr-only" />
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
                      <Label htmlFor="file-upload" className="font-medium text-slate-900">Choose File(s) *</Label>
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
                            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="doc-title" className="font-medium text-slate-900">Title {selectedFiles.length <= 1 && '*'}</Label>
                      <Input
                        id="doc-title"
                        placeholder={selectedFiles.length > 1 ? "Enter title for all files (optional)" : "Enter document title"}
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                      />
                      {selectedFiles.length > 1 && (
                        <p className="text-xs text-slate-500">
                          Leave blank to use filenames, or enter a title to apply to all files (numbered)
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    {/* Master Pack Title */}
                    <div className="space-y-2">
                      <Label htmlFor="master-title" className="font-medium text-slate-900">Pack Name (Required)</Label>
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
                        <div key={group.id} className="p-4 border rounded-lg bg-slate-50 space-y-4 relative">
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
                              <Label className="text-xs font-medium text-slate-500">Subcategory Name</Label>
                              <Select 
                                value={group.name} 
                                onValueChange={(val) => updateSubcategoryGroup(group.id, { name: val })}
                              >
                                <SelectTrigger className="h-9 bg-white border-slate-200">
                                  <SelectValue placeholder="Select name" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUBCATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {group.name === 'Other' && (
                                <Input
                                  placeholder="Custom Name"
                                  value={group.customName}
                                  onChange={(e) => updateSubcategoryGroup(group.id, { customName: e.target.value })}
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
                                      updateSubcategoryGroup(group.id, { files: Array.from(e.target.files) });
                                    }
                                  }}
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">
                                  {group.files.length} file{group.files.length !== 1 ? 's' : ''} selected
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
                        Each group created above will be sent as a separate, encrypted ZIP file in the email to the client.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-category" className="font-medium text-slate-900">Category *</Label>
                    <Select value={productCategory} onValueChange={setProductCategory}>
                      <SelectTrigger id="doc-category" className={`h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500 ${!productCategory ? "text-slate-400" : ""}`}>
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
                    <Label htmlFor="doc-policy" className="font-medium text-slate-900">Policy Number</Label>
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
                  <Label htmlFor="link-title" className="font-medium text-slate-900">Title *</Label>
                  <Input
                    id="link-title"
                    placeholder="e.g., Old Mutual Online Portal"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="link-url" className="font-medium text-slate-900">URL *</Label>
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
                  <Label htmlFor="link-description" className="font-medium text-slate-900">Description</Label>
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
                    <Label htmlFor="link-category" className="font-medium text-slate-900">Category *</Label>
                    <Select value={productCategory} onValueChange={setProductCategory}>
                      <SelectTrigger id="link-category" className={`h-10 border-slate-200 focus:border-violet-500 focus:ring-violet-500 ${!productCategory ? "text-slate-400" : ""}`}>
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
                    <Label htmlFor="link-policy" className="font-medium text-slate-900">Policy Number</Label>
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
                (uploadType === 'document' && (
                  uploadMode === 'general' 
                    ? (selectedFiles.length === 0 || !productCategory || (selectedFiles.length === 1 && !documentTitle))
                    : (!documentTitle || !productCategory || !subcategoryGroups.some(g => g.files.length > 0))
                )) || 
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
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pack Delete Confirmation */}
      <Dialog open={packDeleteDialogOpen} onOpenChange={setPackDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document Pack</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pack? This will delete all <strong>{packToDelete?.count || 0}</strong> documents in it.
              <br /><br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePack}
            >
              Delete Pack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Pack Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={setResendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resend Document Pack</DialogTitle>
            <DialogDescription>
              Resend this document pack to the client via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Message to Client</Label>
              <div className="h-64 mb-12">
                <ReactQuill 
                  value={resendMessage}
                  onChange={setResendMessage}
                  theme="snow"
                  placeholder="Enter a message to the client..."
                  style={{ height: '200px' }}
                />
              </div>
              <p className="text-xs text-muted-foreground pt-4">
                This message will be included in the email body. The documents will be attached as an encrypted ZIP file.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cc-admin-resend" 
                checked={ccAdmin}
                onCheckedChange={(checked) => setCcAdmin(checked as boolean)}
              />
              <Label htmlFor="cc-admin-resend" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                CC info@navigatewealth.co
              </Label>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setResendDialogOpen(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmResend}
              disabled={sendingEmail}
              className="bg-[#6d28d9] hover:bg-[#5b21b6]"
            >
              {sendingEmail ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 1: Upload Success & Prompt */}
      <Dialog open={uploadSuccessDialogOpen} onOpenChange={setUploadSuccessDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-full">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              Documents Uploaded Successfully
            </DialogTitle>
            <DialogDescription>
              {uploadedDocIds.length} document(s) have been added to the client's profile.
              <br /><br />
              Would you like to email the client to notify them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadSuccessDialogOpen(false);
                setUploadedDocIds([]); // Clear state if skipping
              }}
            >
              Skip
            </Button>
            <Button
              onClick={() => {
                setUploadSuccessDialogOpen(false);
                setEmailComposeDialogOpen(true);
              }}
              className="bg-[#6d28d9] hover:bg-[#5b21b6]"
            >
              <Mail className="h-4 w-4 mr-2" />
              Yes, Notify Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Compose Email (WYSIWYG) */}
      <Dialog open={emailComposeDialogOpen} onOpenChange={setEmailComposeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Documents to Client</DialogTitle>
            <DialogDescription>
              Notify the client that new documents have been added to their profile.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Secure Attachment</p>
              <p>The documents will be attached as an <strong>encrypted ZIP file</strong>.</p>
              <p className="mt-1 text-xs opacity-90">Password: Client's National ID Number</p>
            </div>

            <div className="space-y-2">
              <Label>Custom Message</Label>
              <div className="h-64 mb-12">
                <ReactQuill 
                  value={uploadEmailMessage}
                  onChange={setUploadEmailMessage}
                  theme="snow"
                  placeholder="Enter a personal message to the client..."
                  style={{ height: '200px' }}
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox 
                id="cc-admin" 
                checked={ccAdmin}
                onCheckedChange={(checked) => setCcAdmin(checked as boolean)}
              />
              <Label htmlFor="cc-admin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                CC info@navigatewealth.co
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setEmailComposeDialogOpen(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="bg-[#6d28d9] hover:bg-[#5b21b6]"
            >
              {sendingEmail ? (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </div>
              ) : (
                <div className="contents">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
