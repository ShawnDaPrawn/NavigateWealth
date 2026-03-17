import React from 'react';
import type { ProfileData, HandleInputChange } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Separator } from '../../../ui/separator';
import { Mail, AlertCircle } from 'lucide-react';

interface ContactDetailsSectionProps {
  profileData: ProfileData;
  handleInputChange: HandleInputChange;
}

export function ContactDetailsSection({ profileData, handleInputChange }: ContactDetailsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Mail className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>How we can reach you</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="email">Primary Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="your@email.com"
              className="mt-1.5"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="secondaryEmail">Secondary Email Address</Label>
            <Input
              id="secondaryEmail"
              type="email"
              value={profileData.secondaryEmail}
              onChange={(e) => handleInputChange('secondaryEmail', e.target.value)}
              placeholder="alternative@email.com"
              className="mt-1.5"
            />
            <p className="text-xs text-gray-500 mt-1">Optional - for alternative communication</p>
          </div>

          <div>
            <Label htmlFor="phoneNumber">Primary Phone *</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={profileData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              placeholder="+27 XX XXX XXXX"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="alternativePhone">Alternative Phone</Label>
            <Input
              id="alternativePhone"
              type="tel"
              value={profileData.alternativePhone}
              onChange={(e) => handleInputChange('alternativePhone', e.target.value)}
              placeholder="+27 XX XXX XXXX"
              className="mt-1.5"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="preferredContactMethod">Preferred Contact Method</Label>
            <Select
              value={profileData.preferredContactMethod}
              onValueChange={(value) => handleInputChange('preferredContactMethod', value)}
            >
              <SelectTrigger id="preferredContactMethod" className="mt-1.5">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm text-gray-900">Emergency Contact</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContactName">Name</Label>
              <Input
                id="emergencyContactName"
                value={profileData.emergencyContactName}
                onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                placeholder="Enter name"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContactRelationship">Relationship</Label>
              <Input
                id="emergencyContactRelationship"
                value={profileData.emergencyContactRelationship}
                onChange={(e) => handleInputChange('emergencyContactRelationship', e.target.value)}
                placeholder="e.g., Spouse, Parent"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContactPhone">Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={profileData.emergencyContactPhone}
                onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                placeholder="+27 XX XXX XXXX"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="emergencyContactEmail">Email</Label>
              <Input
                id="emergencyContactEmail"
                type="email"
                value={profileData.emergencyContactEmail}
                onChange={(e) => handleInputChange('emergencyContactEmail', e.target.value)}
                placeholder="email@example.com"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
