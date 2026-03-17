import React from 'react';
import type { ProfileData, HandleInputChange } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Button } from '../../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Separator } from '../../../ui/separator';
import { MapPin, Home, Briefcase, Upload, Edit2, Trash2, CheckCircle, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../ui/alert-dialog';

interface AddressSectionProps {
  profileData: ProfileData;
  handleInputChange: HandleInputChange;
  proofOfResidenceInEditMode: boolean;
  proofOfResidenceToDelete: boolean;
  setProofOfResidenceToDelete: React.Dispatch<React.SetStateAction<boolean>>;
  handleProofOfResidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  editProofOfResidence: () => void;
  saveProofOfResidence: () => void;
  confirmDeleteProofOfResidence: () => void;
  removeProofOfResidence: () => void;
}

export function AddressSection({
  profileData,
  handleInputChange,
  proofOfResidenceInEditMode,
  proofOfResidenceToDelete,
  setProofOfResidenceToDelete,
  handleProofOfResidenceUpload,
  editProofOfResidence,
  saveProofOfResidence,
  confirmDeleteProofOfResidence,
  removeProofOfResidence,
}: AddressSectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <CardTitle>Address Information</CardTitle>
              <CardDescription>Your residential address details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-[#6d28d9]" />
              <h4 className="text-sm text-gray-900">Residential Address</h4>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="residentialAddressLine1">Address Line 1 *</Label>
                <Input id="residentialAddressLine1" value={profileData.residentialAddressLine1} onChange={(e) => handleInputChange('residentialAddressLine1', e.target.value)} placeholder="Street address" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="residentialAddressLine2">Address Line 2</Label>
                <Input id="residentialAddressLine2" value={profileData.residentialAddressLine2} onChange={(e) => handleInputChange('residentialAddressLine2', e.target.value)} placeholder="Apartment, suite, unit, etc." className="mt-1.5" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="residentialSuburb">Suburb</Label>
                  <Input id="residentialSuburb" value={profileData.residentialSuburb} onChange={(e) => handleInputChange('residentialSuburb', e.target.value)} placeholder="Enter suburb" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="residentialCity">City *</Label>
                  <Input id="residentialCity" value={profileData.residentialCity} onChange={(e) => handleInputChange('residentialCity', e.target.value)} placeholder="Enter city" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="residentialProvince">Province</Label>
                  <Select value={profileData.residentialProvince} onValueChange={(value) => handleInputChange('residentialProvince', value)}>
                    <SelectTrigger id="residentialProvince" className="mt-1.5"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eastern-cape">Eastern Cape</SelectItem>
                      <SelectItem value="free-state">Free State</SelectItem>
                      <SelectItem value="gauteng">Gauteng</SelectItem>
                      <SelectItem value="kwazulu-natal">KwaZulu-Natal</SelectItem>
                      <SelectItem value="limpopo">Limpopo</SelectItem>
                      <SelectItem value="mpumalanga">Mpumalanga</SelectItem>
                      <SelectItem value="north-west">North West</SelectItem>
                      <SelectItem value="northern-cape">Northern Cape</SelectItem>
                      <SelectItem value="western-cape">Western Cape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="residentialPostalCode">Postal Code</Label>
                  <Input id="residentialPostalCode" value={profileData.residentialPostalCode} onChange={(e) => handleInputChange('residentialPostalCode', e.target.value)} placeholder="Enter postal code" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="residentialCountry">Country</Label>
                <Input id="residentialCountry" value={profileData.residentialCountry} onChange={(e) => handleInputChange('residentialCountry', e.target.value)} placeholder="Enter country" className="mt-1.5" />
              </div>
            </div>

            {/* Proof of Residence Upload */}
            <div className="pt-4">
              <Label>Proof of Residence</Label>
              <p className="text-xs text-gray-500 mb-2">Upload a utility bill, bank statement, or lease agreement</p>
              
              {profileData.proofOfResidenceUploaded && !proofOfResidenceInEditMode ? (
                <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">{profileData.proofOfResidenceFileName || 'Proof of Residence'}</p>
                        <p className="text-xs text-gray-600">Document uploaded successfully</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={editProofOfResidence} className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10">
                        <Edit2 className="h-4 w-4 mr-1" />Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={confirmDeleteProofOfResidence} className="border-red-600 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#6d28d9] bg-gray-50 hover:bg-[#6d28d9]/5 cursor-pointer transition-all">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm text-gray-700">Click to upload proof of residence</p>
                      <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleProofOfResidenceUpload} />
                  </label>
                  {proofOfResidenceInEditMode && (
                    <Button variant="outline" size="sm" onClick={saveProofOfResidence} className="w-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] border-[#6d28d9]">
                      <Check className="h-4 w-4 mr-1" />Save Changes
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Work Address */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#6d28d9]" />
              <h4 className="text-sm text-gray-900">Work Address</h4>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="workAddressLine1">Address Line 1</Label>
                <Input id="workAddressLine1" value={profileData.workAddressLine1} onChange={(e) => handleInputChange('workAddressLine1', e.target.value)} placeholder="Street address" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="workAddressLine2">Address Line 2</Label>
                <Input id="workAddressLine2" value={profileData.workAddressLine2} onChange={(e) => handleInputChange('workAddressLine2', e.target.value)} placeholder="Apartment, suite, unit, etc." className="mt-1.5" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workSuburb">Suburb</Label>
                  <Input id="workSuburb" value={profileData.workSuburb} onChange={(e) => handleInputChange('workSuburb', e.target.value)} placeholder="Enter suburb" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="workCity">City</Label>
                  <Input id="workCity" value={profileData.workCity} onChange={(e) => handleInputChange('workCity', e.target.value)} placeholder="Enter city" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="workProvince">Province</Label>
                  <Select value={profileData.workProvince} onValueChange={(value) => handleInputChange('workProvince', value)}>
                    <SelectTrigger id="workProvince" className="mt-1.5"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eastern-cape">Eastern Cape</SelectItem>
                      <SelectItem value="free-state">Free State</SelectItem>
                      <SelectItem value="gauteng">Gauteng</SelectItem>
                      <SelectItem value="kwazulu-natal">KwaZulu-Natal</SelectItem>
                      <SelectItem value="limpopo">Limpopo</SelectItem>
                      <SelectItem value="mpumalanga">Mpumalanga</SelectItem>
                      <SelectItem value="north-west">North West</SelectItem>
                      <SelectItem value="northern-cape">Northern Cape</SelectItem>
                      <SelectItem value="western-cape">Western Cape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="workPostalCode">Postal Code</Label>
                  <Input id="workPostalCode" value={profileData.workPostalCode} onChange={(e) => handleInputChange('workPostalCode', e.target.value)} placeholder="Enter postal code" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="workCountry">Country</Label>
                <Input id="workCountry" value={profileData.workCountry} onChange={(e) => handleInputChange('workCountry', e.target.value)} placeholder="Enter country" className="mt-1.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={proofOfResidenceToDelete} onOpenChange={() => setProofOfResidenceToDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proof of Residence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your proof of residence document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProofOfResidenceToDelete(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeProofOfResidence} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}