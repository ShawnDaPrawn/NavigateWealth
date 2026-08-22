/**
 * The right column: live preview, HTML source, copy and download.
 *
 * Split out of `EmailSignatureGenerator.tsx` (1,640 lines). Presentational —
 * it owns no state; everything it needs arrives as a prop.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Check, Code, Copy, Download, Mail, Sparkles } from 'lucide-react';
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
  isReady,
}: SignaturePreviewPanelProps) {
  return (
    <div className="lg:col-span-3 space-y-4">
      <div className="sticky top-4 space-y-4">
        {/* Preview Card */}
        <Card className="overflow-hidden border-border">
          <CardHeader className="pb-3 bg-muted/40 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm">Live Preview</CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px] font-medium">
                {TEMPLATES.find((t) => t.id === template)?.name} Template
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                            {data.fullName} &lt;{data.email || 'email@navigatewealth.co.za'}&gt;
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
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    >
                      <div className="p-3 rounded-xl bg-purple-50 inline-flex">
                        <Mail className="h-8 w-8 text-purple-300" />
                      </div>
                    </motion.div>
                    <p className="text-sm font-medium text-muted-foreground mt-4">
                      Enter your name to see the preview
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Fill in the details on the left to generate your signature
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="bg-purple-600 hover:bg-purple-700 h-10"
            onClick={onCopyHtml}
            disabled={!isReady}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="copied"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Copied!
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="h-4 w-4" /> Copy HTML
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
          <Button variant="outline" className="h-10" onClick={onDownloadHtml} disabled={!isReady}>
            <Download className="h-4 w-4 mr-1.5" />
            Download .html
          </Button>
        </div>

        {/* HTML Source */}
        <Card>
          <button
            className="flex items-center justify-between w-full px-4 py-3"
            onClick={() => setShowSource(!showSource)}
          >
            <div className="flex items-center gap-2">
              <Code className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">View HTML Source</span>
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
        </Card>
      </div>
    </div>
  );
}
