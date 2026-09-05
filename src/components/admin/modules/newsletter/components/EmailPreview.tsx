/**
 * Newsletter Studio — inbox-style preview of a campaign.
 *
 * Renders the authored body (sanitized) inside an email-shaped frame with the
 * envelope the recipient will see, merge fields swapped for sample values.
 * Used by the composer, the campaign drill-down and the template library so
 * "what will this look like?" is answered the same way everywhere.
 */
import { useMemo, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { DEFAULT_FROM_NAME, NEWSLETTER_FROM_EMAIL, NEWSLETTER_REPLY_TO_EMAIL } from '../constants';
import { initials } from '../utils/format';
import { applySampleMergeFields, sanitizeEmailHtml } from '../utils/preview';

interface EmailPreviewProps {
  bodyHtml: string;
  subject: string;
  preheader?: string;
  fromName?: string;
  /** Show the desktop/mobile width toggle. */
  allowDeviceToggle?: boolean;
  /** Hide the envelope header and only render the body. */
  bodyOnly?: boolean;
  className?: string;
}

export function EmailPreview({
  bodyHtml,
  subject,
  preheader,
  fromName,
  allowDeviceToggle = false,
  bodyOnly = false,
  className,
}: EmailPreviewProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const sender = fromName?.trim() || DEFAULT_FROM_NAME;
  const displaySubject = applySampleMergeFields(subject.trim()) || 'Subject line';
  const displayPreheader = applySampleMergeFields(preheader?.trim() || '');
  const safeBody = useMemo(() => sanitizeEmailHtml(applySampleMergeFields(bodyHtml)), [bodyHtml]);
  const hasBody = safeBody.replace(/<[^>]*>/g, '').trim().length > 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {allowDeviceToggle ? (
        <div className="flex items-center justify-end gap-1">
          <DeviceButton
            active={device === 'desktop'}
            onClick={() => setDevice('desktop')}
            icon={Monitor}
            label="Desktop"
          />
          <DeviceButton
            active={device === 'mobile'}
            onClick={() => setDevice('mobile')}
            icon={Smartphone}
            label="Mobile"
          />
        </div>
      ) : null}

      <div
        className={cn(
          'mx-auto w-full overflow-hidden rounded-xl border border-border/70 bg-white text-gray-900 shadow-sm transition-[max-width] duration-300',
          device === 'mobile' ? 'max-w-[390px]' : 'max-w-full',
        )}
        data-testid="email-preview"
      >
        {!bodyOnly ? (
          <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">
                {initials(sender)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="truncate text-sm font-semibold">{sender}</p>
                  <p className="text-xs text-gray-500">{NEWSLETTER_FROM_EMAIL}</p>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-gray-900">
                  {displaySubject}
                </p>
                {displayPreheader ? (
                  <p className="truncate text-xs text-gray-500">{displayPreheader}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-gray-400">
                  reply-to {NEWSLETTER_REPLY_TO_EMAIL}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-[#f4f4f7] px-3 py-5 sm:px-6">
          <div className="mx-auto max-w-[600px] rounded-lg bg-white px-6 py-6 shadow-sm ring-1 ring-black/5">
            {hasBody ? (
              <div
                className={cn(
                  'text-[15px] leading-relaxed text-gray-800',
                  '[&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold',
                  '[&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold',
                  '[&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold',
                  '[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
                  '[&_a]:text-purple-700 [&_a]:underline',
                  '[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md',
                  '[&_table]:w-full [&_td]:p-1 [&_th]:p-1',
                  '[&_blockquote]:border-l-2 [&_blockquote]:border-purple-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600',
                )}
                // Sanitized admin-authored HTML with sample merge values.
                dangerouslySetInnerHTML={{ __html: safeBody }}
              />
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                Your email content will appear here.
              </p>
            )}
            <div className="mt-6 border-t border-dashed border-gray-200 pt-4 text-center text-[11px] leading-relaxed text-gray-400">
              Navigate Wealth branding, footer and a personal unsubscribe link are added
              automatically when the email is sent.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Monitor;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} preview`}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
        active ? 'bg-purple-600 text-white' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
