import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
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
} from '../../../../ui/dialog';
import { 
  MessageSquare, 
  FileText, 
  Send, 
  Eye, 
  X, 
  Upload,
  AlertCircle,
  Image,
  FileIcon
} from 'lucide-react';
import { AttachmentFile } from '../types';

interface WhatsAppComposerProps {
  fromNumbers: Array<{ id: string; name: string; number: string }>;
  selectedFrom: string;
  onFromChange: (fromId: string) => void;
  messageText: string;
  onMessageChange: (text: string) => void;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  onSend: () => void;
  onTestSend: () => void;
  disabled?: boolean;
}

// Default WhatsApp Business API numbers — static configuration (Guidelines §5.3)
// TODO: Replace with backend settings endpoint when WhatsApp number management is implemented
const DEFAULT_FROM_NUMBERS = [
  { id: '1', name: 'Navigate Wealth - Main', number: '+27 21 123 4567' },
  { id: '2', name: 'Navigate Wealth - Support', number: '+27 21 123 4568' },
  { id: '3', name: 'Navigate Wealth - Advisory', number: '+27 21 123 4569' },
];

const MAX_MESSAGE_LENGTH = 4096;
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export function WhatsAppComposer({
  fromNumbers = DEFAULT_FROM_NUMBERS,
  selectedFrom,
  onFromChange,
  messageText,
  onMessageChange,
  attachments,
  onAttachmentsChange,
  onSend,
  onTestSend,
  disabled = false,
}: WhatsAppComposerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploadError(null);
    const newAttachments: AttachmentFile[] = [];
    const errors: string[] = [];
    
    Array.from(files).forEach((file) => {
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: File type not supported`);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 16MB)`);
        return;
      }

      // In real implementation, you'd upload to storage and get back the path
      const attachment: AttachmentFile = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        path: `storage://whatsapp/${file.name}`, // Mock path
        size: file.size,
        type: file.type,
      };
      newAttachments.push(attachment);
    });

    if (errors.length > 0) {
      setUploadError(errors.join('; '));
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
    
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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileIcon className="h-4 w-4" />;
  };

  const getCharacterCount = () => {
    return messageText.length;
  };

  const isOverLimit = () => {
    return messageText.length > MAX_MESSAGE_LENGTH;
  };

  const getPreviewMessage = (): string => {
    let message = messageText;
    
    // Replace merge fields with sample data for preview
    message = message.replace(/\{\{first_name\}\}/g, 'John');
    message = message.replace(/\{\{advisor_name\}\}/g, 'Sarah Johnson');
    
    return message;
  };

  const selectedFromNumber = fromNumbers.find(num => num.id === selectedFrom);

  return (
    <div className="space-y-4">
      {/* WhatsApp Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* From Number */}
          <div>
            <Label htmlFor="from-number">From Number</Label>
            <Select value={selectedFrom} onValueChange={onFromChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select WhatsApp number..." />
              </SelectTrigger>
              <SelectContent>
                {fromNumbers.map((number) => (
                  <SelectItem key={number.id} value={number.id}>
                    <div>
                      <div className="font-medium">{number.name}</div>
                      <div className="text-sm text-muted-foreground">{number.number}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Message Body */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Message Content</span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isOverLimit() ? "destructive" : "secondary"}
                className="text-xs"
              >
                {getCharacterCount()}/{MAX_MESSAGE_LENGTH}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="message">Message Text</Label>
            <div className="mt-1">
              <Textarea
                id="message"
                value={messageText}
                onChange={(e) => onMessageChange(e.target.value)}
                placeholder="Type your WhatsApp message here... You can use merge fields like first_name and advisor_name (with double curly braces)"
                className="min-h-[150px]"
                disabled={disabled}
              />
              {isOverLimit() && (
                <div className="mt-2 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Message is too long. WhatsApp messages are limited to {MAX_MESSAGE_LENGTH} characters.
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Available merge fields: &#123;&#123;first_name&#125;&#125;, &#123;&#123;advisor_name&#125;&#125;
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Attachments
            {attachments.length > 0 && (
              <Badge variant="secondary">
                {attachments.length} file{attachments.length > 1 ? 's' : ''}
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
              accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
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
              Add Files
            </Button>
            <div className="mt-2 text-xs text-muted-foreground">
              Supported: Images (JPG, PNG, GIF), PDF, Word documents • Max size: 16MB per file
            </div>
          </div>

          {/* Upload Error */}
          {uploadError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Upload Error: {uploadError}
              </div>
            </div>
          )}

          {/* Attachment List */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/20 rounded">
                  <div className="flex items-center gap-2">
                    {getFileIcon(attachment.type)}
                    <div>
                      <div className="font-medium text-sm">{attachment.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
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
              disabled={disabled || !selectedFrom || !messageText.trim() || isOverLimit()}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Send WhatsApp
            </Button>
            
            <Button
              variant="outline"
              onClick={onTestSend}
              disabled={disabled || !selectedFrom || !messageText.trim() || isOverLimit()}
              className="flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Test Send (to me)
            </Button>

            {!messageText.trim() && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertCircle className="h-4 w-4" />
                Message text required
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp Preview</DialogTitle>
            <DialogDescription>
              Preview of how your WhatsApp message will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {/* WhatsApp-style preview */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3 text-sm text-green-700">
                <MessageSquare className="h-4 w-4" />
                From: {selectedFromNumber?.number}
              </div>
              
              <div className="bg-white rounded-lg p-3 border">
                <div className="whitespace-pre-wrap text-sm">
                  {getPreviewMessage()}
                </div>
                
                {attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getFileIcon(attachment.type)}
                        <span>{attachment.name}</span>
                        <span className="text-xs">({formatFileSize(attachment.size)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}