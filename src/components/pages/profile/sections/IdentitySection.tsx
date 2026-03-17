import React from 'react';
import type { ProfileData, IdentityDocument, IdentityDocumentType, HandleInputChange } from '../types';
import { CountrySelect } from '../CountrySelect';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Alert, AlertDescription } from '../../../ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../ui/alert-dialog';
import {
  Shield, Plus, Edit2, Trash2, CheckCircle, Upload, FileText, CreditCard, IdCard,
  Info, X, Check,
} from 'lucide-react';

interface IdentitySectionProps {
  profileData: ProfileData;
  identityDocsInEditMode: Set<string>;
  identityDocToDelete: string | null;
  setIdentityDocToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  hasDocumentType: (type: IdentityDocumentType) => boolean;
  addIdentityDocument: (type: IdentityDocumentType) => void;
  updateIdentityDocument: (id: string, updates: Partial<IdentityDocument>) => void;
  saveIdentityDocument: (id: string) => void;
  editIdentityDocument: (id: string) => void;
  cancelEditIdentityDocument: (id: string) => void;
  confirmDeleteIdentityDocument: (id: string) => void;
  removeIdentityDocument: (id: string) => void;
  handleDocumentUpload: (id: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  getDocumentTypeLabel: (type: IdentityDocumentType) => string;
  getDocumentTypeIcon: (type: IdentityDocumentType) => { icon: React.ComponentType<{ className?: string }>; color: string };
}

export function IdentitySection({
  profileData,
  identityDocsInEditMode,
  identityDocToDelete,
  setIdentityDocToDelete,
  hasDocumentType,
  addIdentityDocument,
  updateIdentityDocument,
  saveIdentityDocument,
  editIdentityDocument,
  cancelEditIdentityDocument,
  confirmDeleteIdentityDocument,
  removeIdentityDocument,
  handleDocumentUpload,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
}: IdentitySectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#6d28d9]" />
              </div>
              <div>
                <CardTitle>Identity Verification</CardTitle>
                <CardDescription>Upload your identity documents</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addIdentityDocument('national-id')} variant="outline" size="sm" disabled={hasDocumentType('national-id') || identityDocsInEditMode.size > 0} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10 disabled:opacity-50 disabled:cursor-not-allowed" title={identityDocsInEditMode.size > 0 ? "Please save the current document before adding a new one" : hasDocumentType('national-id') ? "National ID already added" : "Add National ID"}>
                <Plus className="h-4 w-4 mr-1" />{hasDocumentType('national-id') ? 'ID Added' : 'Add National ID'}
              </Button>
              <Button onClick={() => addIdentityDocument('passport')} variant="outline" size="sm" disabled={hasDocumentType('passport') || identityDocsInEditMode.size > 0} className="border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed" title={identityDocsInEditMode.size > 0 ? "Please save the current document before adding a new one" : hasDocumentType('passport') ? "Passport already added" : "Add Passport"}>
                <Plus className="h-4 w-4 mr-1" />{hasDocumentType('passport') ? 'Passport Added' : 'Add Passport'}
              </Button>
              <Button onClick={() => addIdentityDocument('drivers-license')} variant="outline" size="sm" disabled={hasDocumentType('drivers-license') || identityDocsInEditMode.size > 0} className="border-amber-600 text-amber-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed" title={identityDocsInEditMode.size > 0 ? "Please save the current document before adding a new one" : hasDocumentType('drivers-license') ? "Driver's License already added" : "Add Driver's License"}>
                <Plus className="h-4 w-4 mr-1" />{hasDocumentType('drivers-license') ? 'License Added' : 'Add License'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              Please upload clear copies of your identity documents. Accepted formats: PDF, JPG, PNG (Max 5MB). You can add <strong>one document of each type</strong> (National ID, Passport, or Driver's License). Click "Add" buttons above to add documents, then "Save" to confirm each entry.
            </AlertDescription>
          </Alert>

          {profileData.identityDocuments.length === 0 ? (
            <EmptyState
              icon={emptyStateConfigs.identity.icon}
              title={emptyStateConfigs.identity.title}
              description={emptyStateConfigs.identity.description}
              actionLabel={emptyStateConfigs.identity.actionLabel}
              onAction={() => addIdentityDocument('national-id')}
              iconColor={emptyStateConfigs.identity.iconColor}
              iconBgColor={emptyStateConfigs.identity.iconBgColor}
              buttonColor={emptyStateConfigs.identity.buttonColor}
              buttonHoverColor={emptyStateConfigs.identity.buttonHoverColor}
            />
          ) : (
            <div className="space-y-4">
              {profileData.identityDocuments.map((doc) => {
                const isInEditMode = identityDocsInEditMode.has(doc.id);
                const iconData = getDocumentTypeIcon(doc.type);
                const IconComponent = iconData.icon;
                const colorClasses = {
                  purple: { bg: 'bg-purple-100', text: 'text-[#6d28d9]', border: 'border-[#6d28d9]', hover: 'hover:bg-[#6d28d9]/10' },
                  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-600', hover: 'hover:bg-blue-50' },
                  amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-600', hover: 'hover:bg-amber-50' },
                }[iconData.color] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-600', hover: 'hover:bg-gray-50' };
                
                const isValid = doc.type === 'national-id' ? (doc.number && doc.fileName) : true;

                return (
                  <div key={doc.id} className={`p-5 rounded-lg border-2 ${isInEditMode ? `${colorClasses.border} bg-white` : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${colorClasses.bg} flex items-center justify-center`}>
                          <IconComponent className={`h-5 w-5 ${colorClasses.text}`} />
                        </div>
                        <div>
                          <h4 className="text-gray-900">{getDocumentTypeLabel(doc.type)}</h4>
                          {doc.number && !isInEditMode && (<p className="text-xs text-gray-600">ID: {doc.number}</p>)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.isVerified && (
                          <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                        )}
                        {!isInEditMode ? (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => editIdentityDocument(doc.id)} className={`${colorClasses.border} ${colorClasses.text} ${colorClasses.hover}`}><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => confirmDeleteIdentityDocument(doc.id)} className="border-red-600 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => cancelEditIdentityDocument(doc.id)} className="border-gray-300 text-gray-700 hover:bg-gray-50"><X className="h-4 w-4 mr-1" />Cancel</Button>
                            <Button variant="outline" size="sm" onClick={() => saveIdentityDocument(doc.id)} disabled={!isValid} className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}><Check className="h-4 w-4 mr-1" />Save</Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isInEditMode ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>{doc.type === 'national-id' ? 'ID Number *' : doc.type === 'passport' ? 'Passport Number' : 'License Number'}</Label>
                            <Input value={doc.number} onChange={(e) => updateIdentityDocument(doc.id, { number: e.target.value })} placeholder={`Enter ${doc.type === 'national-id' ? 'ID' : doc.type === 'passport' ? 'passport' : 'license'} number`} className="mt-1.5" />
                          </div>
                          <div>
                            <Label>Country of Issue</Label>
                            <CountrySelect value={doc.countryOfIssue} onValueChange={(value) => updateIdentityDocument(doc.id, { countryOfIssue: value })} className="mt-1.5" />
                          </div>
                          {doc.type === 'passport' && (
                            <div>
                              <Label>Expiry Date</Label>
                              <Input type="date" value={doc.expiryDate} onChange={(e) => updateIdentityDocument(doc.id, { expiryDate: e.target.value })} className="mt-1.5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <Label>Upload Document {doc.type === 'national-id' && '*'}</Label>
                          <div className="mt-1.5">
                            {doc.fileName ? (
                              <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-green-200 bg-green-50">
                                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-100"><CheckCircle className="h-6 w-6 text-green-600" /></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-900 truncate">{doc.fileName}</p>
                                  <p className="text-xs text-gray-600">{((doc.fileSize || 0) / 1024).toFixed(0)} KB • Uploaded {new Date(doc.uploadDate || '').toLocaleDateString('en-ZA')}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => updateIdentityDocument(doc.id, { fileName: undefined, fileSize: undefined, uploadDate: undefined })} className="flex-shrink-0 border-red-600 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4 mr-1" />Remove</Button>
                              </div>
                            ) : (
                              <label className={`flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-gray-300 hover:${colorClasses.border} bg-gray-50 ${colorClasses.hover} cursor-pointer transition-all`}>
                                <Upload className="h-8 w-8 text-gray-400" />
                                <div className="text-center">
                                  <p className="text-sm text-gray-700">Click to upload {getDocumentTypeLabel(doc.type).toLowerCase()}</p>
                                  <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max 5MB)</p>
                                </div>
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleDocumentUpload(doc.id, e)} />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Country of Issue</p>
                            <p className="text-gray-900 text-[13px]">{doc.countryOfIssue || '-'}</p>
                          </div>
                          {doc.type === 'passport' && doc.expiryDate && (
                            <div>
                              <p className="text-gray-600">Expiry Date</p>
                              <p className="text-gray-900 text-[13px]">{new Date(doc.expiryDate).toLocaleDateString('en-ZA')}</p>
                            </div>
                          )}
                        </div>
                        {doc.fileName && (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <FileText className={`h-8 w-8 ${colorClasses.text}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">{doc.fileName}</p>
                              <p className="text-xs text-gray-600">{((doc.fileSize || 0) / 1024).toFixed(0)} KB • Uploaded {new Date(doc.uploadDate || '').toLocaleDateString('en-ZA')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog for Identity Documents */}
      <AlertDialog open={identityDocToDelete !== null} onOpenChange={() => setIdentityDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Identity Document</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this identity document? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => identityDocToDelete && removeIdentityDocument(identityDocToDelete)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
