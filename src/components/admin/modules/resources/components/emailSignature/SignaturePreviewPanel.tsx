/**
 * The right column: live preview, HTML source, copy and download.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import type { Dispatch, SetStateAction } from 'react';

import { Button } from '../../../../../ui/button';
import { DsButton } from '../../../../layout/page';
import { Check, Code, Copy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type SignatureData, TEMPLATES } from './signatureModel';

interface SignaturePreviewPanelProps {
  data: SignatureData;
  template: string;
  copied: boolean;
  showSource: boolean;
  setShowSource: Dispatch<SetStateAction<boolean>>;
  signatureHtml: string;
  onCopyHtml: () => void;
  onDownloadHtml: () => void;
  /** Opens the full email preview (RE-CI-Signatures puts it in the preview header). */
  onFullPreview?: () => void;
  isReady: boolean;
}

export function SignaturePreviewPanel({
  data,
  template,
  copied,
  showSource,
  setShowSource,
  signatureHtml,
  onCopyHtml,
  onDownloadHtml,
  onFullPreview,
  isReady,
}: SignaturePreviewPanelProps) {
  return (
    <div className="min-w-0">
      <div className="space-y-4 lg:sticky lg:top-4">
        {/* RE-CI-Signatures: the "Preview" card, actions in its header */}
        <section className="ds-card overflow-hidden">
          <div className="ds-card-h flex-wrap">
            <div>
              <h3>Preview</h3>
              <span className="ds-meta">
                {TEMPLATES.find((t) => t.id === template)?.name} template
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {onFullPreview && (
                <DsButton size="sm" onClick={onFullPreview} disabled={!isReady}>
                  Full email preview
                </DsButton>
              )}
              <DsButton size="sm" onClick={onDownloadHtml} disabled={!isReady}>
                Download .html
              </DsButton>
              <DsButton size="sm" variant="primary" onClick={onCopyHtml} disabled={!isReady}>
                {copied ? 'Copied' : 'Copy signature'}
              </DsButton>
            </div>
          </div>
          <div className="bg-[#fafafb]">
            <AnimatePresence mode="wait">
              <motion.div
                key={template}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                {isReady ? (
                  <div className="contents">
                    {/* Simulated email chrome */}
                    <div className="bg-muted/30 border-b px-5 py-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                        <span className="ml-3 text-[10px] text-muted-foreground font-mono">
                          New Message
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-10 shrink-0">From:</span>
                          <span className="font-medium text-foreground truncate">
                            {data.fullName} &lt;{data.email || 'email@navigatewealth.co'}&gt;
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-10 shrink-0">To:</span>
                          <span className="text-muted-foreground">client@example.com</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-10 shrink-0">Subj:</span>
                          <span className="text-foreground">Your Financial Plan Review</span>
                        </div>
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="px-5 py-5 bg-white">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-xs text-gray-400 space-y-2 mb-6"
                      >
                        <p>Dear Client,</p>
                        <p>
                          Thank you for our meeting earlier today. Please find your updated
                          financial plan attached for review.
                        </p>
                        <p>Kind regards,</p>
                      </motion.div>

                      <div className="border-t border-dashed border-gray-200 my-5" />

                      {/* Signature */}
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
                        dangerouslySetInnerHTML={{ __html: signatureHtml }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 px-6">
                    <span className="ds-meta">Enter a name to see the preview</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* HTML Source */}
        <section className="ds-card overflow-hidden">
          <button
            type="button"
            aria-expanded={showSource}
            className="flex w-full items-center justify-between px-4 py-3"
            onClick={() => setShowSource(!showSource)}
          >
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-nw-text-3" aria-hidden="true" />
              <span className="text-[13px] font-medium text-nw-text-2">HTML source</span>
            </div>
            <motion.svg
              animate={{ rotate: showSource ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="text-muted-foreground"
            >
              <path
                d="M3.5 5.25L7 8.75L10.5 5.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </button>
          <AnimatePresence>
            {showSource && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  <div className="relative">
                    <pre className="bg-gray-950 text-emerald-400 text-[10px] p-4 rounded-lg overflow-auto max-h-52 font-mono leading-relaxed">
                      {signatureHtml}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2 h-7 text-[10px]"
                      onClick={onCopyHtml}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
