/**
 * Buffer Connector — Connected Profiles tab
 *
 * Connects Navigate Wealth's Social Media module to Buffer so Instagram,
 * Facebook, LinkedIn, and X can be scheduled from one queue.
 *
 * @module social-media/components/BufferConnector
 */

import { useMemo, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Layers,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Unlink,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useBuffer } from '../hooks/useBuffer';
import { BRAND } from '../constants';
import type { BufferShareMode } from '../api/bufferApi';

const BUFFER_BLUE = '#2C4BFF';
const BUFFER_API_SETTINGS = 'https://publish.buffer.com/settings/api';

function formatDueAt(iso?: string): string {
  if (!iso) return 'Unscheduled';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function serviceLabel(service: string): string {
  const value = service.toLowerCase();
  if (value === 'twitter' || value === 'x') return 'X';
  if (value === 'linkedin') return 'LinkedIn';
  if (value === 'instagram') return 'Instagram';
  if (value === 'facebook') return 'Facebook';
  return service.charAt(0).toUpperCase() + service.slice(1);
}

export function BufferConnector() {
  const {
    status,
    statusLoading,
    channels,
    posts,
    connect,
    isConnecting,
    disconnect,
    isDisconnecting,
    createPost,
    isCreating,
    refresh,
  } = useBuffer();

  const [apiKey, setApiKey] = useState('');
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [postText, setPostText] = useState('');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [mode, setMode] = useState<BufferShareMode>('addToQueue');
  const [dueAtLocal, setDueAtLocal] = useState('');

  const connectedChannels = useMemo(
    () => channels.filter((channel) => !channel.isDisconnected),
    [channels],
  );

  const handleConnect = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    await connect({ apiKey: trimmed });
    setApiKey('');
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || selectedChannelIds.length === 0) return;
    const dueAt =
      mode === 'customScheduled' && dueAtLocal ? new Date(dueAtLocal).toISOString() : undefined;
    await createPost({
      channelIds: selectedChannelIds,
      text: postText.trim(),
      mode,
      dueAt,
    });
    setShowPostDialog(false);
    setPostText('');
    setSelectedChannelIds([]);
    setMode('addToQueue');
    setDueAtLocal('');
  };

  const toggleChannel = (id: string) => {
    setSelectedChannelIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2.5 text-sm text-muted-foreground">Checking Buffer connection…</span>
        </CardContent>
      </Card>
    );
  }

  if (status?.connected) {
    return (
      <div className="contents">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-xl text-white"
                style={{ backgroundColor: BUFFER_BLUE }}
              >
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Buffer Integration</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Schedule Instagram, Facebook, LinkedIn, and X from one queue
                </p>
              </div>
            </div>
            <Badge className="bg-green-600 hover:bg-green-700 text-white text-[11px] flex items-center gap-1 px-2.5">
              <CheckCircle className="h-3 w-3" />
              Connected
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-50 border">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {status.account?.name || status.account?.email || 'Buffer account'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {status.account?.organizations?.[0]?.name || 'Organization'}
                  {status.source === 'env' ? ' · Edge Function secret' : ' · Connected in app'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setShowPostDialog(true)}
                  className="flex items-center gap-1.5 h-8 text-xs text-white"
                  style={{ backgroundColor: BUFFER_BLUE }}
                  disabled={connectedChannels.length === 0}
                >
                  <Send className="h-3 w-3" />
                  Queue post
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={refresh}
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                {status.canDisconnect && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => disconnect()}
                    disabled={isDisconnecting}
                    title="Disconnect Buffer"
                  >
                    {isDisconnecting ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {connectedChannels.length === 0 ? (
                <p className="text-xs text-muted-foreground col-span-2">
                  No Buffer channels yet. Connect Instagram, Facebook, LinkedIn, or X inside Buffer,
                  then refresh.
                </p>
              ) : (
                connectedChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white"
                  >
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: BRAND.navy }}
                    >
                      {serviceLabel(channel.service).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {channel.displayName || channel.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {serviceLabel(channel.service)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {posts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-700">Upcoming Buffer queue</p>
                {posts.slice(0, 5).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-md border bg-gray-50/80"
                  >
                    <p className="text-xs text-gray-800 line-clamp-2">{post.text || '(no text)'}</p>
                    <div className="text-[10px] text-muted-foreground text-right shrink-0">
                      <div>{post.channelName || serviceLabel(post.channelService || '')}</div>
                      <div>{formatDueAt(post.dueAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Queue a Buffer post</DialogTitle>
              <DialogDescription>
                Sends through Buffer to the social channels connected on that account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="buffer-post-text">Post text</Label>
                <Textarea
                  id="buffer-post-text"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Channels</Label>
                <div className="mt-1.5 space-y-1.5">
                  {connectedChannels.map((channel) => (
                    <label
                      key={channel.id}
                      className="flex items-center gap-2 text-sm p-2 rounded-md border cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannelIds.includes(channel.id)}
                        onChange={() => toggleChannel(channel.id)}
                      />
                      {channel.displayName || channel.name} · {serviceLabel(channel.service)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="buffer-mode">When</Label>
                  <select
                    id="buffer-mode"
                    className="mt-1.5 w-full h-9 rounded-md border bg-white px-2 text-sm"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as BufferShareMode)}
                  >
                    <option value="addToQueue">Next slot in queue</option>
                    <option value="shareNow">Share now</option>
                    <option value="shareNext">Share next</option>
                    <option value="customScheduled">Specific time</option>
                  </select>
                </div>
                {mode === 'customScheduled' && (
                  <div>
                    <Label htmlFor="buffer-due">Date and time</Label>
                    <Input
                      id="buffer-due"
                      type="datetime-local"
                      className="mt-1.5"
                      value={dueAtLocal}
                      onChange={(event) => setDueAtLocal(event.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPostDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={isCreating || !postText.trim() || selectedChannelIds.length === 0}
                className="text-white"
                style={{ backgroundColor: BUFFER_BLUE }}
              >
                {isCreating ? 'Sending…' : 'Send to Buffer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center h-10 w-10 rounded-xl text-white"
            style={{ backgroundColor: BUFFER_BLUE }}
          >
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Buffer Integration</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect Buffer to publish Instagram, Facebook, LinkedIn, and X
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[11px] flex items-center gap-1 px-2.5">
          <AlertCircle className="h-3 w-3" />
          Not Connected
        </Badge>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {status?.error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{status.error}</span>
          </div>
        )}
        <div className="flex flex-col items-center text-center py-5 border rounded-lg border-dashed bg-gray-50/50 px-4">
          <h3 className="font-medium text-sm text-gray-900">Connect your Buffer account</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Create an API key in Buffer Settings → API, then paste it here. The key is stored on the
            server and never shown in the browser after you connect.
          </p>
          <div className="w-full max-w-sm mt-4 space-y-2 text-left">
            <Label htmlFor="buffer-api-key">Buffer API key</Label>
            <Input
              id="buffer-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste key"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || apiKey.trim().length < 8}
              className="text-white"
              style={{ backgroundColor: BUFFER_BLUE }}
            >
              {isConnecting ? 'Connecting…' : 'Connect Buffer'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={BUFFER_API_SETTINGS} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Get API key
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
