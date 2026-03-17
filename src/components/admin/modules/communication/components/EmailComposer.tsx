import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import DOMPurify from 'dompurify';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../ui/dialog';
import { Separator } from '../../../../ui/separator';
import { 
  Mail, 
  Paperclip, 
  FileText, 
  Send, 
  Eye, 
  Save, 
  X, 
  Plus,
  Upload,
  AlertCircle
} from 'lucide-react';
import { EmailTemplate, AttachmentFile } from '../types';
import { communicationApi } from '../api';

interface EmailComposerProps {
  fromAddresses: Array<{ id: string; name: string; email: string }>;
  selectedFrom: string;
  onFromChange: (fromId: string) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  bodyHtml: string;
  onBodyHtmlChange: (html: string) => void;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  selectedTemplate: string | null;
  onTemplateChange: (templateId: string | null) => void;
  onSend: () => void;
  onTestSend: () => void;
  disabled?: boolean;
}

// Default sender addresses — static configuration (Guidelines §5.3)
// TODO: Replace with backend settings endpoint when sender address management is implemented
const DEFAULT_FROM_ADDRESSES = [
  { id: '1', name: 'Navigate Wealth - General', email: 'info@navigatewealth.co.za' },
  { id: '2', name: 'Navigate Wealth - Support', email: 'support@navigatewealth.co.za' },
  { id: '3', name: 'Navigate Wealth - Advisory', email: 'advisory@navigatewealth.co.za' },
];

export function EmailComposer({
  fromAddresses = DEFAULT_FROM_ADDRESSES,
  selectedFrom,
  onFromChange,
  subject,
  onSubjectChange,
  bodyHtml,
  onBodyHtmlChange,
  attachments,
  onAttachmentsChange,
  selectedTemplate,
  onTemplateChange,
  onSend,
  onTestSend,
  disabled = false,
}: EmailComposerProps) {
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates from backend (replaces inline mockTemplates)
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  React.useEffect(() => {
    const fetchTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const fetched = await communicationApi.getAllTemplates();
        setTemplates(fetched);
      } catch (err) {
        console.error('EmailComposer: Failed to fetch templates', err);
      } finally {
        setTemplatesLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (template: EmailTemplate) => {
    onSubjectChange(template.subject);
    onBodyHtmlChange(template.bodyHtml);
    onTemplateChange(template.id);
    setShowTemplateDialog(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    
    Array.from(files).forEach((file) => {
      // In real implementation, you'd upload to storage and get back the path
      const attachment: AttachmentFile = {
        id: Math.random().toString(36).substring(7), // Generate a temp ID
        name: file.name,
        path: `storage://uploads/${file.name}`, // Mock path
        size: file.size,
        type: file.type,
      };
      newAttachments.push(attachment);
    });

    onAttachmentsChange([...attachments, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(updated);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalAttachmentSize = (): string => {
    const totalBytes = attachments.reduce((sum, att) => sum + att.size, 0);
    return formatFileSize(totalBytes);
  };

  const getPreviewHtml = (): string => {
    let html = bodyHtml;
    
    // Replace merge fields with sample data for preview
    html = html.replace(/\{\{first_name\}\}/g, 'John');
    html = html.replace(/\{\{advisor_name\}\}/g, 'Sarah Johnson');
    html = html.replace(/\{\{quarter\}\}/g, '4');
    html = html.replace(/\{\{month\}\}/g, 'January');
    html = html.replace(/\{\{year\}\}/g, '2024');
    
    return html;
  };

  const selectedFromAddress = fromAddresses.find(addr => addr.id === selectedFrom);

  return (
    <div className="space-y-4">
      {/* Email Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* From Address */}
          <div>
            <Label htmlFor="from-address">From</Label>
            <Select value={selectedFrom} onValueChange={onFromChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select sender address..." />
              </SelectTrigger>
              <SelectContent>
                {fromAddresses.map((addr) => (
                  <SelectItem key={addr.id} value={addr.id}>
                    <div>
                      <div className="font-medium">{addr.name}</div>
                      <div className="text-sm text-muted-foreground">{addr.email}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Enter email subject..."
              disabled={disabled}
            />
          </div>

          {/* Template Actions */}
          <div className="flex items-center gap-2">
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Email Templates</DialogTitle>
                  <DialogDescription>
                    Choose a template to get started, or create your own message.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {Object.entries(
                    templates.reduce((acc, template) => {
                      const category = template.category || 'Uncategorized';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(template);
                      return acc;
                    }, {} as Record<string, EmailTemplate[]>)
                  ).map(([category, templates]) => (
                    <div key={category}>
                      <h4 className="font-medium mb-2">{category}</h4>
                      <div className="space-y-2">
                        {templates.map((template) => (
                          <div
                            key={template.id}
                            className="p-3 border rounded-lg cursor-pointer hover:bg-muted/20"
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{template.name}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {template.subject}
                                </div>
                              </div>
                              {template.isSystem && (
                                <Badge variant="secondary">System</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {selectedTemplate && (
              <Badge variant="outline">
                Template: {templates.find(t => t.id === selectedTemplate)?.name}
              </Badge>
            )}
            
            <div className="flex-1" />
            
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Body */}
      <Card>
        <CardHeader>
          <CardTitle>Message Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rich Text Editor (simplified) */}
          <div>
            <Label htmlFor="body">Email Body</Label>
            <div className="mt-1">
              <Textarea
                id="body"
                value={bodyHtml}
                onChange={(e) => onBodyHtmlChange(e.target.value)}
                placeholder="Type your message here... You can use merge fields like first_name and advisor_name (with double curly braces)"
                className="min-h-[200px]"
                disabled={disabled}
              />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Available merge fields: &#123;&#123;first_name&#125;&#125;, &#123;&#123;advisor_name&#125;&#125;, &#123;&#123;quarter&#125;&#125;, &#123;&#123;month&#125;&#125;, &#123;&#123;year&#125;&#125;
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Attachments
            {attachments.length > 0 && (
              <Badge variant="secondary">
                {attachments.length} file{attachments.length > 1 ? 's' : ''} • {getTotalAttachmentSize()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              disabled={disabled}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add Attachments
            </Button>
          </div>

          {/* Attachment List */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <div className="font-medium text-sm">{attachment.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} • {attachment.type}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={onSend}
              disabled={disabled || !selectedFrom || !subject.trim() || !bodyHtml.trim()}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send Email
            </Button>
            
            <Button
              variant="outline"
              onClick={onTestSend}
              disabled={disabled || !selectedFrom || !subject.trim() || !bodyHtml.trim()}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Test Send (to me)
            </Button>

            {!subject.trim() && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertCircle className="h-4 w-4" />
                Subject required
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of how your email will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border rounded-lg p-4 bg-white">
              <div className="border-b pb-3 mb-3">
                <div className="text-sm text-muted-foreground mb-1">From:</div>
                <div className="font-medium">{selectedFromAddress?.email}</div>
              </div>
              <div className="border-b pb-3 mb-3">
                <div className="text-sm text-muted-foreground mb-1">Subject:</div>
                <div className="font-medium">{subject.replace(/\{\{first_name\}\}/g, 'John')}</div>
              </div>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreviewHtml()) }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}