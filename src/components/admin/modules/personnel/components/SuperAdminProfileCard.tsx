import React, { useState } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Badge } from '../../../../ui/badge';
import { Avatar, AvatarFallback } from '../../../../ui/avatar';
import { Skeleton } from '../../../../ui/skeleton';
import { Shield, Edit2, Save, X, Mail, Phone, User, Loader2 } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { SuperAdminProfile } from '../types';

interface SuperAdminProfileCardProps {
  profile: SuperAdminProfile | null;
  loading: boolean;
  onUpdate: (updates: Partial<SuperAdminProfile>) => Promise<boolean>;
}

export function SuperAdminProfileCard({ profile, loading, onUpdate }: SuperAdminProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<SuperAdminProfile>>({});
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    if (profile) {
      setEditedProfile({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        phone: profile.phone || '',
      });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditedProfile({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdate({
      firstName: editedProfile.firstName,
      lastName: editedProfile.lastName,
      phone: editedProfile.phone,
    });
    setSaving(false);
    if (success) {
      setIsEditing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-200/60 bg-gradient-to-r from-purple-50/60 to-white shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border-purple-200/60 bg-gradient-to-r from-purple-50/60 to-white shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="h-5 w-5 text-purple-400" />
            <p className="text-sm">Unable to load super admin profile. Please check your permissions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayFirstName = profile.firstName || 'Super';
  const displayLastName = profile.lastName || 'Admin';
  const displayPhone = profile.phone || 'Not set';
  const initials = `${displayFirstName[0] || 'S'}${displayLastName[0] || 'A'}`.toUpperCase();

  return (
    <Card className="border-purple-200/60 bg-gradient-to-r from-purple-50/60 to-white shadow-none overflow-hidden">
      <CardContent className="p-5">
        {!isEditing ? (
          <div className="flex items-center justify-between gap-6">
            {/* Left: Avatar + Info */}
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-12 w-12 ring-2 ring-purple-200 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-800 text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900">
                    {displayFirstName} {displayLastName}
                  </h3>
                  <Badge className="bg-purple-600 hover:bg-purple-700 text-[10px] px-1.5 py-0 h-5">
                    Super Admin
                  </Badge>
                  <Badge variant="outline" className="border-green-400 text-green-700 text-[10px] px-1.5 py-0 h-5">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                    {profile.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                    {displayPhone}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Edit */}
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-shrink-0 border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-900">Edit Super Admin Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sa-firstName" className="text-xs">
                  First Name
                </Label>
                <Input
                  id="sa-firstName"
                  value={editedProfile.firstName || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, firstName: e.target.value })
                  }
                  placeholder="Enter first name"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sa-lastName" className="text-xs">
                  Last Name
                </Label>
                <Input
                  id="sa-lastName"
                  value={editedProfile.lastName || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, lastName: e.target.value })
                  }
                  placeholder="Enter last name"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sa-phone" className="text-xs">
                  Phone Number
                </Label>
                <Input
                  id="sa-phone"
                  value={editedProfile.phone || ''}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, phone: e.target.value })
                  }
                  placeholder="+27..."
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-purple-100">
              <Button
                onClick={handleCancel}
                variant="ghost"
                size="sm"
                disabled={saving}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                disabled={saving}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700"
              >
                {saving ? (
                  <div className="contents">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="contents">
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}