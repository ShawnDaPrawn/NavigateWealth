/**
 * The publish confirmation and progress dialog: confirm, notify toggle, and the live campaign progress.
 *
 * Split out of `ArticleEditor.tsx` (1,422 lines). Renders nothing while its
 * flag (`showPublishDialog`) is false — the condition moved in with the markup.
 * Presentational: it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import { Loader2, CheckCircle, Mail, Sparkles } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { ArticleNotificationCampaign, ArticleNotificationJob } from '../types';

interface PublishProgressDialogProps {
  activePublishFailedCount: number;
  activePublishLastError: string | null;
  activePublishPendingCount: number;
  activePublishProcessedCount: number;
  activePublishProgressPercent: number;
  activePublishRecipientCount: number;
  activePublishSentCount: number;
  activePublishStatus: string | null;
  closePublishDialog: (navigateBack: boolean) => void;
  handlePublishConfirm: () => void | Promise<void>;
  isEditMode: boolean;
  isPublishingNow: boolean;
  notifySubscribers: boolean;
  publishActivityStep: 'preparing' | 'saving' | 'publishing' | 'queueing';
  publishCampaign: ArticleNotificationCampaign | null;
  publishDialogBusy: boolean;
  publishInFlight: boolean;
  publishJob: ArticleNotificationJob | null;
  setNotifySubscribers: Dispatch<SetStateAction<boolean>>;
  showPublishDialog: boolean;
}

export function PublishProgressDialog({
  activePublishFailedCount,
  activePublishLastError,
  activePublishPendingCount,
  activePublishProcessedCount,
  activePublishProgressPercent,
  activePublishRecipientCount,
  activePublishSentCount,
  activePublishStatus,
  closePublishDialog,
  handlePublishConfirm,
  isEditMode,
  isPublishingNow,
  notifySubscribers,
  publishActivityStep,
  publishCampaign,
  publishDialogBusy,
  publishInFlight,
  publishJob,
  setNotifySubscribers,
  showPublishDialog,
}: PublishProgressDialogProps) {
  if (!showPublishDialog) return null;

  return (
    <div className="contents">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={
          !publishDialogBusy && !publishCampaign && !publishJob
            ? () => closePublishDialog(false)
            : undefined
        }
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-dialog-title"
        aria-describedby="publish-dialog-description"
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {isPublishingNow && !publishCampaign && !publishJob ? (
            <>
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>

              <h3 id="publish-dialog-title" className="text-xl mb-2 text-gray-900">
                Publishing Article
              </h3>
              <p id="publish-dialog-description" className="text-gray-600 mb-5">
                Please keep this window open while we prepare the article, publish it live, and
                queue newsletter delivery.
              </p>

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-950">Live publish activity</p>
                    <p className="text-xs text-blue-700 mt-1">
                      This can take a moment while the newsletter audience is prepared.
                    </p>
                  </div>
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </div>

                <Progress
                  value={
                    publishActivityStep === 'preparing'
                      ? 20
                      : publishActivityStep === 'saving'
                        ? 45
                        : publishActivityStep === 'publishing'
                          ? 70
                          : 90
                  }
                  className="h-2.5"
                  indicatorClassName="bg-blue-600"
                />

                <div className="space-y-2">
                  <PublishActivityRow
                    label="Preparing publish request"
                    status={publishActivityStep === 'preparing' ? 'active' : 'done'}
                  />
                  <PublishActivityRow
                    label={isEditMode ? 'Saving latest article changes' : 'Creating article record'}
                    status={
                      publishActivityStep === 'saving'
                        ? 'active'
                        : publishActivityStep === 'publishing' || publishActivityStep === 'queueing'
                          ? 'done'
                          : 'pending'
                    }
                  />
                  <PublishActivityRow
                    label="Publishing article to the website"
                    status={
                      publishActivityStep === 'publishing'
                        ? 'active'
                        : publishActivityStep === 'queueing'
                          ? 'done'
                          : 'pending'
                    }
                  />
                  <PublishActivityRow
                    label={
                      notifySubscribers ? 'Queueing newsletter delivery' : 'Finalizing publish'
                    }
                    status={publishActivityStep === 'queueing' ? 'active' : 'pending'}
                  />
                </div>
              </div>
            </>
          ) : !publishCampaign && !publishJob ? (
            <>
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>

              <h3 id="publish-dialog-title" className="text-xl mb-2 text-gray-900">
                Publish Article
              </h3>
              <p id="publish-dialog-description" className="text-gray-600 mb-4">
                Are you sure you want to publish this article? It will be immediately visible to all
                users.
              </p>

              <div className="bg-gray-50 rounded-lg p-3 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifySubscribers}
                    onChange={(e) => setNotifySubscribers(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-purple-600" />
                      Notify newsletter subscribers
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5">
                      Send an email notification to all confirmed subscribers with a link to this
                      article
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => closePublishDialog(false)}
                  disabled={publishDialogBusy}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handlePublishConfirm}
                  disabled={publishDialogBusy}
                >
                  {publishDialogBusy ? 'Publishing...' : 'Publish Now'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 id="publish-dialog-title" className="text-xl text-gray-900">
                    {publishInFlight ? 'Publishing And Sending' : 'Publish Delivery Summary'}
                  </h3>
                  <p id="publish-dialog-description" className="text-sm text-gray-600 mt-1">
                    {publishInFlight
                      ? 'The article is live and newsletter delivery is progressing in the queued sender.'
                      : activePublishStatus === 'queue_failed'
                        ? 'The article is live, but the newsletter campaign could not be queued.'
                        : activePublishStatus === 'no_recipients'
                          ? 'The article is live, and no eligible newsletter recipients were found for this send.'
                          : 'The article is live and the queued newsletter delivery has finished its current run.'}
                  </p>
                </div>
                <Badge
                  className={cn(
                    activePublishStatus === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : activePublishStatus === 'completed_with_failures'
                        ? 'bg-amber-100 text-amber-800'
                        : activePublishStatus === 'queue_failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700',
                  )}
                >
                  {(activePublishStatus || 'queued').replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Newsletter progress</span>
                    <span className="font-medium text-gray-900">
                      {activePublishProcessedCount} / {activePublishRecipientCount}
                    </span>
                  </div>
                  <Progress
                    value={activePublishProgressPercent}
                    className="h-2.5"
                    indicatorClassName="bg-green-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-gray-500">Recipients</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {activePublishRecipientCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-gray-500">Remaining</p>
                    <p className="text-lg font-semibold text-amber-700">
                      {activePublishPendingCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-gray-500">Sent</p>
                    <p className="text-lg font-semibold text-green-700">{activePublishSentCount}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-gray-500">Failed</p>
                    <p className="text-lg font-semibold text-red-700">{activePublishFailedCount}</p>
                  </div>
                </div>

                {activePublishLastError &&
                  (activePublishFailedCount > 0 || activePublishStatus === 'queue_failed') && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs font-medium text-amber-900">Latest delivery issue</p>
                      <p className="text-xs text-amber-800 mt-1">{activePublishLastError}</p>
                    </div>
                  )}
              </div>

              <div className="flex gap-3 justify-end mt-6">
                {publishInFlight ? (
                  <Button variant="outline" onClick={() => closePublishDialog(true)}>
                    Continue in Background
                  </Button>
                ) : (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => closePublishDialog(true)}
                  >
                    Done
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PublishActivityRow({
  label,
  status,
}: {
  label: string;
  status: 'pending' | 'active' | 'done';
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/80 border border-blue-100 px-3 py-2">
      {status === 'done' ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : status === 'active' ? (
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-slate-300 bg-slate-100" />
      )}
      <span
        className={cn(
          'text-sm',
          status === 'active'
            ? 'text-blue-950 font-medium'
            : status === 'done'
              ? 'text-slate-800'
              : 'text-slate-500',
        )}
      >
        {label}
      </span>
    </div>
  );
}
