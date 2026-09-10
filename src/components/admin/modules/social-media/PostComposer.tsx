/**
 * PostComposer — a manual post, straight into Buffer.
 *
 * One post per selected channel. Images come from the AI generator (a private
 * storage path the server publishes for Buffer) or a public URL; a link
 * becomes a LinkedIn link card, goes into the text on X, and is ignored on
 * Instagram. Nothing is stored locally — the calendar shows Buffer's answer.
 */

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Eye,
  Link as LinkIcon,
  Plus,
  Save,
  Send,
  X,
} from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Calendar } from '../../../ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Checkbox } from '../../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Textarea } from '../../../ui/textarea';
import type { ComposeMode, ComposeRequest, ComposeResult, MediaFile, SocialProfile } from './types';
import { PLATFORM_LIMITS } from './types';
import { buildUTMUrl } from './utils';
import {
  buildComposeRequest,
  combineDateAndTime,
  composeBlocker,
  countForPlatform,
  effectiveTextFor,
} from './composerModel';

interface PostComposerProps {
  profiles: SocialProfile[];
  selectedProfiles: string[];
  onProfilesChange: (profileIds: string[]) => void;
  onSubmit: (request: ComposeRequest) => Promise<ComposeResult | null>;
  isSubmitting?: boolean;
  /** Pre-populate content from the AI generator */
  initialContent?: string;
  /** Pre-populate media from the AI image generator */
  initialMedia?: MediaFile[];
  /** Pre-populate hashtags from the AI generator (appended to content) */
  initialHashtags?: string[];
}

export function PostComposer({
  profiles,
  selectedProfiles,
  onProfilesChange,
  onSubmit,
  isSubmitting,
  initialContent,
  initialMedia,
  initialHashtags,
}: PostComposerProps) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [utm, setUtm] = useState({ source: 'social', medium: 'organic', campaign: '' });
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('07:30');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (initialContent) {
      const hashtagText = initialHashtags?.length
        ? '\n\n' + initialHashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')
        : '';
      setText(initialContent + hashtagText);
    }
  }, [initialContent, initialHashtags]);

  useEffect(() => {
    if (initialMedia?.length) {
      setMedia((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        return [...prev, ...initialMedia.filter((m) => !existing.has(m.id))];
      });
    }
  }, [initialMedia]);

  const connected = profiles.filter((p) => p.isConnected);
  const selected = connected.filter((p) => selectedProfiles.includes(p.id));
  const platforms = [...new Set(selected.map((p) => p.platform))];
  const draft = { text, channelIds: selectedProfiles, media, linkUrl, linkTitle };
  const blocker = composeBlocker(draft, profiles);

  const addImageUrl = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\/.+/.test(url)) return;
    setMedia((prev) => [
      ...prev,
      {
        id: `url_${Date.now()}`,
        url,
        type: 'image',
        filename: url.split('/').pop() || 'image',
        size: 0,
      },
    ]);
    setImageUrl('');
  };

  const applyUtm = () => {
    if (!linkUrl.trim()) return;
    setLinkUrl(buildUTMUrl(linkUrl.trim(), { ...utm, campaign: utm.campaign || 'social' }));
  };

  const reset = () => {
    setText('');
    setMedia([]);
    setLinkUrl('');
    setLinkTitle('');
    setScheduledDate(undefined);
  };

  const submit = async (mode: ComposeMode, at?: Date) => {
    const result = await onSubmit(buildComposeRequest(draft, mode, at));
    if (result && result.created.length > 0 && result.failed.length === 0) reset();
    return result;
  };

  const handleSchedule = async () => {
    if (!scheduledDate) return;
    const at = combineDateAndTime(scheduledDate, scheduledTime);
    if (at.getTime() <= Date.now()) return;
    const result = await submit('scheduled', at);
    if (result) setShowSchedule(false);
  };

  const busy = Boolean(isSubmitting);
  const canSubmit = !blocker && !busy;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
        </CardHeader>
        <CardContent>
          {connected.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connected Buffer channels. Connect them in Buffer, then refresh the Channels tab.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {connected.map((profile) => (
                <div key={profile.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`channel-${profile.id}`}
                    checked={selectedProfiles.includes(profile.id)}
                    onCheckedChange={(checked) =>
                      onProfilesChange(
                        checked
                          ? [...selectedProfiles, profile.id]
                          : selectedProfiles.filter((id) => id !== profile.id),
                      )
                    }
                  />
                  <Label htmlFor={`channel-${profile.id}`} className="text-sm font-medium">
                    {profile.name}
                    <span className="text-muted-foreground font-normal"> · {profile.platform}</span>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Post text</span>
            <div className="flex items-center gap-1.5">
              {platforms.map((platform) => {
                const count = countForPlatform(
                  effectiveTextFor({ text, linkUrl }, platform),
                  platform,
                );
                const limit = PLATFORM_LIMITS[platform]?.maxCharacters ?? 280;
                return (
                  <Badge key={platform} variant={count > limit ? 'destructive' : 'secondary'}>
                    {platform} {count}/{limit}
                  </Badge>
                );
              })}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            id="compose-text"
            aria-label="Post text"
            placeholder="What would you like to share?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[140px]"
          />
          {platforms.includes('x') && (
            <p className="text-xs text-muted-foreground">On X a link counts as 23 characters.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image &amp; link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {media.map((item) => (
                <div key={item.id} className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.type === 'image' && (
                      <img
                        src={item.url}
                        alt={item.alt || item.filename}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`Remove ${item.filename}`}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => setMedia((prev) => prev.filter((m) => m.id !== item.id))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="mt-1 text-xs text-muted-foreground truncate">{item.filename}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              aria-label="Image URL"
              placeholder="Add an image by public URL (or use the AI generator)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <Button variant="outline" onClick={addImageUrl} disabled={!imageUrl.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Instagram needs an image. LinkedIn shows a link card instead of the image when a link is
            set.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              aria-label="Link URL"
              placeholder="Link (LinkedIn card / appended on X)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Input
              aria-label="Link title"
              placeholder="Link title (optional)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              aria-label="UTM source"
              placeholder="UTM source"
              value={utm.source}
              onChange={(e) => setUtm({ ...utm, source: e.target.value })}
            />
            <Input
              aria-label="UTM medium"
              placeholder="UTM medium"
              value={utm.medium}
              onChange={(e) => setUtm({ ...utm, medium: e.target.value })}
            />
            <Input
              aria-label="UTM campaign"
              placeholder="UTM campaign"
              value={utm.campaign}
              onChange={(e) => setUtm({ ...utm, campaign: e.target.value })}
            />
            <Button variant="outline" onClick={applyUtm} disabled={!linkUrl.trim()}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Add UTM
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {blocker && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
              <AlertCircle className="h-4 w-4" />
              {blocker}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" disabled={!canSubmit} onClick={() => submit('draft')}>
                <Save className="h-4 w-4 mr-2" />
                Save as Buffer draft
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                disabled={!text.trim()}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!canSubmit} onClick={() => submit('queue')}>
                Add to queue
              </Button>
              <Button variant="outline" disabled={!canSubmit} onClick={() => setShowSchedule(true)}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button disabled={!canSubmit} onClick={() => submit('now')}>
                <Send className="h-4 w-4 mr-2" />
                {busy ? 'Sending…' : 'Publish now'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule in Buffer</DialogTitle>
            <DialogDescription>
              Choose the publish date and time (your local time).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={scheduledDate}
              onSelect={setScheduledDate}
              disabled={(date) => date < new Date(new Date().toDateString())}
              className="rounded-md border"
            />
            <div>
              <Label htmlFor="compose-time">Time</Label>
              <Input
                id="compose-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
            <Button onClick={handleSchedule} className="w-full" disabled={!scheduledDate || busy}>
              Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>How the text reads per selected channel.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue={platforms[0] ?? 'text'}>
            <TabsList>
              {platforms.map((platform) => (
                <TabsTrigger key={platform} value={platform} className="capitalize">
                  {platform}
                </TabsTrigger>
              ))}
              {platforms.length === 0 && <TabsTrigger value="text">Text</TabsTrigger>}
            </TabsList>
            {(platforms.length ? platforms : ['text']).map((platform) => (
              <TabsContent key={platform} value={platform} className="mt-4">
                <div className="border rounded-lg p-4 bg-white space-y-3">
                  <div className="whitespace-pre-wrap text-sm">
                    {platform === 'x' && linkUrl && !text.includes(linkUrl)
                      ? `${text}\n${linkUrl}`
                      : text}
                  </div>
                  {media.length > 0 && platform !== 'text' && (
                    <div className="grid grid-cols-2 gap-2">
                      {media.slice(0, 2).map((item) => (
                        <img
                          key={item.id}
                          src={item.url}
                          alt={item.alt || item.filename}
                          className="aspect-square rounded object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {linkUrl && platform === 'linkedin' && (
                    <div className="p-2 border rounded bg-muted/20 text-xs">
                      <div className="font-medium">{linkTitle || 'Link card'}</div>
                      <div className="text-muted-foreground">{linkUrl}</div>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
