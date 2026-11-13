/**
 * SubmissionInviteModal
 *
 * "Invite a client" dialog: choose a form (Get a quote, Schedule a meeting,
 * AI will drafting, …), then send a branded email invitation or copy the
 * shareable link instead.
 *
 * The modal generates UTM-tagged URLs for tracking and uses the server's
 * branded email template (via POST /submissions/invite) for email delivery.
 *
 * §7  — No business logic in UI; config-driven via SUBMISSION_INVITE_TYPES.
 * §8  — Design System components throughout.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Textarea } from '../../../../ui/textarea';
import { Label } from '../../../../ui/label';
import {
  MessageSquare,
  FileText,
  Calculator,
  Calendar,
  Mail,
  BarChart3,
  Landmark,
  Copy,
  Send,
  Check,
  ExternalLink,
  Loader2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner';
import { submissionsApi } from '../api';
import { SUBMISSION_INVITE_TYPES, SITE_BASE_URL, type SubmissionInviteType } from '../constants';

// ── Icon Resolver ─────────────────────────────────────────────────────────────
// §8.4 — resolveIcon pattern for config-driven icon rendering

function resolveInviteIcon(iconName: string, className = 'h-5 w-5'): React.ReactNode {
  const props = { className };
  switch (iconName) {
    case 'MessageSquare':
      return <MessageSquare {...props} />;
    case 'Calendar':
      return <Calendar {...props} />;
    case 'FileText':
      return <FileText {...props} />;
    case 'Mail':
      return <Mail {...props} />;
    case 'BarChart3':
      return <BarChart3 {...props} />;
    case 'Calculator':
      return <Calculator {...props} />;
    case 'Landmark':
      return <Landmark {...props} />;
    case 'TrendingUp':
      return <TrendingUp {...props} />;
    default:
      return <FileText {...props} />;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionInviteModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Helper: Build shareable URL ───────────────────────────────────────────────

function buildInviteUrl(inviteType: SubmissionInviteType): string {
  const base = `${SITE_BASE_URL}${inviteType.path}`;
  const separator = inviteType.path.includes('?') ? '&' : '?';
  return `${base}${separator}utm_source=admin_invite&utm_medium=email&utm_campaign=${inviteType.id}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Invite a client": a centred dialog (design system: short forms are
 * dialogs). Pick a form, enter who it goes to, then send the branded email —
 * or copy the link instead.
 */
export function SubmissionInviteModal({ open, onClose }: SubmissionInviteModalProps) {
  const [selectedType, setSelectedType] = useState<SubmissionInviteType>(
    SUBMISSION_INVITE_TYPES[0],
  );
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetForm = useCallback(() => {
    setRecipientName('');
    setRecipientEmail('');
    setPersonalMessage('');
    setEmailError(null);
    setSending(false);
    setCopied(false);
    setSentTo(null);
  }, []);

  // Reset state when the dialog closes
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        onClose();
        // Reset after the closing animation
        setTimeout(() => {
          setSelectedType(SUBMISSION_INVITE_TYPES[0]);
          resetForm();
        }, 200);
      }
    },
    [onClose, resetForm],
  );

  const handleCopyLink = useCallback(async () => {
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
    const email = recipientEmail.trim();
    if (!email) {
      setEmailError("Enter the recipient's email address");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setEmailError('Enter a valid email address, e.g. client@example.com');
      return;
    }
    setEmailError(null);

    setSending(true);
    try {
      const result = await submissionsApi.sendInvite({
        recipientEmail: email,
        recipientName: recipientName.trim() || undefined,
        inviteTypeId: selectedType.id,
        formUrl: buildInviteUrl(selectedType),
        emailSubject: selectedType.emailSubject,
        emailBody: selectedType.emailBody,
        emailButtonLabel: selectedType.emailButtonLabel,
        personalMessage: personalMessage.trim() || undefined,
      });

      if (result.success) {
        setSentTo(recipientName.trim() || email);
        toast.success(`Invitation sent to ${email}`);
      } else {
        toast.error(result.error || 'Failed to send invitation. Please try again.');
      }
    } catch (err) {
      console.error('Failed to send invitation:', err);
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  }, [selectedType, recipientEmail, recipientName, personalMessage]);

  const inviteUrl = buildInviteUrl(selectedType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle className="text-lg font-semibold text-nw-ink">Invite a client</DialogTitle>
        {sentTo ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
            <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-nw-ink">Invitation sent</h3>
            <p className="max-w-sm text-sm text-nw-text-2">
              {sentTo} will get an email with a link to the “{selectedType.label}” form. Their reply
              arrives on the board as New.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                Invite another
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendEmail();
            }}
          >
            <DialogDescription className="text-sm text-nw-text-3">
              Send them a link to one of the website forms. Their reply arrives on the board as New.
            </DialogDescription>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-nw-ink">Form</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Form">
                {SUBMISSION_INVITE_TYPES.map((inviteType) => {
                  const on = inviteType.id === selectedType.id;
                  return (
                    <button
                      key={inviteType.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={inviteType.description}
                      onClick={() => {
                        setSelectedType(inviteType);
                        setCopied(false);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-nw-violet/60 focus-visible:outline-none',
                        on
                          ? 'border-nw-violet bg-nw-violet-50 text-nw-violet-600'
                          : 'border-nw-line bg-white text-nw-text-2 hover:text-nw-ink',
                      )}
                    >
                      {resolveInviteIcon(inviteType.iconName, 'h-3.5 w-3.5')}
                      {inviteType.label}
                    </button>
                  );
                })}
              </div>
              <a
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-nw-violet-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Preview form page
              </a>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Recipient name</Label>
              <Input
                id="invite-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">
                Recipient email <span className="text-red-600">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                placeholder="client@example.com"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'invite-email-error' : undefined}
              />
              {emailError && (
                <p id="invite-email-error" className="text-xs text-red-600">
                  {emailError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-message">Personal message (optional)</Label>
              <Textarea
                id="invite-message"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Add a personal note that will appear at the top of the email…"
                className="min-h-[80px] resize-y text-sm"
                rows={3}
              />
              <p className="text-xs text-nw-text-3">
                Sent from info@navigatewealth.co · Subject: {selectedType.emailSubject} · Button:{' '}
                {selectedType.emailButtonLabel}. Links include UTM tracking.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? 'Link copied' : 'Copy link instead'}
              </Button>
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending invitation…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Send invitation email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
