import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Mail, 
  ToggleLeft, 
  ToggleRight, 
  Edit, 
  Loader2,
  Bell,
  Megaphone
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { GlobalFooterEditor } from './GlobalFooterEditor';
import { communicationApi } from '../api';
import { EmailTemplate } from '../types';
import { toast } from 'sonner@2.0.3';

interface TransactionalEmailsManagerProps {
  onBack: () => void;
}

export function TransactionalEmailsManager({ onBack }: TransactionalEmailsManagerProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isEditingFooter, setIsEditingFooter] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await communicationApi.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load email templates');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    // Optimistic update
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled: newEnabled } : t));
    
    try {
      await communicationApi.toggleTemplate(id, newEnabled);
      toast.success(`Email type ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      // Revert on error
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, enabled: currentEnabled } : t));
      toast.error('Failed to update setting');
    }
  };

  const generalTemplate = templates.find(t => t.id === 'general_campaign');
  const systemTemplates = templates.filter(t => t.id !== 'general_campaign');

  if (isEditingFooter) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <GlobalFooterEditor onBack={() => setIsEditingFooter(false)} />
      </div>
    );
  }

  if (editingTemplateId) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <EmailTemplateEditor 
          templateId={editingTemplateId} 
          onBack={() => {
            setEditingTemplateId(null);
            loadTemplates(); // Reload to get updates
          }} 
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Communication
          </Button>
        </div>
        <div className="flex items-center justify-between border-b pb-6 mt-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Email Settings & Templates</h2>
            <p className="text-muted-foreground mt-1">
              Manage system notifications and general communication templates
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsEditingFooter(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Global Footer Settings
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 border rounded-lg bg-gray-50/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* General Communication Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">General Communication</h3>
            </div>
            <div className="grid grid-cols-1">
              {generalTemplate && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:border-primary/50 transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{generalTemplate.name}</h4>
                      <p className="text-sm text-muted-foreground">Base template for marketing campaigns and bulk emails</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <Button variant="outline" size="sm" onClick={() => setEditingTemplateId(generalTemplate.id)}>
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Manage Template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* System Notifications Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">System Notifications</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {systemTemplates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:border-primary/50 transition-colors shadow-sm group">
                  <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      template.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium truncate ${template.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {template.name}
                        </h4>
                         {!template.enabled && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-500">Disabled</Badge>
                         )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={!!template.enabled} 
                        onCheckedChange={() => handleToggle(template.id, template.enabled)}
                        id={`toggle-${template.id}`}
                      />
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingTemplateId(template.id)}
                        className="text-muted-foreground hover:text-primary"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
