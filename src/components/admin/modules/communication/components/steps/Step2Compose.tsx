import { useState, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { Paperclip, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../../../../../ui/card';
import { Input } from '../../../../../ui/input';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { Badge } from '../../../../../ui/badge';
import { Tabs } from '../../../../../ui/tabs';
import { cn } from '../../../../../ui/utils';
import {
  FormErrorBanner,
  SegmentedList,
  SegmentedTrigger,
  SoonBadge,
} from '../../../../layout/page';
import { CommunicationDraft } from '../../types';
import { communicationApi } from '../../api';
import { toast } from 'sonner';

interface Step2Props {
  draft: CommunicationDraft;
  updateDraft: (updates: Partial<CommunicationDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

const MERGE_FIELDS = [
  { key: '{{first_name}}', label: 'First name', example: 'John' },
  { key: '{{surname}}', label: 'Surname', example: 'Doe' },
  { key: '{{full_name}}', label: 'Full name', example: 'John Doe' },
  { key: '{{email}}', label: 'Email', example: 'john@example.com' },
  { key: '{{phone}}', label: 'Phone', example: '+27 82 123 4567' },
  { key: '{{advisor_name}}', label: 'Adviser name', example: 'Sarah Jenkins' },
  { key: '{{product_provider}}', label: 'Product provider', example: 'Allan Gray' },
  { key: '{{policy_count}}', label: 'Policy count', example: '3' },
];

/** The sender every campaign goes out as. */
const FROM_ADDRESS = 'Navigate Wealth <info@navigatewealth.co>';

function sanitizeComposerHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function Step2Compose({ draft, updateDraft, onNext, onBack }: Step2Props) {
  // Field errors show once Continue has been pressed.
  const [showErrors, setShowErrors] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  const modules = useMemo(
    () => ({
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link', 'image'],
        ['clean'],
      ],
    }),
    [],
  );

  const formats = ['bold', 'italic', 'underline', 'list', 'align', 'link', 'image'];

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
    updateDraft({ attachments: draft.attachments.filter((a) => a.id !== id) });
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

  const plainBody = draft.bodyHtml.replace(/<[^>]*>/g, '').trim();
  const errors = {
    subject: draft.subject.trim() ? undefined : 'Add a subject line',
    body: plainBody ? undefined : 'Write the message',
  };
  const errorCount = Object.values(errors).filter(Boolean).length;

  const handleContinue = () => {
    if (errorCount > 0) {
      setShowErrors(true);
      if (errors.subject) document.getElementById('subject')?.focus();
      else quillRef.current?.focus();
      return;
    }
    onNext();
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

      {/* Channel: only email can be sent today. */}
      <Tabs value="email">
        <SegmentedList aria-label="Channel">
          <SegmentedTrigger value="email">Email</SegmentedTrigger>
          <SegmentedTrigger value="whatsapp" disabled>
            WhatsApp <SoonBadge />
          </SegmentedTrigger>
        </SegmentedList>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Editor */}
        <Card>
          <CardContent className="space-y-4 p-6">
            {showErrors && <FormErrorBanner count={errorCount} action="continue to review" />}
            <div className="space-y-1.5">
              <Label>From</Label>
              <p className="rounded-md border border-nw-line bg-nw-bg px-3 py-2 text-sm text-nw-text-2">
                {FROM_ADDRESS}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Enter email subject…"
                value={draft.subject}
                onChange={(e) => updateDraft({ subject: e.target.value })}
                aria-invalid={showErrors && errors.subject ? true : undefined}
                aria-describedby={showErrors && errors.subject ? 'subject-error' : undefined}
                className={cn(
                  'text-base font-medium',
                  showErrors && errors.subject && 'border-red-400 focus-visible:ring-red-400',
                )}
              />
              {showErrors && errors.subject && (
                <p id="subject-error" className="text-xs text-red-600">
                  {errors.subject}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs text-muted-foreground">
                Internal title (optional)
              </Label>
              <Input
                id="title"
                placeholder="Campaign title (internal use only)…"
                value={draft.title || ''}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-nw-text-2">Insert a merge field</p>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((field) => (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => handleInsertMergeField(field.key)}
                    title={field.key}
                    className="inline-flex h-7 items-center rounded-full border border-nw-line bg-white px-2.5 text-xs text-nw-text-2 transition-colors hover:border-nw-violet hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
                  >
                    {field.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Message</Label>
              <div className={cn('rounded-lg', showErrors && errors.body && 'ring-1 ring-red-400')}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={draft.bodyHtml}
                  onChange={(content) => updateDraft({ bodyHtml: sanitizeComposerHtml(content) })}
                  modules={modules}
                  formats={formats}
                  placeholder="Write your message here…"
                  className="bg-white"
                />
              </div>
              {showErrors && errors.body && <p className="text-xs text-red-600">{errors.body}</p>}
            </div>

            {/* Attachments Area */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" aria-hidden="true" /> Attachments
                </Label>
                <Button variant="outline" size="sm" onClick={handleAttachment}>
                  Attach files
                </Button>
              </div>

              {draft.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft.attachments.map((file) => (
                    <Badge
                      key={file.id}
                      variant="secondary"
                      className="pl-3 pr-1 py-1 h-8 flex items-center gap-2"
                    >
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

        {/* Live preview beside the editor */}
        <Card className="h-fit xl:sticky xl:top-4">
          <CardContent className="space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-nw-ink">Preview</h3>
              <p className="text-xs text-nw-text-3">
                As the recipient will see it. Merge fields show example data.
              </p>
            </div>
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
              <p>
                <span className="text-muted-foreground">From:</span> {FROM_ADDRESS}
              </p>
              <p>
                <span className="text-muted-foreground">Subject:</span>{' '}
                <span className="font-semibold">
                  {resolvePreviewMergeFields(draft.subject) || '(No subject)'}
                </span>
              </p>
            </div>
            {/* WYSIWYG email template preview — mirrors the actual Navigate Wealth email template */}
            <div
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <div style={{ padding: '16px 8px' }}>
                <div
                  style={{
                    maxWidth: '600px',
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.10)',
                    overflow: 'hidden',
                    fontFamily: 'Arial, sans-serif',
                  }}
                >
                  {/* Purple gradient accent */}
                  <div
                    style={{
                      height: '5px',
                      background: 'linear-gradient(90deg, #6d28d9, #a855f7, #6d28d9)',
                      borderRadius: '12px 12px 0 0',
                    }}
                  />
                  {/* Main content */}
                  <div style={{ padding: '30px 32px 24px 32px', textAlign: 'center' }}>
                    {/* Logo */}
                    <div style={{ marginBottom: '20px' }}>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#000000' }}>
                        Navigate
                      </span>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#6d28d9' }}>
                        Wealth
                      </span>
                    </div>
                    {/* Title */}
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#111827',
                        marginBottom: '24px',
                      }}
                    >
                      {resolvePreviewMergeFields(draft.subject) || 'Navigate Wealth'}
                    </div>
                    {/* Body content */}
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: '1.6',
                        textAlign: 'left',
                      }}
                    >
                      {draft.bodyHtml ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeComposerHtml(resolvePreviewMergeFields(draft.bodyHtml)),
                          }}
                        />
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
                  <div
                    style={{
                      padding: '18px 32px 24px 32px',
                      fontSize: '12px',
                      color: '#6b7280',
                      lineHeight: '1.6',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      <strong>Navigate Wealth</strong>
                      <br />
                      Independent Financial Advisory Services
                    </p>
                    <p style={{ margin: '8px 0 0' }}>
                      First Floor, Milestone Place Block A<br />
                      25 Sovereign Drive, Route 21 Business Park
                      <br />
                      Pretoria, 0157
                    </p>
                    <p style={{ margin: '8px 0 0' }}>
                      Email: <span style={{ color: '#6d28d9' }}>info@navigatewealth.co</span>
                    </p>
                    <p style={{ margin: '12px 0 0' }}>
                      <strong>Follow us:</strong>
                      <br />
                      <span style={{ color: '#6d28d9' }}>LinkedIn</span> |{' '}
                      <span style={{ color: '#6d28d9' }}>Instagram</span> |{' '}
                      <span style={{ color: '#6d28d9' }}>X</span>
                    </p>
                    <p style={{ margin: '12px 0 0', color: '#9ca3af' }}>
                      &copy; {new Date().getFullYear()} Navigate Wealth. All rights reserved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back / Continue stay pinned to the bottom of the page */}
      <div className="sticky bottom-0 z-10 flex justify-between border-t border-nw-line bg-white/95 py-3 backdrop-blur">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Button>
        <Button onClick={handleContinue} className="gap-2">
          Continue to review <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
