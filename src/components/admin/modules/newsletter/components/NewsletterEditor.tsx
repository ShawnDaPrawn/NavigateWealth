/**
 * Newsletter — create a new one.
 *
 * One card, top to bottom: the PDF, a title, a short description, the
 * audiences. Saving creates the draft and then uploads the PDF; if the
 * upload fails the draft stays and the error shows inline, so the admin can
 * retry the file without retyping anything.
 */
import { useState } from 'react';
import { ArrowRight, Loader2, Upload } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { Textarea } from '../../../../ui/textarea';
import { DESCRIPTION_MAX_LENGTH, SUBSCRIBER_LIST_ID, TITLE_MAX_LENGTH } from '../constants';
import {
  useCreateCampaign,
  useStudioLists,
  useUploadCampaignPdf,
} from '../hooks/useNewsletterStudio';
import { currentIssueMonth } from '../utils/issueMonth';
import { AudiencePicker } from './AudiencePicker';
import { PdfDropzone } from './PdfDropzone';
import { SectionHeader } from './shared';

export function NewsletterEditor({
  onCreated,
  onCancel,
}: {
  /** Called with the new draft's id once it (and its PDF, when given) is stored. */
  onCreated: (campaignId: string) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listIds, setListIds] = useState<string[]>([SUBSCRIBER_LIST_ID]);
  const [issueMonth, setIssueMonth] = useState(currentIssueMonth);
  const [publishToWebsite, setPublishToWebsite] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const lists = useStudioLists();
  const create = useCreateCampaign();
  const upload = useUploadCampaignPdf();
  const pending = create.isPending || upload.isPending;

  const titleOk = title.trim().length > 0 && title.trim().length <= TITLE_MAX_LENGTH;
  const descriptionOk =
    description.trim().length > 0 && description.trim().length <= DESCRIPTION_MAX_LENGTH;
  // No audience requirement: a newsletter may be published on the website
  // without being emailed to anyone. The send actions enforce their own rule.
  const canSave = titleOk && descriptionOk && !pending;

  const save = async () => {
    setUploadError(null);
    let id = createdId;
    if (!id) {
      const draft = await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        listIds,
        issueMonth,
        publishToWebsite,
      });
      id = draft.id;
      setCreatedId(id);
    }
    if (file) {
      try {
        await upload.mutateAsync({ id, file });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'The PDF could not be uploaded.');
        return;
      }
    }
    onCreated(id);
  };

  return (
    <Card className="gap-0">
      <CardHeader className="pb-4">
        <SectionHeader
          icon={Upload}
          title="New newsletter"
          description="Upload the finished PDF, give it a title and a short introduction, and choose who receives it."
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Newsletter PDF</Label>
          <PdfDropzone
            stored={
              file
                ? {
                    storagePath: '',
                    fileName: file.name,
                    sizeBytes: file.size,
                    uploadedAt: new Date().toISOString(),
                  }
                : null
            }
            onSelect={(next) => {
              setFile(next);
              setUploadError(null);
            }}
            pending={upload.isPending}
            error={uploadError}
          />
          {!file ? (
            <p className="text-xs text-muted-foreground">
              You can also save a draft now and add the PDF later; nothing sends without one.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nl-title">Title</Label>
          <Input
            id="nl-title"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="September 2026 newsletter"
          />
          <p className="text-xs text-muted-foreground">
            Also the email subject line. {title.length}/{TITLE_MAX_LENGTH}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nl-description">Description</Label>
          <Textarea
            id="nl-description"
            value={description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Two or three sentences on what is inside this issue."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Shown in the email above the “Read the newsletter” button. {description.length}/
            {DESCRIPTION_MAX_LENGTH}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nl-issue-month">Issue month</Label>
          <Input
            id="nl-issue-month"
            type="month"
            value={issueMonth}
            onChange={(e) => setIssueMonth(e.target.value || currentIssueMonth())}
            className="sm:max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Which issue this is. Decides the year and month it files under on the website, so
            publishing September&rsquo;s issue in October still files it under September.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Audience</Label>
          <AudiencePicker
            lists={lists.data ?? []}
            loading={lists.isLoading}
            value={listIds}
            onChange={setListIds}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="nl-publish-website">Publish on the website</Label>
            <p className="text-xs text-muted-foreground">
              Add it to Resources → Newsletters once it has been sent. You can also publish it from
              the newsletter itself without emailing anyone.
            </p>
          </div>
          <Switch
            id="nl-publish-website"
            checked={publishToWebsite}
            onCheckedChange={setPublishToWebsite}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
            {createdId && uploadError ? 'Retry PDF upload' : 'Save draft and continue'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
