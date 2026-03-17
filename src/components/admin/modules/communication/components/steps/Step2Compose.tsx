import React, { useState, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { 
  Type, Eye, Paperclip, X, ArrowLeft, ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { ScrollArea } from '../../../../../ui/scroll-area';
import { Badge } from '../../../../../ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../../../ui/dialog';
import { CommunicationDraft } from '../../types';
import { communicationApi } from '../../api';
import { toast } from 'sonner@2.0.3';

interface Step2Props {
  draft: CommunicationDraft;
  updateDraft: (updates: Partial<CommunicationDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

const MERGE_FIELDS = [
  { key: '{{first_name}}', label: 'First Name', example: 'John' },
  { key: '{{surname}}', label: 'Surname', example: 'Doe' },
  { key: '{{full_name}}', label: 'Full Name', example: 'John Doe' },
  { key: '{{email}}', label: 'Email', example: 'john@example.com' },
  { key: '{{phone}}', label: 'Phone', example: '+27 82 123 4567' },
  { key: '{{advisor_name}}', label: 'Advisor Name', example: 'Sarah Jenkins' },
  { key: '{{product_provider}}', label: 'Product Provider', example: 'Allan Gray' },
  { key: '{{policy_count}}', label: 'Policy Count', example: '3' },
];

export function Step2Compose({ draft, updateDraft, onNext, onBack }: Step2Props) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

  const formats = [
    'bold', 'italic', 'underline',
    'list',
    'align',
    'link', 'image'
  ];

  const handleInsertMergeField = (field: string) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      editor.focus();
      const range = editor.getSelection();
      if (range) {
        editor.insertText(range.index, field);
        editor.setSelection(range.index + field.length);
      } else {
        const length = editor.getLength();
        editor.insertText(length - 1, field);
      }
    } else {
      updateDraft({ bodyHtml: (draft.bodyHtml || '') + ' ' + field });
    }
  };

  const handleAttachment = () => {
    // Create a file input element dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate size (e.g. 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File is too large. Maximum size is 10MB.');
        return;
      }

      const toastId = toast.loading('Uploading attachment...');
      
      try {
        const uploadedFile = await communicationApi.uploadFile(file);
        updateDraft({ attachments: [...draft.attachments, uploadedFile] });
        toast.success('Attachment uploaded successfully', { id: toastId });
      } catch (err) {
        console.error(err);
        toast.error('Failed to upload file', { id: toastId });
      }
    };
    input.click();
  };

  const removeAttachment = (id: string) => {
    updateDraft({ attachments: draft.attachments.filter(a => a.id !== id) });
  };

  /** Resolve merge field placeholders with example data for preview */
  const resolvePreviewMergeFields = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{surname\}\}/g, 'Doe')
      .replace(/\{\{full_name\}\}/g, 'John Doe')
      .replace(/\{\{email\}\}/g, 'john@example.com')
      .replace(/\{\{phone\}\}/g, '+27 82 123 4567')
      .replace(/\{\{advisor_name\}\}/g, 'Sarah Jenkins')
      .replace(/\{\{product_provider\}\}/g, 'Allan Gray')
      .replace(/\{\{policy_count\}\}/g, '3');
  };

  const canProceed = () => {
    return draft.subject.length > 0 && draft.bodyHtml.length > 0;
  };

  return (
    <div className="space-y-6">
      <style>{`
        .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          font-size: 16px;
          font-family: inherit;
        }
        .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background-color: #f9fafb;
        }
        .ql-editor {
          min-h: 400px;
        }
      `}</style>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input 
                  id="subject" 
                  placeholder="Enter email subject..." 
                  value={draft.subject}
                  onChange={(e) => updateDraft({ subject: e.target.value })}
                  className="mt-1.5 text-lg font-medium"
                />
              </div>
              
              <div>
                <Label htmlFor="title" className="text-muted-foreground text-xs">Internal Title (Optional)</Label>
                <Input 
                  id="title" 
                  placeholder="Campaign title (internal use only)..." 
                  value={draft.title || ''}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  className="mt-1"
                />
              </div>

              {/* WYSIWYG Editor */}
              <div className="rounded-lg shadow-sm">
                <ReactQuill 
                  ref={quillRef}
                  theme="snow"
                  value={draft.bodyHtml}
                  onChange={(content) => updateDraft({ bodyHtml: content })}
                  modules={modules}
                  formats={formats}
                  placeholder="Write your message here..."
                  className="bg-white"
                />
              </div>

              {/* Attachments Area */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </Label>
                  <Button variant="outline" size="sm" onClick={handleAttachment}>
                    Upload File
                  </Button>
                </div>
                
                {draft.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {draft.attachments.map(file => (
                      <Badge key={file.id} variant="secondary" className="pl-3 pr-1 py-1 h-8 flex items-center gap-2">
                        {file.name}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 rounded-full hover:bg-muted"
                          onClick={() => removeAttachment(file.id)}
                          aria-label={`Remove attachment ${file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Merge Fields */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" /> 
                Merge Fields
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Click to insert personalized data into your email.
              </p>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {MERGE_FIELDS.map(field => (
                    <button
                      key={field.key}
                      onClick={() => handleInsertMergeField(field.key)}
                      className="w-full text-left p-2.5 rounded-md border hover:border-primary hover:bg-primary/5 transition-colors text-sm group"
                    >
                      <div className="font-medium text-gray-700 group-hover:text-primary">{field.label}</div>
                      <code className="text-xs text-muted-foreground bg-muted px-1 rounded mt-1 inline-block">
                        {field.key}
                      </code>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Preview Button */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-12 text-base gap-2">
                <Eye className="h-5 w-5" />
                Preview Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Email Preview</DialogTitle>
                <p className="text-sm text-muted-foreground">This is how your email will appear to recipients. Merge fields are shown with example data.</p>
              </DialogHeader>
              {/* Email envelope info */}
              <div className="space-y-1.5 border rounded-lg p-4 bg-muted/30 mt-2">
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-sm">
                  <span className="font-medium text-muted-foreground">From:</span>
                  <span>Navigate Wealth &lt;info@navigatewealth.co&gt;</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-sm">
                  <span className="font-medium text-muted-foreground">To:</span>
                  <span>John Doe &lt;john@example.com&gt;</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2 items-center text-sm">
                  <span className="font-medium text-muted-foreground">Subject:</span>
                  <span className="font-semibold">{resolvePreviewMergeFields(draft.subject) || '(No Subject)'}</span>
                </div>
              </div>
              {/* WYSIWYG email template preview — mirrors the actual Navigate Wealth email template */}
              <div className="mt-4 rounded-xl overflow-hidden border shadow-lg" style={{ backgroundColor: '#f3f4f6' }}>
                <div style={{ padding: '32px 16px' }}>
                  <div style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
                    overflow: 'hidden',
                    fontFamily: 'Arial, sans-serif',
                  }}>
                    {/* Purple gradient accent */}
                    <div style={{
                      height: '5px',
                      background: 'linear-gradient(90deg, #6d28d9, #a855f7, #6d28d9)',
                      borderRadius: '12px 12px 0 0',
                    }} />
                    {/* Main content */}
                    <div style={{ padding: '30px 32px 24px 32px', textAlign: 'center' }}>
                      {/* Logo */}
                      <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#000000' }}>Navigate</span>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#6d28d9' }}>Wealth</span>
                      </div>
                      {/* Title */}
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>
                        {resolvePreviewMergeFields(draft.subject) || 'Navigate Wealth'}
                      </div>
                      {/* Body content */}
                      <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.6', textAlign: 'left' }}>
                        {draft.bodyHtml ? (
                          <div dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(resolvePreviewMergeFields(draft.bodyHtml))
                          }} />
                        ) : (
                          <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No content yet...</p>
                        )}
                      </div>
                    </div>
                    {/* Divider */}
                    <div style={{ padding: '0 32px' }}>
                      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: 0 }} />
                    </div>
                    {/* Footer */}
                    <div style={{ padding: '18px 32px 24px 32px', fontSize: '12px', color: '#6b7280', lineHeight: '1.6', textAlign: 'center' }}>
                      <p style={{ margin: 0 }}>
                        <strong>Navigate Wealth</strong><br />
                        Independent Financial Advisory Services
                      </p>
                      <p style={{ margin: '8px 0 0' }}>
                        First Floor, Milestone Place, Block A<br />
                        25 Sovereign Dr, Route 21 Business Park<br />
                        Irene, 0157
                      </p>
                      <p style={{ margin: '8px 0 0' }}>
                        Email: <span style={{ color: '#6d28d9' }}>info@navigatewealth.co</span>
                      </p>
                      <p style={{ margin: '12px 0 0' }}>
                        <strong>Follow us:</strong><br />
                        <span style={{ color: '#6d28d9' }}>LinkedIn</span> | <span style={{ color: '#6d28d9' }}>Instagram</span> | <span style={{ color: '#6d28d9' }}>YouTube</span>
                      </p>
                      <p style={{ margin: '12px 0 0', color: '#9ca3af' }}>
                        &copy; {new Date().getFullYear()} Navigate Wealth. All rights reserved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Attachments in preview */}
              {draft.attachments.length > 0 && (
                <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attachments</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {draft.attachments.map(f => (
                      <Badge key={f.id} variant="secondary" className="gap-1">
                        <Paperclip className="h-3 w-3" /> {f.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed()} className="gap-2">
          Review & Send <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}