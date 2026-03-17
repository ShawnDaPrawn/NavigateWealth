/**
 * ComposeForm — Communication Compose UI
 *
 * Handles the rich-text message editor, category/priority selection,
 * delivery options, attachment management, and send action.
 *
 * Presentation-only — all mutations and data fetching remain in the parent.
 */

import React, { useState, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Checkbox } from '../../../../../ui/checkbox';
import { Label } from '../../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Send,
  Mail,
  MessageSquare,
  Loader2,
  Paperclip,
  X,
  Upload,
  Lock,
  FileArchive,
  History,
} from 'lucide-react';
import { CATEGORIES, PRIORITIES } from './constants';
import type { AttachmentFile } from '../../../communication/types';

export interface ComposeFormProps {
  clientFirstName: string;
  clientLastName: string;
  clientId: string;
  clientEmail: string;
  clientIdNumber?: string;
  /** Callback to trigger the send mutation */
  onSend: (payload: ComposePayload) => void;
  /** Whether the send mutation is in flight */
  isSending: boolean;
  /** Open the history dialog */
  onViewHistory: () => void;
}

export interface ComposePayload {
  subject: string;
  message: string;
  category: string;
  priority: string;
  sendEmail: boolean;
  attachments: File[];
  encryptAttachments: boolean;
  ccAdmin: boolean;
  additionalCc: string;
}

export function ComposeForm({
  clientFirstName,
  clientLastName,
  clientId,
  clientEmail,
  clientIdNumber,
  onSend,
  isSending,
  onViewHistory,
}: ComposeFormProps) {
  const quillRef = useRef<ReactQuill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [priority, setPriority] = useState<string>('normal');
  const [sendEmail, setSendEmail] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [encryptAttachments, setEncryptAttachments] = useState(false);

  // Email Options
  const [ccAdmin, setCcAdmin] = useState(false);
  const [additionalCc, setAdditionalCc] = useState('');

  // Editor config
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean'],
    ],
  }), []);

  const formats = ['bold', 'italic', 'underline', 'list', 'link'];

  const isMessageEmpty = (html: string) => {
    const text = html.replace(/<[^>]*>/g, '').trim();
    return !text;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    onSend({
      subject,
      message,
      category,
      priority,
      sendEmail,
      attachments,
      encryptAttachments,
      ccAdmin,
      additionalCc,
    });
  };

  /** Called by the parent after a successful send to clear the form. */
  const resetForm = () => {
    setSubject('');
    setMessage('');
    setCategory('General');
    setPriority('normal');
    setSendEmail(true);
    setAttachments([]);
    setEncryptAttachments(false);
    setCcAdmin(false);
    setAdditionalCc('');
  };

  // Expose reset imperatively via ref if needed, but the parent can also
  // key-remount this component. For now, attach to window for parent access.
  // This is a pragmatic choice — a proper solution would use useImperativeHandle.
  React.useEffect(() => {
    // WORKAROUND: Attach reset function to component for parent access.
    // Proper solution: useImperativeHandle with forwardRef.
    (ComposeForm as unknown as Record<string, unknown>).__resetForm = resetForm;
  }, []);

  const canSend = subject.trim() && !isMessageEmpty(message) && !isSending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle>Send Communication</CardTitle>
          <CardDescription>
            Send a message to {clientFirstName} {clientLastName}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewHistory}
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          View History
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            placeholder="Enter subject..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Message (WYSIWYG) */}
        <div className="space-y-2">
          <Label htmlFor="message">Message *</Label>
          <div className="rounded-md border bg-white">
            <ReactQuill
              theme="snow"
              value={message}
              onChange={setMessage}
              modules={modules}
              formats={formats}
              placeholder="Type your message..."
              ref={quillRef}
            />
          </div>
        </div>

        {/* Category and Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Delivery Options */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Delivery Options</Label>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={sendEmail}
                  onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                />
                <label htmlFor="sendEmail" className="text-sm flex items-center gap-2 cursor-pointer">
                  <Mail className="h-4 w-4 text-gray-500" />
                  Send Email
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendToPortal"
                  checked={true}
                  disabled
                />
                <label htmlFor="sendToPortal" className="text-sm flex items-center gap-2 cursor-pointer text-gray-500">
                  <MessageSquare className="h-4 w-4" />
                  Publish to Portal (Required)
                </label>
              </div>
            </div>
          </div>

          {sendEmail && (
            <div className="bg-slate-50 p-3 rounded-md border space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ccAdmin"
                  checked={ccAdmin}
                  onCheckedChange={(checked) => setCcAdmin(checked as boolean)}
                />
                <label htmlFor="ccAdmin" className="text-sm cursor-pointer">
                  CC <span className="font-medium">info@navigatewealth.co</span>
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="additionalCc" className="text-xs text-muted-foreground">
                  Additional CC (comma separated)
                </Label>
                <Input
                  id="additionalCc"
                  placeholder="colleague@example.com, assistant@example.com"
                  value={additionalCc}
                  onChange={(e) => setAdditionalCc(e.target.value)}
                  className="bg-white h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-base">Attachments</Label>
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-md border">
              <Checkbox
                id="encrypt"
                checked={encryptAttachments}
                onCheckedChange={(checked) => setEncryptAttachments(checked as boolean)}
              />
              <label htmlFor="encrypt" className="text-sm flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                {encryptAttachments ? (
                  <Lock className="h-3.5 w-3.5 text-blue-600" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5 text-slate-500" />
                )}
                Zip & Encrypt Documents
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File(s)
              </Button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <span className="text-xs text-muted-foreground">
                Supports multiple files.{' '}
                {encryptAttachments
                  ? 'Files will be zipped and password protected with client ID.'
                  : 'Standard attachment.'}
              </span>
            </div>

            {attachments.length > 0 && (
              <div className="grid gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-md border text-sm"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate font-medium text-slate-700">{file.name}</span>
                      <span className="text-slate-400 text-xs">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Send Button */}
        <div className="flex justify-end pt-4 border-t mt-4">
          <Button
            onClick={handleSend}
            className="bg-[#6d28d9] hover:bg-[#5b21b6] min-w-[150px]"
            disabled={!canSend}
          >
            {isSending ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </div>
            ) : (
              <div className="contents">
                <Send className="h-4 w-4 mr-2" />
                Send Communication
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}