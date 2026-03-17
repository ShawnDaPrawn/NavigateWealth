/**
 * Create Envelope Wizard
 * Complete multi-step wizard for creating and sending e-signature envelopes
 * Integrates: Upload → Signers → Review → Send
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent } from '../../../../ui/card';
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  Users,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Send,
  Eye,
  ListOrdered,
  Shuffle,
} from 'lucide-react';
import { SignerManager } from './SignerManager';
import { useEnvelopeActions } from '../hooks/useEnvelopeActions';
import type { Client } from '../../client-management/types';
import type { SignerFormData, EsignEnvelope } from '../types';
import type { SigningMode } from '../types';

interface CreateEnvelopeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  onSuccess?: (envelopeId: string) => void;
}

type WizardStep = 'upload' | 'signers' | 'review' | 'sending';

export function CreateEnvelopeWizard({
  open,
  onOpenChange,
  client,
  onSuccess,
}: CreateEnvelopeWizardProps) {
  const { uploadDocument, sendInvites, uploading, sending, uploadError, sendError } =
    useEnvelopeActions();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [createdEnvelope, setCreatedEnvelope] = useState<EsignEnvelope | null>(null);

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(30);
  const [signingMode, setSigningMode] = useState<SigningMode>('sequential');
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Signers
  const [signers, setSigners] = useState<SignerFormData[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ==================== FILE UPLOAD HANDLERS ====================

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    const newErrors: Record<string, string> = {};

    if (!selectedFile.type.includes('pdf')) {
      newErrors.file = 'Only PDF files are supported';
      setErrors(newErrors);
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      newErrors.file = 'File size must be less than 10MB';
      setErrors(newErrors);
      return;
    }

    setFile(selectedFile);
    setErrors({});

    if (!title) {
      const fileName = selectedFile.name.replace('.pdf', '');
      setTitle(fileName);
    }
  };

  const removeFile = () => {
    setFile(null);
    setErrors({});
  };

  // ==================== STEP NAVIGATION ====================

  const handleNextFromUpload = async () => {
    const newErrors: Record<string, string> = {};

    if (!file) {
      newErrors.file = 'Please select a PDF file';
    }
    if (!title.trim()) {
      newErrors.title = 'Document title is required';
    }
    if (expiryDays < 1 || expiryDays > 365) {
      newErrors.expiryDays = 'Expiry must be between 1 and 365 days';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // Upload document
    try {
      const result = await uploadDocument({
        files: file ? [file] : [],
        context: {
          clientId: client.id,
          title,
          message: message.trim() || undefined,
          expiryDays,
          signingMode,
        },
      });

      if (result) {
        setCreatedEnvelope(result);
        setCurrentStep('signers');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleNextFromSigners = () => {
    if (signers.length === 0) {
      setErrors({ signers: 'Add at least one signer to continue' });
      return;
    }
    setErrors({});
    setCurrentStep('review');
  };

  const handleSendEnvelope = async () => {
    if (!createdEnvelope) return;

    setCurrentStep('sending');

    try {
      const success = await sendInvites(createdEnvelope.id, {
        signers: signers.map((s) => ({
          name: s.name,
          email: s.email,
          role: s.role,
          order: s.order,
          otpRequired: s.otpRequired,
          accessCode: s.accessCode,
          clientId: s.clientId,
        })),
        expiryDays,
        message: message.trim() || undefined,
        signingMode,
      });

      if (success) {
        // Success - close wizard
        if (onSuccess && createdEnvelope) {
          onSuccess(createdEnvelope.id);
        }
        handleClose();
      } else {
        // Failed - go back to review
        setCurrentStep('review');
      }
    } catch (error) {
      console.error('Send failed:', error);
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'signers') {
      setCurrentStep('upload');
    } else if (currentStep === 'review') {
      setCurrentStep('signers');
    }
  };

  const handleClose = () => {
    // Reset all state
    setCurrentStep('upload');
    setFile(null);
    setTitle('');
    setMessage('');
    setExpiryDays(30);
    setSigningMode('sequential');
    setSigners([]);
    setErrors({});
    setCreatedEnvelope(null);
    onOpenChange(false);
  };

  // ==================== RENDER STEPS ====================

  const renderUploadStep = () => (
    <div className="space-y-4">
      {/* File Upload Area */}
      <div className="space-y-2">
        <Label htmlFor="file-upload">Document File *</Label>

        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-purple-500 bg-purple-50'
                : errors.file
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Drag and drop your PDF file here</p>
              <p className="text-xs text-muted-foreground">or</p>
              <label htmlFor="file-upload">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  asChild
                >
                  <span>Browse Files</span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                PDF files only, max 10MB
              </p>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {errors.file && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.file}
          </p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Document Title *</Label>
        <Input
          id="title"
          placeholder="e.g., Client Agreement, Policy Application"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={errors.title ? 'border-red-300' : ''}
        />
        {errors.title && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.title}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message">Message to Signers (Optional)</Label>
        <Textarea
          id="message"
          placeholder="Add a personal message that will be included in the signing invitation..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">
          {message.length}/500
        </p>
      </div>

      {/* Expiry */}
      <div className="space-y-2">
        <Label htmlFor="expiryDays">Expires After (Days)</Label>
        <Input
          id="expiryDays"
          type="number"
          min={1}
          max={365}
          value={expiryDays}
          onChange={(e) => setExpiryDays(parseInt(e.target.value) || 30)}
          className={errors.expiryDays ? 'border-red-300' : ''}
        />
        {errors.expiryDays && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errors.expiryDays}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Document will expire on{' '}
          {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString(
            'en-ZA'
          )}
        </p>
      </div>

      {/* Signing Mode */}
      <div className="space-y-2">
        <Label>Signing Order</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSigningMode('sequential')}
            className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
              signingMode === 'sequential'
                ? 'border-purple-400 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ListOrdered className={`h-4 w-4 ${signingMode === 'sequential' ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${signingMode === 'sequential' ? 'text-purple-700' : 'text-gray-700'}`}>
                Sequential
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Signers sign one at a time, in order.
            </p>
            {signingMode === 'sequential' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600" />
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSigningMode('parallel')}
            className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
              signingMode === 'parallel'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Shuffle className={`h-4 w-4 ${signingMode === 'parallel' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${signingMode === 'parallel' ? 'text-blue-700' : 'text-gray-700'}`}>
                Parallel
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              All signers are invited at once.
            </p>
            {signingMode === 'parallel' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </div>
            )}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-red-900">Upload Failed</p>
              <p className="text-sm text-red-700 mt-1">{uploadError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSignersStep = () => (
    <div className="space-y-4">
      <SignerManager
        signers={signers}
        onChange={setSigners}
        clientEmail={client.email}
        clientName={`${client.firstName} ${client.lastName}`}
      />

      {errors.signers && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errors.signers}
          </p>
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Document Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{title}</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                {file && (
                  <p>
                    File: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p>Expires in {expiryDays} days</p>
                <p className="flex items-center gap-1">
                  Signing order:{' '}
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      signingMode === 'sequential'
                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                    }`}
                  >
                    {signingMode === 'sequential' ? (
                      <ListOrdered className="h-3 w-3 mr-0.5" />
                    ) : (
                      <Shuffle className="h-3 w-3 mr-0.5" />
                    )}
                    {signingMode === 'sequential' ? 'Sequential' : 'Parallel'}
                  </Badge>
                </p>
                {message && (
                  <p className="mt-2 italic border-l-2 border-gray-300 pl-3">
                    {message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signers */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold">Signers</h3>
            </div>
            <Badge variant="outline">{signers.length} Total</Badge>
          </div>
          <div className="space-y-2">
            {signers.map((signer, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{signer.name}</span>
                    {signer.role && (
                      <Badge variant="outline" className="text-xs">
                        {signer.role}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{signer.email}</p>
                </div>
                <Badge variant="secondary">#{signer.order}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium">Ready to Send</p>
            <p className="text-blue-700 mt-1">
              {signingMode === 'sequential'
                ? `Signing invitations will be sent sequentially. The first signer will receive an invitation, and subsequent signers will be notified in order as each completes.`
                : `Signing invitations will be sent to all ${signers.length} signer${signers.length !== 1 ? 's' : ''} simultaneously. They can sign in any order.`}
            </p>
          </div>
        </div>
      </div>

      {sendError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-red-900">Failed to Send</p>
              <p className="text-sm text-red-700 mt-1">{sendError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSendingStep = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-16 w-16 animate-spin text-purple-600" />
      <div className="text-center">
        <h3 className="font-semibold text-lg mb-2">Sending Invitations...</h3>
        <p className="text-sm text-muted-foreground">
          Please wait while we send signing invitations to {signers.length} signer
          {signers.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  // ==================== RENDER DIALOG ====================

  const getDialogTitle = () => {
    switch (currentStep) {
      case 'upload':
        return 'Upload Document';
      case 'signers':
        return 'Add Signers';
      case 'review':
        return 'Review & Send';
      case 'sending':
        return 'Sending...';
    }
  };

  const getDialogDescription = () => {
    switch (currentStep) {
      case 'upload':
        return `Upload a PDF document for ${client.firstName} ${client.lastName}`;
      case 'signers':
        return 'Add people who need to sign this document';
      case 'review':
        return 'Review details before sending for signature';
      case 'sending':
        return 'Processing your request';
    }
  };

  return (
    <Dialog open={open} onOpenChange={currentStep === 'sending' ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        {currentStep !== 'sending' && (
          <div className="flex items-center gap-2 border-b pb-4">
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'upload' ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'upload'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-300'
                }`}
              >
                {['signers', 'review'].includes(currentStep) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-sm font-medium">1</span>
                )}
              </div>
              <span className="text-sm font-medium">Upload</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'signers' ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'signers'
                    ? 'border-purple-600 bg-purple-50'
                    : currentStep === 'review'
                    ? 'border-gray-300'
                    : 'border-gray-300'
                }`}
              >
                {currentStep === 'review' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-sm font-medium">2</span>
                )}
              </div>
              <span className="text-sm font-medium">Signers</span>
            </div>
            <div className="flex-1 h-px bg-gray-300"></div>
            <div
              className={`flex items-center gap-2 ${
                currentStep === 'review' ? 'text-purple-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep === 'review'
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-300'
                }`}
              >
                <span className="text-sm font-medium">3</span>
              </div>
              <span className="text-sm font-medium">Review</span>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="py-4">
          {currentStep === 'upload' && renderUploadStep()}
          {currentStep === 'signers' && renderSignersStep()}
          {currentStep === 'review' && renderReviewStep()}
          {currentStep === 'sending' && renderSendingStep()}
        </div>

        {/* Footer Actions */}
        {currentStep !== 'sending' && (
          <DialogFooter>
            {currentStep !== 'upload' && (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}

            {currentStep === 'upload' && (
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}

            {currentStep === 'upload' && (
              <Button
                type="button"
                onClick={handleNextFromUpload}
                disabled={uploading || !file}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {uploading ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div className="contents">
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                )}
              </Button>
            )}

            {currentStep === 'signers' && (
              <Button
                type="button"
                onClick={handleNextFromSigners}
                disabled={signers.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Continue to Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {currentStep === 'review' && (
              <Button
                type="button"
                onClick={handleSendEnvelope}
                disabled={sending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {sending ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </div>
                ) : (
                  <div className="contents">
                    <Send className="h-4 w-4 mr-2" />
                    Send for Signature
                  </div>
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}