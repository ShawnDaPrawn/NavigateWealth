import React from 'react';
import type { ProfileData, FamilyMember, HandleInputChange } from '../types';
import { EmptyState } from '../EmptyState';
import { emptyStateConfigs } from '../emptyStateConfigs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Checkbox } from '../../../ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../ui/alert-dialog';
import { Users, User, Plus, Edit2, Trash2, X, Check } from 'lucide-react';

interface FamilySectionProps {
  profileData: ProfileData;
  familyMembersInEditMode: Set<string>;
  familyMemberToDelete: string | null;
  setFamilyMemberToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  addFamilyMember: () => void;
  updateFamilyMember: (id: string, updates: Partial<FamilyMember>) => void;
  saveFamilyMember: (id: string) => void;
  editFamilyMember: (id: string) => void;
  cancelEditFamilyMember: (id: string) => void;
  confirmDeleteFamilyMember: (id: string) => void;
  removeFamilyMember: (id: string) => void;
}

export function FamilySection({
  profileData,
  familyMembersInEditMode, familyMemberToDelete, setFamilyMemberToDelete,
  addFamilyMember, updateFamilyMember, saveFamilyMember,
  editFamilyMember, cancelEditFamilyMember, confirmDeleteFamilyMember, removeFamilyMember,
}: FamilySectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center"><Users className="h-5 w-5 text-[#6d28d9]" /></div>
              <div><CardTitle>Family Members</CardTitle><CardDescription>Your family and dependents</CardDescription></div>
            </div>
            <Button onClick={addFamilyMember} size="sm" disabled={familyMembersInEditMode.size > 0} className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed" title={familyMembersInEditMode.size > 0 ? "Please save the current family member before adding a new one" : "Add a new family member"}>
              <Plus className="h-4 w-4 mr-1" />Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profileData.familyMembers.length === 0 ? (
            <EmptyState icon={emptyStateConfigs.family.icon} title={emptyStateConfigs.family.title} description={emptyStateConfigs.family.description} actionLabel={emptyStateConfigs.family.actionLabel} onAction={addFamilyMember} iconColor={emptyStateConfigs.family.iconColor} iconBgColor={emptyStateConfigs.family.iconBgColor} buttonColor={emptyStateConfigs.family.buttonColor} buttonHoverColor={emptyStateConfigs.family.buttonHoverColor} />
          ) : (
            <div className="space-y-4">
              {profileData.familyMembers.map((member, index) => {
                const isInEditMode = familyMembersInEditMode.has(member.id);
                const isValid = member.fullName && member.relationship;
                return (
                  <div key={member.id} className={`p-5 rounded-lg border-2 ${isInEditMode ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><User className="h-5 w-5 text-[#6d28d9]" /></div>
                        <div>
                          <p className="text-gray-900">{member.fullName || `Family Member ${index + 1}`}</p>
                          {member.relationship && !isInEditMode && (<p className="text-sm text-gray-600 capitalize">{member.relationship}</p>)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isInEditMode ? (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => editFamilyMember(member.id)} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"><Edit2 className="h-4 w-4 mr-1" />Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => confirmDeleteFamilyMember(member.id)} className="border-red-600 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="contents">
                            <Button variant="outline" size="sm" onClick={() => cancelEditFamilyMember(member.id)} className="border-gray-300 text-gray-700 hover:bg-gray-50"><X className="h-4 w-4 mr-1" />Cancel</Button>
                            <Button variant="outline" size="sm" onClick={() => saveFamilyMember(member.id)} disabled={!isValid} className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}><Check className="h-4 w-4 mr-1" />Save</Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isInEditMode ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><Label htmlFor={`name-${member.id}`}>Full Name *</Label><Input id={`name-${member.id}`} value={member.fullName} onChange={(e) => updateFamilyMember(member.id, { fullName: e.target.value })} placeholder="Enter full name" className="mt-1.5" /></div>
                        <div>
                          <Label htmlFor={`relationship-${member.id}`}>Relationship *</Label>
                          <Select value={member.relationship} onValueChange={(value) => updateFamilyMember(member.id, { relationship: value })}>
                            <SelectTrigger id={`relationship-${member.id}`} className="mt-1.5"><SelectValue placeholder="Select relationship" /></SelectTrigger>
                            <SelectContent><SelectItem value="spouse">Spouse</SelectItem><SelectItem value="child">Child</SelectItem><SelectItem value="parent">Parent</SelectItem><SelectItem value="sibling">Sibling</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div><Label htmlFor={`dob-${member.id}`}>Date of Birth</Label><Input id={`dob-${member.id}`} type="date" value={member.dateOfBirth} onChange={(e) => updateFamilyMember(member.id, { dateOfBirth: e.target.value })} className="mt-1.5" /></div>
                        <div>
                          <Label htmlFor={`gender-${member.id}`}>Gender</Label>
                          <Select value={member.gender} onValueChange={(value) => updateFamilyMember(member.id, { gender: value })}>
                            <SelectTrigger id={`gender-${member.id}`} className="mt-1.5"><SelectValue placeholder="Select gender" /></SelectTrigger>
                            <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div><Label htmlFor={`id-${member.id}`}>ID/Passport Number</Label><Input id={`id-${member.id}`} value={member.idPassportNumber} onChange={(e) => updateFamilyMember(member.id, { idPassportNumber: e.target.value })} placeholder="Enter ID or passport number" className="mt-1.5" /></div>
                        <div className="sm:col-span-2 flex items-center space-x-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
                          <Checkbox id={`dependent-${member.id}`} checked={member.isFinanciallyDependent} onCheckedChange={(checked) => updateFamilyMember(member.id, { isFinanciallyDependent: checked as boolean })} />
                          <Label htmlFor={`dependent-${member.id}`} className="text-sm cursor-pointer">Financially dependent</Label>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          {member.dateOfBirth && (<div><p className="text-gray-600">Date of Birth</p><p className="text-gray-900 text-[12px]">{new Date(member.dateOfBirth).toLocaleDateString()}</p></div>)}
                          {member.gender && (<div><p className="text-gray-600">Gender</p><p className="text-gray-900 capitalize text-[12px]">{member.gender}</p></div>)}
                          {member.idPassportNumber && (<div><p className="text-gray-600">ID/Passport Number</p><p className="text-gray-900 text-[12px]">{member.idPassportNumber}</p></div>)}
                          <div><p className="text-gray-600">Dependency Status</p><p className="text-gray-900 text-[12px]">{member.isFinanciallyDependent ? 'Financially Dependent' : 'Independent'}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={familyMemberToDelete !== null} onOpenChange={() => setFamilyMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Family Member</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this family member? This action cannot be undone and all information about this family member will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setFamilyMemberToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => familyMemberToDelete && removeFamilyMember(familyMemberToDelete)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
