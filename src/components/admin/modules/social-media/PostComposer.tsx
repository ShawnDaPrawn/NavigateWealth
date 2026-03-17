import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Badge } from '../../../ui/badge';
import { Checkbox } from '../../../ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog';
import { Calendar } from '../../../ui/calendar';
import { toast } from 'sonner@2.0.3';
import { 
  Upload, 
  X, 
  Image, 
  Video, 
  Link, 
  Calendar as CalendarIcon,
  Clock,
  Send,
  Save,
  Eye,
  Hash,
  AtSign,
  Sparkles,
  Zap,
  Globe,
  Target,
  AlertCircle
} from 'lucide-react';
import { SocialProfile, SocialPlatform, MediaFile, PostLink, UTMParameters, PLATFORM_LIMITS } from './types';
import { campaignsApi } from './api';

/** Data shape for composing a new post */
interface ComposedPostData {
  content: string;
  selectedProfiles: string[];
  media: MediaFile[];
  link?: PostLink;
  utm?: UTMParameters;
  campaignId?: string;
  [key: string]: unknown;
}

interface PostComposerProps {
  profiles: SocialProfile[];
  selectedProfiles: string[];
  onProfilesChange: (profileIds: string[]) => void;
  onSave: (post: ComposedPostData) => void;
  onSchedule: (post: ComposedPostData, scheduledAt: Date) => void;
  onPublish: (post: ComposedPostData) => void;
  /** Pre-populate content from AI generator */
  initialContent?: string;
  /** Pre-populate media from AI image generator */
  initialMedia?: MediaFile[];
  /** Pre-populate hashtags from AI generator (appended to content) */
  initialHashtags?: string[];
}

export function PostComposer({
  profiles,
  selectedProfiles,
  onProfilesChange,
  onSave,
  onSchedule,
  onPublish,
  initialContent,
  initialMedia,
  initialHashtags,
}: PostComposerProps) {
  const [postContent, setPostContent] = useState('');

  // Fetch campaigns from backend (replaces inline mockCampaigns)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await campaignsApi.getAll();
        if (response.success && response.data) {
          setCampaigns(response.data.map(c => ({ id: c.id, name: c.name })));
        }
      } catch (err) {
        console.error('PostComposer: Failed to fetch campaigns', err);
      }
    };
    fetchCampaigns();
  }, []);

  const [firstComment, setFirstComment] = useState('');
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [link, setLink] = useState<PostLink | null>(null);
  const [campaign, setCampaign] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [utmParams, setUtmParams] = useState<UTMParameters>({
    source: 'social',
    medium: 'organic',
    campaign: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply initial values from AI generator when they change
  useEffect(() => {
    if (initialContent) {
      const hashtagText = initialHashtags && initialHashtags.length > 0
        ? '\n\n' + initialHashtags.map((h) => `#${h}`).join(' ')
        : '';
      setPostContent(initialContent + hashtagText);
    }
  }, [initialContent, initialHashtags]);

  useEffect(() => {
    if (initialMedia && initialMedia.length > 0) {
      setMedia((prev) => {
        // Avoid duplicates by checking IDs
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = initialMedia.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
    }
  }, [initialMedia]);

  // Get selected platform types
  const selectedPlatformTypes = profiles
    .filter(p => selectedProfiles.includes(p.id) && p.isConnected)
    .map(p => p.platform);

  // Calculate character limits
  const minCharLimit = selectedPlatformTypes.length > 0 
    ? Math.min(...selectedPlatformTypes.map(p => PLATFORM_LIMITS[p].maxCharacters))
    : 280;

  const hasInstagram = selectedPlatformTypes.includes('instagram');

  useEffect(() => {
    if (campaign && !utmParams.campaign) {
      setUtmParams(prev => ({ ...prev, campaign }));
    }
  }, [campaign, utmParams.campaign]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        toast.error(`${file.name}: Only images and videos are supported`);
        return;
      }

      // Create media file object
      const mediaFile: MediaFile = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: URL.createObjectURL(file),
        type: isImage ? 'image' : 'video',
        filename: file.name,
        size: file.size,
      };

      setMedia(prev => [...prev, mediaFile]);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (mediaId: string) => {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
  };

  const handleLinkAdd = () => {
    if (!linkUrl.trim()) return;

    const newLink: PostLink = {
      url: linkUrl,
      utm: { ...utmParams },
    };

    setLink(newLink);
  };

  const handleSave = () => {
    const post: ComposedPostData = {
      content: postContent,
      selectedProfiles,
      media,
      link,
      utm: utmParams,
      campaignId: campaign,
      tags,
      status: 'draft',
    };

    onSave(post);
    toast.success('Post saved as draft');
  };

  const handleSchedule = () => {
    if (!scheduledDate) {
      toast.error('Please select a date and time');
      return;
    }

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = new Date(scheduledDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const post: ComposedPostData = {
      content: postContent,
      selectedProfiles,
      media,
      link,
      utm: utmParams,
      campaignId: campaign,
      tags,
    };

    onSchedule(post, scheduledAt);
    setShowScheduleDialog(false);
    toast.success(`Post scheduled for ${scheduledAt.toLocaleString()}`);
  };

  const handlePublish = () => {
    const post: ComposedPostData = {
      content: postContent,
      selectedProfiles,
      media,
      link,
      utm: utmParams,
      campaignId: campaign,
      tags,
    };

    onPublish(post);
    toast.success('Post published successfully');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCharacterCount = () => postContent.length;
  const isOverLimit = () => getCharacterCount() > minCharLimit;

  const canPost = () => {
    return selectedProfiles.length > 0 && 
           postContent.trim().length > 0 && 
           !isOverLimit();
  };

  return (
    <div className="space-y-6">
      {/* Platform Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {profiles.filter(p => p.isConnected).map((profile) => (
              <div key={profile.id} className="flex items-center space-x-2">
                <Checkbox
                  id={profile.id}
                  checked={selectedProfiles.includes(profile.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onProfilesChange([...selectedProfiles, profile.id]);
                    } else {
                      onProfilesChange(selectedProfiles.filter(id => id !== profile.id));
                    }
                  }}
                />
                <Label htmlFor={profile.id} className="text-sm font-medium">
                  {profile.name}
                </Label>
              </div>
            ))}
          </div>
          
          {selectedProfiles.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              Character limit: {minCharLimit} characters (lowest among selected platforms)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Post Content</span>
            <div className="flex items-center gap-2">
              <Badge variant={isOverLimit() ? "destructive" : "secondary"}>
                {getCharacterCount()}/{minCharLimit}
              </Badge>
              <Button variant="ghost" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Assist
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="content">Message</Label>
            <Textarea
              id="content"
              placeholder="What would you like to share?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="min-h-[120px] mt-1"
            />
            {isOverLimit() && (
              <div className="mt-2 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Message is too long for selected platforms
              </div>
            )}
          </div>

          {/* Instagram First Comment */}
          {hasInstagram && (
            <div>
              <Label htmlFor="first-comment">First Comment (Instagram)</Label>
              <Textarea
                id="first-comment"
                placeholder="Add hashtags and additional details..."
                value={firstComment}
                onChange={(e) => setFirstComment(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm">
              <Hash className="h-4 w-4 mr-1" />
              Add Hashtags
            </Button>
            <Button variant="ghost" size="sm">
              <AtSign className="h-4 w-4 mr-1" />
              Mention
            </Button>
            <Button variant="ghost" size="sm">
              <Zap className="h-4 w-4 mr-1" />
              Emojis
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Media & Links */}
      <Card>
        <CardHeader>
          <CardTitle>Media & Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Media Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Media
            </Button>
          </div>

          {/* Media Preview */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {media.map((item) => (
                <div key={item.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.filename || 'Media preview'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => removeMedia(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <div className="mt-1 text-xs text-muted-foreground truncate">
                    {item.filename}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link Addition */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add a link..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleLinkAdd}>
                <Link className="h-4 w-4 mr-2" />
                Add Link
              </Button>
            </div>

            {/* UTM Parameters */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input
                placeholder="UTM Source"
                value={utmParams.source}
                onChange={(e) => setUtmParams(prev => ({ ...prev, source: e.target.value }))}
              />
              <Input
                placeholder="UTM Medium"
                value={utmParams.medium}
                onChange={(e) => setUtmParams(prev => ({ ...prev, medium: e.target.value }))}
              />
              <Input
                placeholder="UTM Campaign"
                value={utmParams.campaign}
                onChange={(e) => setUtmParams(prev => ({ ...prev, campaign: e.target.value }))}
              />
            </div>

            {link && (
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Link Preview</div>
                    <div className="text-xs text-muted-foreground">{link.url}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLink(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Campaign & Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="campaign">Campaign</Label>
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Select or create campaign..." />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((camp) => (
                  <SelectItem key={camp.id} value={camp.id}>
                    {camp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tags</Label>
            <Input
              placeholder="Add tags (comma separated)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.currentTarget.value.trim();
                  if (value && !tags.includes(value)) {
                    setTags([...tags, value]);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>

            <div className="flex gap-2">
              <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={!canPost()}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Post</DialogTitle>
                    <DialogDescription>
                      Choose when you want this post to be published
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Date</Label>
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                        className="rounded-md border"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleSchedule} className="w-full">
                      Schedule Post
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handlePublish} disabled={!canPost()}>
                <Send className="h-4 w-4 mr-2" />
                Publish Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post Preview</DialogTitle>
            <DialogDescription>
              See how your post will appear on selected platforms
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue={selectedPlatformTypes[0]} className="mt-4">
            <TabsList>
              {selectedPlatformTypes.map((platform) => (
                <TabsTrigger key={platform} value={platform} className="capitalize">
                  {platform}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {selectedPlatformTypes.map((platform) => (
              <TabsContent key={platform} value={platform} className="mt-4">
                <div className="border rounded-lg p-4 bg-white">
                  <div className="font-medium mb-2 capitalize">{platform} Preview</div>
                  <div className="whitespace-pre-wrap">{postContent}</div>
                  
                  {platform === 'instagram' && firstComment && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-sm text-muted-foreground mb-1">First Comment:</div>
                      <div className="text-sm">{firstComment}</div>
                    </div>
                  )}
                  
                  {media.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {media.slice(0, 4).map((item) => (
                        <div key={item.id} className="aspect-square rounded bg-muted">
                          {item.type === 'image' ? (
                            <img
                              src={item.url}
                              alt={item.filename || 'Media preview'}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {link && (
                    <div className="mt-3 p-2 border rounded bg-muted/20">
                      <div className="text-xs text-muted-foreground">Link:</div>
                      <div className="text-sm">{link.url}</div>
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