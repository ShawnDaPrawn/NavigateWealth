import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { api } from '../../../../../utils/api';
import { toast } from 'sonner';
import { useAuth } from '../../../../auth/AuthContext';
import type { DocumentItem } from './documentsUtils';

const SUBCATEGORIES = [
  'Compliance',

  'New Business Welcome Pack',

  'FICA Documents',

  'Application Forms',

  'Policy Schedule',

  'Other',
];

interface SubcategoryGroup {
  id: string;

  name: string;

  customName: string;

  files: File[];
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClient: { id: string };
  /** Files uploaded — hands the new docs + their ids back so the parent can
   *  prepend them and open the post-upload notify flow. */
  onUploaded: (newDocs: DocumentItem[], newDocIds: string[]) => void;
  /** A link was added — hand the new doc back for the parent to prepend. */
  onLinkAdded: (doc: DocumentItem) => void;
}

/** The "Add Document or Link" dialog — owns the whole upload form (general /
 *  subcategory file uploads + external links) and reports results back to
 *  DocumentsTab via onUploaded / onLinkAdded. */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  selectedClient,
  onUploaded,
  onLinkAdded,
}: UploadDocumentDialogProps) {
  const { user } = useAuth();
  const [uploadType, setUploadType] = useState<'document' | 'link'>('document');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [linkTitle, setLinkTitle] = useState('');

  const [linkUrl, setLinkUrl] = useState('');

  const [linkDescription, setLinkDescription] = useState('');

  const [documentTitle, setDocumentTitle] = useState('');

  const [productCategory, setProductCategory] = useState('');

  const [policyNumber, setPolicyNumber] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'general' | 'subcategory'>('general');

  const [subcategoryGroups, setSubcategoryGroups] = useState<SubcategoryGroup[]>([
    { id: '1', name: '', customName: '', files: [] },
  ]);

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

      resetForm();

      onOpenChange(false);

      onUploaded(newDocs, newDocIds);
    } catch (error) {
      console.error('❌ Error uploading document:', error);

      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      setUploading(false);
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

      resetForm();

      onOpenChange(false);

      onLinkAdded(data.document);
    } catch (error) {
      console.error('❌ Error creating link:', error);

      toast.error(error instanceof Error ? error.message : 'Failed to add link');
    } finally {
      setUploading(false);
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

    setUploadMode('general');

    setSubcategoryGroups([{ id: '1', name: '', customName: '', files: [] }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                      Each group created above will be sent as a separate, encrypted ZIP file in the
                      email to the client.
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
              onOpenChange(false);

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
  );
}
