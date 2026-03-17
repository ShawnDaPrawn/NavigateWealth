import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { Badge } from '../../ui/badge';
import { Textarea } from '../../ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog';
import { Briefcase, Plus, Edit2, Trash2, X, Check, Building2, Factory } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';

interface Employer {
  id: string;
  jobTitle: string;
  employerName: string;
  industry: string;
}

interface EmploymentSectionProps {
  profileData: Record<string, unknown>;
  employersInEditMode: Set<string>;
  selfEmployedInEditMode: boolean;
  employerToDelete: string | null;
  handleInputChange: (field: string, value: string | number | boolean) => void;
  addEmployer: () => void;
  editEmployer: (id: string) => void;
  saveEmployer: (id: string) => void;
  cancelEditEmployer: (id: string) => void;
  confirmDeleteEmployer: (id: string) => void;
  removeEmployer: () => void;
  updateEmployer: (id: string, updates: Partial<Employer>) => void;
  editSelfEmployed: () => void;
  saveSelfEmployed: () => void;
  cancelEditSelfEmployed: () => void;
  setEmployerToDelete: (value: string | null) => void;
  copyToClipboard?: (text: string, fieldName: string) => void;
}

export function EmploymentSection({
  profileData,
  employersInEditMode,
  selfEmployedInEditMode,
  employerToDelete,
  handleInputChange,
  addEmployer,
  editEmployer,
  saveEmployer,
  cancelEditEmployer,
  confirmDeleteEmployer,
  removeEmployer,
  updateEmployer,
  editSelfEmployed,
  saveSelfEmployed,
  cancelEditSelfEmployed,
  setEmployerToDelete,
}: EmploymentSectionProps) {
  const employers = (profileData.employers || []) as Employer[];

  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <CardTitle>Employment Information</CardTitle>
              <CardDescription>Client's work and income details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="employmentStatus">Employment Status</Label>
            <Select
              value={profileData.employmentStatus as string}
              onValueChange={(value) => handleInputChange('employmentStatus', value)}
            >
              <SelectTrigger id="employmentStatus" className="mt-1.5">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employed">Employed</SelectItem>
                <SelectItem value="self-employed">Self-Employed</SelectItem>
                <SelectItem value="unemployed">Unemployed</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employed Section */}
          {profileData.employmentStatus === 'employed' && (
            <div className="contents">
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Client's Employers</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {employers.length === 0
                        ? 'No employers added yet'
                        : `${employers.length} employer${employers.length !== 1 ? 's' : ''} on record`}
                    </p>
                  </div>
                  <Button
                    onClick={addEmployer}
                    size="sm"
                    disabled={employersInEditMode.size > 0}
                    className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
                    title={employersInEditMode.size > 0 ? "Please save the current employer before adding a new one" : "Add a new employer"}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Employer
                  </Button>
                </div>

                {employers.length === 0 ? (
                  <EmptyState
                    icon={emptyStateConfigs.employers.icon}
                    title={emptyStateConfigs.employers.title}
                    description={emptyStateConfigs.employers.description}
                    actionLabel={emptyStateConfigs.employers.actionLabel}
                    onAction={addEmployer}
                    iconColor={emptyStateConfigs.employers.iconColor}
                    iconBgColor={emptyStateConfigs.employers.iconBgColor}
                    buttonColor={emptyStateConfigs.employers.buttonColor}
                    buttonHoverColor={emptyStateConfigs.employers.buttonHoverColor}
                  />
                ) : (
                  <div className="space-y-4">
                    {employers.map((employer: Employer, index: number) => {
                      const isInEditMode = employersInEditMode.has(employer.id);
                      const isValid = employer.employerName && employer.jobTitle && employer.industry;
                      
                      return (
                        <div
                          key={employer.id}
                          className={`rounded-lg border-2 transition-all ${
                            isInEditMode
                              ? 'border-[#6d28d9] bg-white shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {/* Employer Card Header */}
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isInEditMode ? 'bg-[#6d28d9]/10' : 'bg-gray-100'
                              }`}>
                                <Building2 className={`h-5 w-5 ${isInEditMode ? 'text-[#6d28d9]' : 'text-gray-500'}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-sm font-medium text-gray-900 truncate">
                                    {employer.employerName || 'New Employer'}
                                  </h5>
                                  {index === 0 && !isInEditMode && employer.employerName && (
                                    <Badge variant="outline" className="text-[#6d28d9] border-[#6d28d9]/30 bg-[#6d28d9]/5 text-xs flex-shrink-0">
                                      Current
                                    </Badge>
                                  )}
                                </div>
                                {!isInEditMode && employer.jobTitle && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{employer.jobTitle}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 ml-3">
                              {!isInEditMode ? (
                                <div className="contents">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editEmployer(employer.id)}
                                    className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                                  >
                                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => confirmDeleteEmployer(employer.id)}
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="contents">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelEditEmployer(employer.id)}
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveEmployer(employer.id)}
                                    disabled={!isValid}
                                    className={`${
                                      !isValid
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                                    }`}
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Edit Mode Form */}
                          {isInEditMode && (
                            <div className="px-5 pb-5">
                              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                                <div>
                                  <Label htmlFor={`employer-name-${employer.id}`} className="text-sm font-medium">
                                    Employer Name <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id={`employer-name-${employer.id}`}
                                    value={employer.employerName}
                                    onChange={(e) => updateEmployer(employer.id, { employerName: e.target.value })}
                                    placeholder="e.g., Acme Corporation"
                                    className="mt-1.5 bg-white"
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor={`job-title-${employer.id}`} className="text-sm font-medium">
                                      Job Title <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                      id={`job-title-${employer.id}`}
                                      value={employer.jobTitle}
                                      onChange={(e) => updateEmployer(employer.id, { jobTitle: e.target.value })}
                                      placeholder="e.g., Senior Developer"
                                      className="mt-1.5 bg-white"
                                    />
                                  </div>

                                  <div>
                                    <Label htmlFor={`employer-industry-${employer.id}`} className="text-sm font-medium">
                                      Industry <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                      id={`employer-industry-${employer.id}`}
                                      value={employer.industry}
                                      onChange={(e) => updateEmployer(employer.id, { industry: e.target.value })}
                                      placeholder="e.g., Finance, Technology"
                                      className="mt-1.5 bg-white"
                                    />
                                  </div>
                                </div>

                                {!isValid && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <span className="inline-block h-1 w-1 rounded-full bg-amber-500" />
                                    All fields marked with * are required
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* View Mode Details */}
                          {!isInEditMode && (employer.industry || employer.jobTitle) && (
                            <div className="px-5 pb-4 pt-0">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm border-t border-gray-100 pt-3">
                                {employer.jobTitle && (
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium">Job Title</p>
                                    <p className="text-sm text-gray-900 mt-0.5">{employer.jobTitle}</p>
                                  </div>
                                )}
                                {employer.industry && (
                                  <div>
                                    <p className="text-xs text-gray-500 font-medium">Industry</p>
                                    <p className="text-sm text-gray-900 mt-0.5">{employer.industry}</p>
                                  </div>
                                )}
                              </div>
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

          {/* Self-Employed Section */}
          {profileData.employmentStatus === 'self-employed' && (
            <div className="contents">
              <Separator />
              <div className="space-y-4">
                <div className={`rounded-lg border-2 transition-all ${
                  selfEmployedInEditMode ? 'border-[#6d28d9] bg-white shadow-sm' : 'border-gray-200 bg-white'
                }`}>
                  {/* Self-Employed Card Header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selfEmployedInEditMode ? 'bg-[#6d28d9]/10' : 'bg-gray-100'
                      }`}>
                        <Factory className={`h-5 w-5 ${selfEmployedInEditMode ? 'text-[#6d28d9]' : 'text-gray-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {(profileData.selfEmployedCompanyName as string) || 'Self-Employment Details'}
                        </h4>
                        {(profileData.selfEmployedIndustry as string) && !selfEmployedInEditMode && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{profileData.selfEmployedIndustry as string}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-3">
                      {!selfEmployedInEditMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={editSelfEmployed}
                          className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      ) : (
                        <div className="contents">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditSelfEmployed}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={saveSelfEmployed}
                            disabled={!(profileData.selfEmployedIndustry as string) || !(profileData.selfEmployedDescription as string)}
                            className={`${
                              (!(profileData.selfEmployedIndustry as string) || !(profileData.selfEmployedDescription as string))
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Self-Employed Edit Form */}
                  {selfEmployedInEditMode && (
                    <div className="px-5 pb-5">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                        <div>
                          <Label htmlFor="selfEmployedCompanyName" className="text-sm font-medium">
                            Company / Business Name
                          </Label>
                          <Input
                            id="selfEmployedCompanyName"
                            value={profileData.selfEmployedCompanyName as string}
                            onChange={(e) => handleInputChange('selfEmployedCompanyName', e.target.value)}
                            placeholder="Optional — if applicable"
                            className="mt-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <Label htmlFor="selfEmployedIndustry" className="text-sm font-medium">
                            Industry of Operation <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="selfEmployedIndustry"
                            value={profileData.selfEmployedIndustry as string}
                            onChange={(e) => handleInputChange('selfEmployedIndustry', e.target.value)}
                            placeholder="e.g., Consulting, Retail, Construction"
                            className="mt-1.5 bg-white"
                          />
                        </div>

                        <div>
                          <Label htmlFor="selfEmployedDescription" className="text-sm font-medium">
                            Business Description <span className="text-red-500">*</span>
                          </Label>
                          <Textarea
                            id="selfEmployedDescription"
                            value={profileData.selfEmployedDescription as string}
                            onChange={(e) => handleInputChange('selfEmployedDescription', e.target.value)}
                            placeholder="Describe what your business does, services offered, or products sold..."
                            rows={4}
                            className="mt-1.5 bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">Provide a brief overview of business operations</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Self-Employed View Mode */}
                  {!selfEmployedInEditMode && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="border-t border-gray-100 pt-3 space-y-3">
                        {(profileData.selfEmployedDescription as string) && (
                          <div>
                            <p className="text-xs text-gray-500 font-medium">Business Description</p>
                            <p className="text-sm text-gray-900 mt-0.5">{profileData.selfEmployedDescription as string}</p>
                          </div>
                        )}
                        {!(profileData.selfEmployedDescription as string) && !(profileData.selfEmployedIndustry as string) && (
                          <p className="text-xs text-gray-400 italic">No details added yet — click Edit to add your self-employment information.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {profileData.additionalIncomeSources && (profileData.additionalIncomeSources as unknown[]).length > 0 && (
            <div className="contents">
              <Separator />
              <div>
                <h4 className="text-sm text-gray-700 mb-3">Additional Income Sources</h4>
                <p className="text-xs text-gray-500">{(profileData.additionalIncomeSources as unknown[]).length} source(s) added</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog for Employer */}
      <AlertDialog open={!!employerToDelete} onOpenChange={() => setEmployerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this employer? This action cannot be undone and all information about this employer will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeEmployer}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
