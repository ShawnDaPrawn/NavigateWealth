/**
 * Choosing when a scheduled article goes live, with its notify toggle.
 *
 * Split out of `ArticleEditor.tsx` (1,422 lines). Renders nothing while its
 * flag (`showScheduleDialog`) is false — the condition moved in with the markup.
 * Presentational: it owns no state.
 */
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Clock, Mail } from 'lucide-react';
import { DateTimeField } from '../components';

interface ScheduleDialogProps {
  handleScheduleConfirm: () => void | Promise<void>;
  isProcessing: boolean;
  notifyOnScheduledPublish: boolean;
  scheduledDate: string;
  setNotifyOnScheduledPublish: Dispatch<SetStateAction<boolean>>;
  setScheduledDate: Dispatch<SetStateAction<string>>;
  setShowScheduleDialog: Dispatch<SetStateAction<boolean>>;
  showScheduleDialog: boolean;
}

export function ScheduleDialog({
  handleScheduleConfirm,
  isProcessing,
  notifyOnScheduledPublish,
  scheduledDate,
  setNotifyOnScheduledPublish,
  setScheduledDate,
  setShowScheduleDialog,
  showScheduleDialog,
}: ScheduleDialogProps) {
  if (!showScheduleDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Schedule Publication</CardTitle>
          <CardDescription>Choose when this article should be published</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateTimeField
            label="Publication Date & Time"
            name="scheduled_publish_at"
            value={scheduledDate}
            onChange={setScheduledDate}
            required
            min={new Date().toISOString().slice(0, 16)}
          />

          {/* Notification Toggle for Scheduled Publish */}
          <div className="bg-gray-50 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnScheduledPublish}
                onChange={(e) => setNotifyOnScheduledPublish(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-purple-600" />
                  Notify newsletter subscribers on publish
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">
                  Automatically send an email notification to all confirmed subscribers when this
                  article is published on the scheduled date
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleScheduleConfirm} disabled={isProcessing || !scheduledDate}>
              <Clock className="h-4 w-4 mr-2" />
              {isProcessing ? 'Scheduling...' : 'Schedule'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
