/**
 * SubmissionInviteModal
 *
 * Two-step modal for sending submission invitations to clients:
 *
 * Step 1: Choose an invite type (Get Quote, Schedule Meeting, AI Will Agent, etc.)
 * Step 2: Copy the shareable link or send a branded email invitation
 *
 * The modal generates UTM-tagged URLs for tracking and uses the server's
 * branded email template (via POST /submissions/invite) for email delivery.
 *
 * §7  — No business logic in UI; config-driven via SUBMISSION_INVITE_TYPES.
 * §8  — Design System components throughout.
 * §8.1 — Mirrors TaskFormModal layout pattern.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Separator } from '../../../../ui/separator';
import {
  MessageSquare, FileText, Calculator, Calendar, Mail,
  BarChart3, Landmark, Copy, Send, ArrowLeft, Check,
  Link2, ExternalLink, Loader2, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner@2.0.3';
import { submissionsApi } from '../api';
import {
  SUBMISSION_INVITE_TYPES,
  SITE_BASE_URL,
  type SubmissionInviteType,
} from '../constants';

// ── Icon Resolver ─────────────────────────────────────────────────────────────
// §8.4 — resolveIcon pattern for config-driven icon rendering

function resolveInviteIcon(iconName: string, className = 'h-5 w-5'): React.ReactNode {
  const props = { className };
  switch (iconName) {
    case 'MessageSquare': return <MessageSquare {...props} />;
    case 'Calendar':      return <Calendar {...props} />;
    case 'FileText':      return <FileText {...props} />;
    case 'Mail':          return <Mail {...props} />;
    case 'BarChart3':     return <BarChart3 {...props} />;
    case 'Calculator':    return <Calculator {...props} />;
    case 'Landmark':      return <Landmark {...props} />;
    case 'TrendingUp':    return <TrendingUp {...props} />;
    default:              return <FileText {...props} />;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionInviteModalProps {
  open: boolean;
  onClose: () => void;
}

type ModalStep = 'select' | 'compose';

// ── Helper: Build shareable URL ───────────────────────────────────────────────

function buildInviteUrl(inviteType: SubmissionInviteType): string {
  const base = `${SITE_BASE_URL}${inviteType.path}`;
  const separator = inviteType.path.includes('?') ? '&' : '?';
  return `${base}${separator}utm_source=admin_invite&utm_medium=email&utm_campaign=${inviteType.id}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SubmissionInviteModal({ open, onClose }: SubmissionInviteModalProps) {
  const [step, setStep] = useState<ModalStep>('select');
  const [selectedType, setSelectedType] = useState<SubmissionInviteType | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens/closes
  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) {
      onClose();
      // Reset after animation
      setTimeout(() => {
        setStep('select');
        setSelectedType(null);
        setRecipientName('');
        setRecipientEmail('');
        setPersonalMessage('');
        setSending(false);
        setCopied(false);
        setEmailSent(false);
      }, 200);
    }
  }, [onClose]);

  const handleSelectType = useCallback((inviteType: SubmissionInviteType) => {
    setSelectedType(inviteType);
    setStep('compose');
    setCopied(false);
    setEmailSent(false);
  }, []);

  const handleBack = useCallback(() => {
    setStep('select');
    setSelectedType(null);
    setRecipientName('');
    setRecipientEmail('');
    setPersonalMessage('');
    setCopied(false);
    setEmailSent(false);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!selectedType) return;
    const url = buildInviteUrl(selectedType);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [selectedType]);

  const handleSendEmail = useCallback(async () => {
    if (!selectedType || !recipientEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const result = await submissionsApi.sendInvite({
        recipientEmail: recipientEmail.trim(),
        recipientName: recipientName.trim() || undefined,
        inviteTypeId: selectedType.id,
        formUrl: buildInviteUrl(selectedType),
        emailSubject: selectedType.emailSubject,
        emailBody: selectedType.emailBody,
        emailButtonLabel: selectedType.emailButtonLabel,
        personalMessage: personalMessage.trim() || undefined,
      });

      if (result.success) {
        setEmailSent(true);
        toast.success(`Invitation sent to ${recipientEmail}`);
      } else {
        toast.error(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  }, [selectedType, recipientEmail, recipientName, personalMessage]);

  return (
    <div className="contents">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            'p-0 gap-0 overflow-hidden bg-white flex flex-col',
            step === 'select' ? 'max-w-3xl' : 'max-w-xl',
          )}
          hideCloseButton
        >
          {/* ── Header ── */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {step === 'compose' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                  {step === 'select'
                    ? 'Invite Client'
                    : selectedType?.label || 'Send Invitation'
                  }
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  {step === 'select'
                    ? 'Choose a form to share with your client'
                    : 'Copy the link or send a branded email invitation'
                  }
                </DialogDescription>
              </div>
            </div>
            {step === 'compose' && selectedType && (
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                selectedType.iconBgClass,
              )}>
                {resolveInviteIcon(selectedType.iconName, cn('h-4.5 w-4.5', selectedType.iconTextClass))}
              </div>
            )}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto">
            {step === 'select' ? (
              /* ── Step 1: Select Type ── */
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUBMISSION_INVITE_TYPES.map((inviteType) => (
                    <button
                      key={inviteType.id}
                      onClick={() => handleSelectType(inviteType)}
                      className={cn(
                        'flex items-start gap-3.5 p-4 rounded-xl border-2 bg-white text-left transition-all',
                        'hover:shadow-md hover:scale-[1.01] active:scale-[0.99]',
                        inviteType.accentClass,
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        inviteType.iconBgClass,
                      )}>
                        {resolveInviteIcon(inviteType.iconName, cn('h-5 w-5', inviteType.iconTextClass))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-900 mb-0.5">
                          {inviteType.label}
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                          {inviteType.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedType && (
              /* ── Step 2: Compose & Share ── */
              <div className="p-6 space-y-5">
                {/* ── Copy Link Section ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Shareable Link
                  </h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Copy this link to share via WhatsApp, SMS, newsletters, or any communication channel.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 truncate font-mono text-xs">
                      {buildInviteUrl(selectedType)}
                    </div>
                    <Button
                      variant={copied ? 'default' : 'outline'}
                      size="sm"
                      onClick={handleCopyLink}
                      className={cn(
                        'gap-1.5 h-10 px-4 flex-shrink-0 transition-all',
                        copied && 'bg-green-600 hover:bg-green-700 text-white border-green-600',
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="mt-2">
                    <a
                      href={buildInviteUrl(selectedType)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Preview form page
                    </a>
                  </div>
                </section>

                <Separator />

                {/* ── Email Invitation Section ── */}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Send Email Invitation
                  </h4>
                  <p className="text-xs text-gray-400 mb-3">
                    Send a branded Navigate Wealth email with a direct link to the form.
                  </p>

                  {emailSent ? (
                    /* ── Success State ── */
                    <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                      <h4 className="font-semibold text-green-900 mb-1">Invitation Sent</h4>
                      <p className="text-sm text-green-700 mb-4">
                        A branded invitation has been sent to{' '}
                        <span className="font-medium">{recipientEmail}</span>
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRecipientName('');
                            setRecipientEmail('');
                            setPersonalMessage('');
                            setEmailSent(false);
                          }}
                        >
                          Send Another
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenChange(false)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Email Form ── */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Client Name
                            <span className="text-gray-400 font-normal ml-1">(optional)</span>
                          </label>
                          <Input
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="e.g. John Smith"
                            className="text-sm h-10"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Client Email
                            <span className="text-red-500 ml-0.5">*</span>
                          </label>
                          <Input
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="client@example.com"
                            className="text-sm h-10"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Personal Message
                          <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        <Textarea
                          value={personalMessage}
                          onChange={(e) => setPersonalMessage(e.target.value)}
                          placeholder="Add a personal note that will appear at the top of the email..."
                          className="text-sm resize-none min-h-[80px] rounded-lg"
                          rows={3}
                        />
                      </div>

                      {/* Email Preview Summary */}
                      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                        <div className="text-xs text-gray-500 mb-1.5 font-medium">Email Preview</div>
                        <div className="text-xs text-gray-700 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-12">Subject:</span>
                            <span className="font-medium truncate">{selectedType.emailSubject}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-12">Button:</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-semibold">
                              {selectedType.emailButtonLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-12">From:</span>
                            <span>info@navigatewealth.co</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSendEmail}
                        disabled={sending || !recipientEmail.trim()}
                        className="w-full gap-2 h-10 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending Invitation...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send Invitation Email
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          {/* ── Footer (select step only) ── */}
          {step === 'select' && (
            <div className="border-t border-gray-100 px-6 py-3 bg-gray-50/50 shrink-0">
              <p className="text-[11px] text-gray-400 text-center">
                Links include UTM tracking for analytics. Emails are sent from info@navigatewealth.co using the Navigate Wealth branded template.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}