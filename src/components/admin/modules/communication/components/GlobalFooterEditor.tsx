import React, { useState, useEffect } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Separator } from '../../../../ui/separator';
import { Loader2, ArrowLeft, Save, Globe, Mail, Phone, MapPin, Building } from 'lucide-react';
import { communicationApi } from '../api';
import { EmailFooterSettings } from '../types';
import { toast } from 'sonner@2.0.3';

interface GlobalFooterEditorProps {
  onBack: () => void;
}

const DEFAULT_SETTINGS: EmailFooterSettings = {
  companyName: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  socialLinks: {
    linkedin: '',
    instagram: '',
    youtube: '',
    facebook: '',
    twitter: ''
  },
  copyrightText: '© {{Year}} Navigate Wealth. All rights reserved.'
};

export function GlobalFooterEditor({ onBack }: GlobalFooterEditorProps) {
  const [settings, setSettings] = useState<EmailFooterSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await communicationApi.getFooterSettings();
      // Convert HTML breaks to newlines for WYSIWYG editing
      if (data.address) {
        data.address = data.address.replace(/<br\s*\/?>/gi, '\n');
      }
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load footer settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert newlines to HTML breaks for storage/email rendering
      const settingsToSave = {
        ...settings,
        address: settings.address.replace(/\n/g, '<br />')
      };
      
      await communicationApi.saveFooterSettings(settingsToSave);
      toast.success('Footer settings saved successfully');
    } catch (error) {
      toast.error('Failed to save footer settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </div>
        <div className="flex items-end justify-between border-b pb-6 mt-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Global Email Footer</h2>
            <p className="text-muted-foreground mt-1">
              Manage the footer information displayed on all outgoing emails
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                Company Details
              </CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input 
                  value={settings.companyName} 
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  placeholder="e.g. Navigate Wealth"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Physical Address</Label>
                <Textarea 
                  value={settings.address} 
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Enter physical address (one line per row)"
                  className="min-h-[100px] text-sm"
                />
                <p className="text-xs text-muted-foreground">Enter the address exactly as you want it to appear. Line breaks will be preserved.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={settings.contactEmail} 
                      onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                   <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={settings.contactPhone} 
                      onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Copyright Text</Label>
                <Input 
                  value={settings.copyrightText} 
                  onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })}
                  placeholder="© {{Year}} Navigate Wealth. All rights reserved."
                />
                <p className="text-xs text-muted-foreground">Use <code>{'{{Year}}'}</code> to insert current year.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Social Media Links
              </CardTitle>
              <CardDescription>
                Links to your social media profiles. Leave empty to hide.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input 
                  value={settings.socialLinks?.linkedin || ''} 
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    socialLinks: { ...settings.socialLinks, linkedin: e.target.value } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram URL</Label>
                <Input 
                  value={settings.socialLinks?.instagram || ''} 
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    socialLinks: { ...settings.socialLinks, instagram: e.target.value } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>YouTube URL</Label>
                <Input 
                  value={settings.socialLinks?.youtube || ''} 
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    socialLinks: { ...settings.socialLinks, youtube: e.target.value } 
                  })}
                />
              </div>
               <div className="space-y-2">
                <Label>Facebook URL</Label>
                <Input 
                  value={settings.socialLinks?.facebook || ''} 
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    socialLinks: { ...settings.socialLinks, facebook: e.target.value } 
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Twitter / X URL</Label>
                <Input 
                  value={settings.socialLinks?.twitter || ''} 
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    socialLinks: { ...settings.socialLinks, twitter: e.target.value } 
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
