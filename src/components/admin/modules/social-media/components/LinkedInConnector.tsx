/**
 * LinkedIn Connector Component
 *
 * Handles the real LinkedIn OAuth 2.0 connection flow:
 * 1. Checks current connection status on mount
 * 2. Initiates OAuth redirect when user clicks "Connect"
 * 3. Provides disconnect functionality
 * 4. Allows sharing text, articles, and images to LinkedIn
 *
 * The OAuth callback (code exchange) is handled by LinkedInCallbackPage.tsx
 * at /auth/linkedin/callback — this component only initiates the redirect.
 *
 * Follows admin panel stat-card & status-indicator standards (§8.3).
 *
 * @module social-media/components/LinkedInConnector
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { toast } from 'sonner@2.0.3';
import {
  Linkedin,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Unlink,
  Send,
  Link as LinkIcon,
  Image as ImageIcon,
  FileText,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';
import { linkedinApi } from '../api';
import type { LinkedInConnectionStatus } from '../api';
import { BRAND } from '../constants';

// ============================================================================
// Types
// ============================================================================

interface LinkedInConnectorProps {
  /** Optional callback when connection status changes */
  onStatusChange?: (connected: boolean) => void;
}

type ShareType = 'text' | 'article' | 'image';
type Visibility = 'PUBLIC' | 'CONNECTIONS';

// ============================================================================
// Constants (config-driven per §5.3)
// ============================================================================

const LINKEDIN_BLUE = '#0A66C2';
const CHARACTER_LIMIT = 3000;

const SHARE_TYPE_OPTIONS: { type: ShareType; icon: typeof FileText; label: string }[] = [
  { type: 'text', icon: FileText, label: 'Text' },
  { type: 'article', icon: LinkIcon, label: 'Article / URL' },
  { type: 'image', icon: ImageIcon, label: 'Image' },
];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(iso?: string): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntilExpiry(iso?: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ============================================================================
// Component
// ============================================================================

export function LinkedInConnector({ onStatusChange }: LinkedInConnectorProps) {
  // Connection state
  const [status, setStatus] = useState<LinkedInConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Share dialog state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareType, setShareType] = useState<ShareType>('text');
  const [shareText, setShareText] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [shareVisibility, setShareVisibility] = useState<Visibility>('PUBLIC');
  const [isSharing, setIsSharing] = useState(false);

  // --------------------------------------------------------------------------
  // Fetch status on mount
  // --------------------------------------------------------------------------

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await linkedinApi.getStatus();
      if (res.success && res.data) {
        setStatus(res.data);
        onStatusChange?.(res.data.connected);
      } else {
        setStatus({ connected: false });
        onStatusChange?.(false);
      }
    } catch (error) {
      console.error('Failed to fetch LinkedIn status:', error);
      setStatus({ connected: false });
      onStatusChange?.(false);
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // OAuth Flow
  // --------------------------------------------------------------------------

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/auth/linkedin/callback`;
      const res = await linkedinApi.getAuthUrl(redirectUri);
      if (res.success && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        toast.error(res.error || 'Failed to initiate LinkedIn connection');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('LinkedIn connect error:', error);
      toast.error('Failed to initiate LinkedIn connection. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await linkedinApi.disconnect();
      if (res.success) {
        setStatus({ connected: false });
        onStatusChange?.(false);
        toast.success('LinkedIn disconnected successfully');
      } else {
        toast.error(res.error || 'Failed to disconnect LinkedIn');
      }
    } catch (error) {
      console.error('LinkedIn disconnect error:', error);
      toast.error('Failed to disconnect LinkedIn. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Share
  // --------------------------------------------------------------------------

  const resetShareForm = () => {
    setShareText('');
    setShareUrl('');
    setShareTitle('');
    setShareDescription('');
    setShareImageUrl('');
    setShareVisibility('PUBLIC');
    setShareType('text');
  };

  const handleShare = async () => {
    if (!shareText.trim()) {
      toast.error('Post text is required');
      return;
    }

    setIsSharing(true);
    try {
      let res;

      switch (shareType) {
        case 'text':
          res = await linkedinApi.shareText(shareText, shareVisibility);
          break;
        case 'article':
          if (!shareUrl.trim()) {
            toast.error('URL is required for article shares');
            setIsSharing(false);
            return;
          }
          res = await linkedinApi.shareArticle(
            shareText,
            shareUrl,
            shareTitle || undefined,
            shareDescription || undefined,
            shareVisibility,
          );
          break;
        case 'image':
          if (!shareImageUrl.trim()) {
            toast.error('Image URL is required for image shares');
            setIsSharing(false);
            return;
          }
          res = await linkedinApi.shareImage(
            shareText,
            shareImageUrl,
            shareTitle || undefined,
            shareDescription || undefined,
            shareVisibility,
          );
          break;
      }

      if (res?.success) {
        toast.success('Successfully shared on LinkedIn!');
        setShowShareDialog(false);
        resetShareForm();
      } else {
        toast.error(res?.error || 'Failed to share on LinkedIn');
      }
    } catch (error) {
      console.error('LinkedIn share error:', error);
      toast.error('Failed to share on LinkedIn. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  // --------------------------------------------------------------------------
  // Derived
  // --------------------------------------------------------------------------

  const characterCount = shareText.length;
  const isOverLimit = characterCount > CHARACTER_LIMIT;
  const expiryDays = daysUntilExpiry(status?.expiresAt);

  // --------------------------------------------------------------------------
  // Render: Loading skeleton
  // --------------------------------------------------------------------------

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2.5 text-sm text-muted-foreground">
            Checking LinkedIn connection…
          </span>
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Connected state
  // --------------------------------------------------------------------------

  if (status?.connected) {
    return (
      <div className="contents">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-xl text-white"
                style={{ backgroundColor: LINKEDIN_BLUE }}
              >
                <Linkedin className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">LinkedIn Integration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share content with your professional network via OAuth 2.0
                </p>
              </div>
            </div>

            <Badge className="bg-green-600 hover:bg-green-700 text-white text-[11px] flex items-center gap-1 px-2.5">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {/* Profile row */}
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-50 border">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex items-center justify-center h-9 w-9 rounded-lg text-white shrink-0"
                  style={{ backgroundColor: BRAND.navy }}
                >
                  <span className="text-sm font-semibold">
                    {(status.profileName || 'L').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {status.profileName || 'LinkedIn User'}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(status.connectedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {expiryDays !== null
                        ? expiryDays > 7
                          ? `Expires in ${expiryDays}d`
                          : expiryDays > 0
                            ? `Expires in ${expiryDays}d — renew soon`
                            : 'Token expired'
                        : `Expires ${formatDate(status.expiresAt)}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setShowShareDialog(true)}
                  className="flex items-center gap-1.5 h-8 text-xs text-white"
                  style={{ backgroundColor: LINKEDIN_BLUE }}
                >
                  <Send className="h-3 w-3" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={fetchStatus}
                  title="Refresh connection status"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  title="Disconnect LinkedIn"
                >
                  {isDisconnecting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Rate limit notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/80 border border-blue-100 text-xs text-blue-700">
              <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Rate Limits:</strong> 150 share requests per member/day · 100,000 per
                application/day.
              </span>
            </div>

            {/* Token expiry warning */}
            {expiryDays !== null && expiryDays <= 7 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  {expiryDays > 0
                    ? `Your LinkedIn access token expires in ${expiryDays} day${expiryDays !== 1 ? 's' : ''}. Reconnect to refresh it.`
                    : 'Your LinkedIn access token has expired. Please reconnect to continue sharing.'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Share Dialog */}
        {renderShareDialog()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Disconnected state
  // --------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-10 w-10 rounded-xl text-white"
            style={{ backgroundColor: LINKEDIN_BLUE }}
          >
            <Linkedin className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">LinkedIn Integration</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect via OAuth 2.0 to share posts, articles, and images
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-[11px] flex items-center gap-1 px-2.5">
          <AlertCircle className="h-3 w-3" />
          Not Connected
        </Badge>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-col items-center text-center py-6 border rounded-lg border-dashed bg-gray-50/50">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ backgroundColor: `${LINKEDIN_BLUE}15` }}
          >
            <Linkedin className="h-7 w-7" style={{ color: LINKEDIN_BLUE }} />
          </div>

          <h3 className="font-medium text-sm text-gray-900">
            Connect Your LinkedIn Account
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Share text posts, articles with links, and branded images directly to your LinkedIn
            feed from the Navigate Wealth admin panel.
          </p>

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="mt-4 flex items-center gap-2 text-white"
            style={{ backgroundColor: LINKEDIN_BLUE }}
          >
            {isConnecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {isConnecting ? 'Redirecting…' : 'Connect with LinkedIn'}
          </Button>

          <p className="text-[10px] text-muted-foreground mt-3">
            Requires the{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">w_member_social</code>{' '}
            permission via LinkedIn's "Share on LinkedIn" product.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // --------------------------------------------------------------------------
  // Share Dialog (extracted for readability)
  // --------------------------------------------------------------------------

  function renderShareDialog() {
    return (
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div
                className="flex items-center justify-center h-7 w-7 rounded-md text-white"
                style={{ backgroundColor: LINKEDIN_BLUE }}
              >
                <Linkedin className="h-3.5 w-3.5" />
              </div>
              Share on LinkedIn
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create and publish a post to your LinkedIn profile
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {/* Share type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Post Type</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {SHARE_TYPE_OPTIONS.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setShareType(type)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      shareType === type
                        ? 'border-[#0A66C2] bg-[#0A66C2]/5 text-[#0A66C2]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Post text */}
            <div className="space-y-1.5">
              <Label htmlFor="share-text" className="text-xs font-medium">
                Post Text <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="share-text"
                value={shareText}
                onChange={(e) => setShareText(e.target.value)}
                placeholder="Write your LinkedIn post…"
                rows={4}
                className="resize-none text-sm"
              />
              <div
                className={`text-[10px] text-right ${
                  isOverLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'
                }`}
              >
                {characterCount.toLocaleString()} / {CHARACTER_LIMIT.toLocaleString()}
              </div>
            </div>

            {/* Article-specific fields */}
            {shareType === 'article' && (
              <div className="space-y-3 p-3 rounded-lg bg-gray-50 border">
                <div className="space-y-1.5">
                  <Label htmlFor="share-url" className="text-xs font-medium">
                    URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="share-url"
                    value={shareUrl}
                    onChange={(e) => setShareUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    type="url"
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="share-title" className="text-xs font-medium">
                      Title
                    </Label>
                    <Input
                      id="share-title"
                      value={shareTitle}
                      onChange={(e) => setShareTitle(e.target.value)}
                      placeholder="Article title"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="share-desc" className="text-xs font-medium">
                      Description
                    </Label>
                    <Input
                      id="share-desc"
                      value={shareDescription}
                      onChange={(e) => setShareDescription(e.target.value)}
                      placeholder="Brief description"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Image-specific fields */}
            {shareType === 'image' && (
              <div className="space-y-3 p-3 rounded-lg bg-gray-50 border">
                <div className="space-y-1.5">
                  <Label htmlFor="share-image-url" className="text-xs font-medium">
                    Image URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="share-image-url"
                    value={shareImageUrl}
                    onChange={(e) => setShareImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    type="url"
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The server will download and upload the image to LinkedIn on your behalf.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="share-img-title" className="text-xs font-medium">
                      Title
                    </Label>
                    <Input
                      id="share-img-title"
                      value={shareTitle}
                      onChange={(e) => setShareTitle(e.target.value)}
                      placeholder="Image title"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="share-img-desc" className="text-xs font-medium">
                      Alt Text
                    </Label>
                    <Input
                      id="share-img-desc"
                      value={shareDescription}
                      onChange={(e) => setShareDescription(e.target.value)}
                      placeholder="Describe the image"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visibility */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Visibility</Label>
              <Select
                value={shareVisibility}
                onValueChange={(v) => setShareVisibility(v as Visibility)}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public — Anyone on LinkedIn</SelectItem>
                  <SelectItem value="CONNECTIONS">Connections Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShareDialog(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={isSharing || isOverLimit || !shareText.trim()}
              className="flex items-center gap-1.5 text-white"
              style={{ backgroundColor: LINKEDIN_BLUE }}
            >
              {isSharing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isSharing ? 'Publishing…' : 'Publish to LinkedIn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
