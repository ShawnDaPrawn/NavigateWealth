/**
 * IDENTITY SECTION - ADMIN VIEW
 * Enhanced UI for better usability and clarity
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog';
import { Alert, AlertDescription } from '../../ui/alert';
import { 
  Shield, IdCard, FileText, CreditCard, Plus, Edit2, Trash2, 
  Save, X, CheckCircle, AlertCircle, Calendar, Globe, Copy, Eye, Download,
  Home, ReceiptText
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { copyToClipboard } from '../../../utils/clipboard';

type IdentityDocumentType =
  | 'national-id'
  | 'passport'
  | 'drivers-license'
  | 'proof-of-residence'
  | 'proof-primary-bank-account'
  | 'utility-bill';

interface IdentityDocument {
  id: string;
  type: IdentityDocumentType;
  number: string;
  countryOfIssue: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
  isVerified?: boolean;
}

interface IdentitySectionProps {
  profileData: Record<string, unknown>;
  identityDocsInEditMode: Set<string>;
  hasDocumentType: (type: IdentityDocumentType) => boolean;
  addIdentityDocument: (type: IdentityDocumentType) => void;
  handleDocumentUpload: (id: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  updateIdentityDocument: (id: string, updates: Partial<IdentityDocument>) => void;
  confirmDeleteIdentityDocument: (id: string) => void;
  removeIdentityDocument: (id: string) => void;
  saveIdentityDocument: (id: string) => void;
  cancelEditIdentityDocument: (id: string) => void;
  editIdentityDocument: (id: string) => void;
  getDocumentTypeLabel: (type: IdentityDocumentType) => string;
  getDocumentTypeIcon: (type: IdentityDocumentType) => { icon: React.ComponentType<{ className?: string }>, color: string };
  identityDocToDelete: string | null;
  setIdentityDocToDelete: (id: string | null) => void;
  userId?: string;
}

const DOCUMENT_TYPES: Record<IdentityDocumentType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  placeholder: string;
  numberLabel: string;
  showIdentityFields: boolean;
}> = {
  'national-id': {
    label: 'Identity',
    icon: IdCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    placeholder: 'e.g., 1234567890123 or A12345678',
    numberLabel: 'ID / Passport Number',
    showIdentityFields: true,
  },
  'passport': {
    label: 'Passport',
    icon: FileText,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    placeholder: 'e.g., A12345678',
    numberLabel: 'Passport Number',
    showIdentityFields: true,
  },
  'drivers-license': {
    label: "Driver's License",
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    placeholder: 'e.g., DL1234567',
    numberLabel: 'License Number',
    showIdentityFields: true,
  },
  'proof-of-residence': {
    label: 'Proof of Residence',
    icon: Home,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    placeholder: 'Optional reference number',
    numberLabel: 'Reference Number',
    showIdentityFields: false,
  },
  'proof-primary-bank-account': {
    label: 'Proof of Primary Bank Account',
    icon: CreditCard,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    placeholder: 'Optional account reference',
    numberLabel: 'Reference Number',
    showIdentityFields: false,
  },
  'utility-bill': {
    label: 'Utility Bill',
    icon: ReceiptText,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    placeholder: 'Optional bill reference',
    numberLabel: 'Reference Number',
    showIdentityFields: false,
  }
};

const KYC_UPLOAD_TYPES: IdentityDocumentType[] = [
  'national-id',
  'proof-of-residence',
  'proof-primary-bank-account',
  'utility-bill',
];

export function IdentitySection({
  profileData,
  identityDocsInEditMode,
  hasDocumentType,
  addIdentityDocument,
  handleDocumentUpload,
  updateIdentityDocument,
  confirmDeleteIdentityDocument,
  removeIdentityDocument,
  saveIdentityDocument,
  cancelEditIdentityDocument,
  editIdentityDocument,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  identityDocToDelete,
  setIdentityDocToDelete,
  userId
}: IdentitySectionProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const identityDocuments = profileData?.identityDocuments || [];

  const handleEdit = (docId: string) => {
    editIdentityDocument(docId);
  };

  const handleSave = (docId: string) => {
    saveIdentityDocument(docId);
  };

  const handleCancel = (docId: string) => {
    cancelEditIdentityDocument(docId);
  };

  const handleDeleteClick = (docId: string) => {
    confirmDeleteIdentityDocument(docId);
  };

  const confirmDelete = () => {
    if (identityDocToDelete) {
      removeIdentityDocument(identityDocToDelete);
    }
  };

  const handleFileChange = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    // We await the upload to ensure it's complete
    await handleDocumentUpload(docId, e);
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    if (!text || text === '') {
      toast.error('No value to copy');
      return;
    }
    try {
      await copyToClipboard(text);
      toast.success(`${fieldName} copied to clipboard`);
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Function to download the document
  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Document download started');
  };

  // Function to view the document in a new tab
  const handleView = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
    toast.success('Document opened in new tab');
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle>KYC Documents</CardTitle>
                <CardDescription>
                  {identityDocuments.length} {identityDocuments.length === 1 ? 'KYC document' : 'KYC documents'} on file
                </CardDescription>
              </div>
            </div>
            <div className="relative">
              <Button 
                onClick={() => setAddMenuOpen(!addMenuOpen)}
                className="bg-[#6d28d9] hover:bg-[#5b21b6]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Document
              </Button>
              {addMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <div className="p-2 space-y-1">
                    {KYC_UPLOAD_TYPES.map((type) => {
                      const config = DOCUMENT_TYPES[type];
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            addIdentityDocument(type);
                            setAddMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className={`h-8 w-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Documents List */}
      {identityDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Add KYC documents to support the client's compliance record
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {identityDocuments.map((doc: IdentityDocument) => {
            const config = DOCUMENT_TYPES[doc.type] || DOCUMENT_TYPES['national-id'];
            const Icon = config.icon;
            const isEditing = identityDocsInEditMode.has(doc.id);
            const expired = isExpired(doc.expiryDate);
            const expiringSoon = isExpiringSoon(doc.expiryDate);
            const showIdentityFields = config.showIdentityFields;

            return (
              <Card key={doc.id} className={`relative overflow-hidden ${expired ? 'border-red-300' : expiringSoon ? 'border-orange-300' : ''}`}>
                {/* Status Bar */}
                <div 
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    expired ? 'bg-red-500' : expiringSoon ? 'bg-orange-500' : doc.isVerified ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />

                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                          <Icon className={`h-6 w-6 ${config.color}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{config.label}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {doc.isVerified ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {expired && (
                              <Badge className="bg-red-100 text-red-800 border-red-300">
                                Expired
                              </Badge>
                            )}
                            {expiringSoon && !expired && (
                              <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                                Expiring Soon
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEdit(doc.id)}
                            variant="outline"
                            size="sm"
                            className="border-gray-300"
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteClick(doc.id)}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Document Details */}
                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`number-${doc.id}`}>
                              {config.numberLabel}{showIdentityFields ? ' *' : ''}
                            </Label>
                            <Input
                              id={`number-${doc.id}`}
                              value={doc.number}
                              onChange={(e) => updateIdentityDocument(doc.id, { number: e.target.value })}
                              placeholder={config.placeholder}
                            />
                          </div>

                          {showIdentityFields && (
                            <div className="space-y-2">
                              <Label htmlFor={`country-${doc.id}`}>Country of Issue *</Label>
                              <Input
                                id={`country-${doc.id}`}
                                value={doc.countryOfIssue}
                                onChange={(e) => updateIdentityDocument(doc.id, { countryOfIssue: e.target.value })}
                                placeholder="e.g., South Africa"
                              />
                            </div>
                          )}

                          {showIdentityFields && (
                            <div className="space-y-2">
                              <Label htmlFor={`expiry-${doc.id}`}>Expiry Date</Label>
                              <Input
                                id={`expiry-${doc.id}`}
                                type="date"
                                value={doc.expiryDate}
                                onChange={(e) => updateIdentityDocument(doc.id, { expiryDate: e.target.value })}
                              />
                            </div>
                          )}

                          <div className={showIdentityFields ? 'space-y-2' : 'space-y-2 md:col-span-2'}>
                            <Label htmlFor={`file-${doc.id}`}>Upload Document</Label>
                            <div className="flex gap-2">
                              <Input
                                id={`file-${doc.id}`}
                                type="file"
                                onChange={(e) => handleFileChange(doc.id, e)}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="flex-1"
                              />
                            </div>
                            {doc.fileName && (
                              <p className="text-xs text-gray-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                {doc.fileName}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleSave(doc.id)}
                            className="bg-[#6d28d9] hover:bg-[#5b21b6]"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button
                            onClick={() => handleCancel(doc.id)}
                            variant="outline"
                            className="border-gray-300"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="space-y-3">
                        {/* Document Fields */}
                        <div className={`grid grid-cols-1 ${showIdentityFields ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                          {(showIdentityFields || doc.number) && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <IdCard className="h-4 w-4 text-gray-400" />
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{config.numberLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 flex-1 break-all">
                                {doc.number || <span className="text-gray-400 italic">Not provided</span>}
                              </p>
                              {doc.number && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(doc.number, 'Document Number')}
                                  className="h-7 w-7 p-0 hover:bg-gray-50 flex-shrink-0"
                                >
                                  <Copy className="h-3.5 w-3.5 text-gray-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                          )}

                          {showIdentityFields && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Country of Issue</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 flex-1">
                                  {doc.countryOfIssue || <span className="text-gray-400 italic">Not provided</span>}
                                </p>
                                {doc.countryOfIssue && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyToClipboard(doc.countryOfIssue, 'Country of Issue')}
                                    className="h-7 w-7 p-0 hover:bg-gray-50 flex-shrink-0"
                                  >
                                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {showIdentityFields && (
                            <div className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry Date</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium flex-1 ${
                                  expired ? 'text-red-600' : expiringSoon ? 'text-orange-600' : 'text-gray-900'
                                }`}>
                                  {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString('en-ZA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : <span className="text-gray-400 italic">Not provided</span>}
                                </p>
                                {doc.expiryDate && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyToClipboard(doc.expiryDate, 'Expiry Date')}
                                    className="h-7 w-7 p-0 hover:bg-gray-50 flex-shrink-0"
                                  >
                                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Uploaded Document */}
                        {doc.fileName && (
                          <div className="bg-white border-2 border-[#6d28d9]/20 rounded-lg p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="h-10 w-10 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-5 w-5 text-[#6d28d9]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Uploaded Document</p>
                                  <p className="text-sm font-medium text-gray-900 truncate" title={doc.fileName}>
                                    {doc.fileName}
                                  </p>
                                  {!doc.fileUrl && (
                                    <p className="text-xs text-orange-600 mt-1">
                                      ⚠ File not available for viewing. Please re-upload to enable preview.
                                    </p>
                                  )}
                                </div>
                              </div>
                              {doc.fileUrl && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleView(doc.fileUrl)}
                                    className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white"
                                  >
                                    <Eye className="h-4 w-4 mr-1.5" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload(doc.fileUrl, doc.fileName!)}
                                    className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white"
                                  >
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Download
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expiry Warning */}
                    {!isEditing && showIdentityFields && expiringSoon && !expired && (
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-sm text-orange-800">
                          This document expires on {new Date(doc.expiryDate).toLocaleDateString('en-ZA')}. Please update it soon.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isEditing && showIdentityFields && expired && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-sm text-red-800">
                          This document expired on {new Date(doc.expiryDate).toLocaleDateString('en-ZA')}. Please update immediately.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!identityDocToDelete} onOpenChange={(open) => !open && setIdentityDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KYC Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the KYC document from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIdentityDocToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
