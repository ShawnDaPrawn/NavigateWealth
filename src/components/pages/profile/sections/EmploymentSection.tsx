import React from 'react';
import type { ProfileData, Employer, HandleInputChange } from '../types';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Textarea } from '../../../ui/textarea';
import { Separator } from '../../../ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../ui/alert-dialog';
import { Briefcase, Plus, Edit2, Trash2, X, Check } from 'lucide-react';

interface EmploymentSectionProps {
  profileData: ProfileData;
  handleInputChange: HandleInputChange;
  employersInEditMode: Set<string>;
  employerToDelete: string | null;
  setEmployerToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addEmployer: () => void;
  updateEmployer: (id: string, updates: Partial<Employer>) => void;
  saveEmployer: (id: string) => void;
  editEmployer: (id: string) => void;
  cancelEditEmployer: (id: string) => void;
  confirmDeleteEmployer: (id: string) => void;
  removeEmployer: (id: string) => void;
  selfEmployedInEditMode: boolean;
  editSelfEmployed: () => void;
  saveSelfEmployed: () => void;
  cancelEditSelfEmployed: () => void;
}

export function EmploymentSection({
  profileData, handleInputChange,
  employersInEditMode, employerToDelete, setEmployerToDelete,
  addEmployer, updateEmployer, saveEmployer, editEmployer, cancelEditEmployer, confirmDeleteEmployer, removeEmployer,
  selfEmployedInEditMode, editSelfEmployed, saveSelfEmployed, cancelEditSelfEmployed,
}: EmploymentSectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-[#6d28d9]" /></div>
            <div><CardTitle>Employment Information</CardTitle><CardDescription>Your work and income details</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select value={profileData.employmentStatus} onValueChange={(value) => handleInputChange('employmentStatus', value)}>
                <SelectTrigger id="employmentStatus" className="mt-1.5"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employed">Employed</SelectItem>
                  <SelectItem value="self-employed">Self-Employed</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {profileData.employmentStatus === 'employed' && (
            <div className="contents">
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><h4 className="text-sm text-gray-900">Your Employers</h4><p className="text-xs text-gray-500">Add all your current employers</p></div>
                  <Button onClick={addEmployer} size="sm" disabled={employersInEditMode.size > 0} className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed" title={employersInEditMode.size > 0 ? "Please save the current employer before adding a new one" : "Add a new employer"}>
                    <Plus className="h-4 w-4 mr-1" />Add Employer
                  </Button>
                </div>
                {profileData.employers.length === 0 ? (
                  <EmptyState icon={emptyStateConfigs.employers.icon} title={emptyStateConfigs.employers.title} description={emptyStateConfigs.employers.description} actionLabel={emptyStateConfigs.employers.actionLabel} onAction={addEmployer} iconColor={emptyStateConfigs.employers.iconColor} iconBgColor={emptyStateConfigs.employers.iconBgColor} buttonColor={emptyStateConfigs.employers.buttonColor} buttonHoverColor={emptyStateConfigs.employers.buttonHoverColor} />
                ) : (
                  <div className="space-y-4">
                    {profileData.employers.map((employer) => {
                      const isInEditMode = employersInEditMode.has(employer.id);
                      const isValid = employer.employerName && employer.jobTitle && employer.industry;
                      return (
                        <div key={employer.id} className={`p-5 rounded-lg border-2 ${isInEditMode ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Briefcase className="h-5 w-5 text-[#6d28d9]" /></div>
                              <div><h5 className="text-gray-900">{employer.employerName || 'New Employer'}</h5>{employer.jobTitle && !isInEditMode && (<p className="text-xs text-gray-600">{employer.jobTitle}</p>)}</div>
                            </div>
                            <div className="flex gap-2">
                              {!isInEditMode ? (
                                <div className="contents">
                                  <Button variant="outline" size="sm" onClick={() => editEmployer(employer.id)} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                                  <Button variant="outline" size="sm" onClick={() => confirmDeleteEmployer(employer.id)} className="border-red-600 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              ) : (
                                <div className="contents">
                                  <Button variant="outline" size="sm" onClick={() => cancelEditEmployer(employer.id)} className="border-gray-300 text-gray-700 hover:bg-gray-50"><X className="h-4 w-4 mr-1" />Cancel</Button>
                                  <Button variant="outline" size="sm" onClick={() => saveEmployer(employer.id)} disabled={!isValid} className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}><Check className="h-4 w-4 mr-1" />Save</Button>
                                </div>
                              )}
                            </div>
                          </div>
                          {isInEditMode ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2"><Label htmlFor={`employer-name-${employer.id}`}>Employer Name *</Label><Input id={`employer-name-${employer.id}`} value={employer.employerName} onChange={(e) => updateEmployer(employer.id, { employerName: e.target.value })} placeholder="Company name" className="mt-1.5" /></div>
                              <div><Label htmlFor={`job-title-${employer.id}`}>Job Title *</Label><Input id={`job-title-${employer.id}`} value={employer.jobTitle} onChange={(e) => updateEmployer(employer.id, { jobTitle: e.target.value })} placeholder="Your job title" className="mt-1.5" /></div>
                              <div><Label htmlFor={`employer-industry-${employer.id}`}>Industry *</Label><Input id={`employer-industry-${employer.id}`} value={employer.industry} onChange={(e) => updateEmployer(employer.id, { industry: e.target.value })} placeholder="e.g., Finance, Technology" className="mt-1.5" /></div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div><p className="text-gray-600 text-[14px]">Industry</p><p className="text-gray-900">{employer.industry || '-'}</p></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {profileData.employmentStatus === 'self-employed' && (
            <div className="contents">
              <Separator />
              <div className="space-y-4">
                <div className={`p-5 rounded-lg border-2 ${selfEmployedInEditMode ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Briefcase className="h-5 w-5 text-[#6d28d9]" /></div>
                      <div><h4 className="text-gray-900">{profileData.selfEmployedCompanyName || 'Self-Employment Details'}</h4>{profileData.selfEmployedIndustry && !selfEmployedInEditMode && (<p className="text-xs text-gray-600">{profileData.selfEmployedIndustry}</p>)}</div>
                    </div>
                    {!selfEmployedInEditMode ? (
                      <Button variant="outline" size="sm" onClick={editSelfEmployed} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                    ) : (
                      <div className="contents">
                        <Button variant="outline" size="sm" onClick={cancelEditSelfEmployed} className="border-gray-300 text-gray-700 hover:bg-gray-50"><X className="h-4 w-4 mr-1" />Cancel</Button>
                        <Button variant="outline" size="sm" onClick={saveSelfEmployed} disabled={!profileData.selfEmployedIndustry || !profileData.selfEmployedDescription} className={`${(!profileData.selfEmployedIndustry || !profileData.selfEmployedDescription) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}><Check className="h-4 w-4 mr-1" />Save</Button>
                      </div>
                    )}
                  </div>
                  {selfEmployedInEditMode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><Label htmlFor="selfEmployedCompanyName">Company / Business Name</Label><Input id="selfEmployedCompanyName" value={profileData.selfEmployedCompanyName} onChange={(e) => handleInputChange('selfEmployedCompanyName', e.target.value)} placeholder="Optional - if applicable" className="mt-1.5" /></div>
                      <div className="sm:col-span-2"><Label htmlFor="selfEmployedIndustry">Industry of Operation *</Label><Input id="selfEmployedIndustry" value={profileData.selfEmployedIndustry} onChange={(e) => handleInputChange('selfEmployedIndustry', e.target.value)} placeholder="e.g., Consulting, Retail, Construction" className="mt-1.5" /></div>
                      <div className="sm:col-span-2"><Label htmlFor="selfEmployedDescription">Business Description *</Label><Textarea id="selfEmployedDescription" value={profileData.selfEmployedDescription} onChange={(e) => handleInputChange('selfEmployedDescription', e.target.value)} placeholder="Describe what your business does, services offered, or products sold..." rows={4} className="mt-1.5" /><p className="text-xs text-gray-500 mt-1">Provide a brief overview of your business operations</p></div>
                    </div>
                  ) : (
                    <div className="space-y-3"><div><p className="text-xs text-gray-600">Business Description</p><p className="text-sm text-gray-900 mt-1">{profileData.selfEmployedDescription || '-'}</p></div></div>
                  )}
                </div>
              </div>
            </div>
          )}

          {profileData.additionalIncomeSources.length > 0 && (
            <div className="contents">
              <Separator />
              <div><h4 className="text-sm text-gray-700 mb-3">Additional Income Sources</h4><p className="text-xs text-gray-500">{profileData.additionalIncomeSources.length} source(s) added</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={employerToDelete !== null} onOpenChange={() => setEmployerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Employer</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this employer entry? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => employerToDelete && removeEmployer(employerToDelete)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
