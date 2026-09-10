/**
 * ChannelsPanel — the Buffer channels the practice publishes to.
 *
 * Buffer holds the network connections (and their OAuth tokens); this panel
 * shows what is connected, whether the app can reach Buffer, and where to go
 * to change either. The optional personal LinkedIn card (the older in-app
 * OAuth integration, which posts as a person rather than the company page)
 * stays available underneath.
 */

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Instagram,
  Linkedin,
  Twitter,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Skeleton } from '../../../ui/skeleton';
import { LinkedInConnector } from './components/LinkedInConnector';
import { useBufferStatus, useSocialProfiles } from './hooks/useSocialProfiles';
import type { SocialPlatform, SocialProfile } from './types';

const BUFFER_URL = 'https://publish.buffer.com/';

const PLATFORM_META: Record<string, { label: string; icon: typeof Linkedin }> = {
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  instagram: { label: 'Instagram', icon: Instagram },
  x: { label: 'X', icon: Twitter },
};

const EXPECTED: SocialPlatform[] = ['linkedin', 'instagram', 'x'];

function scheduleSummary(profile: SocialProfile): string {
  const slots = (profile.postingSchedule ?? []).reduce(
    (n, day) => n + (day.paused ? 0 : day.times.length),
    0,
  );
  return slots > 0 ? `${slots} queue slot${slots === 1 ? '' : 's'} per week` : 'No queue slots';
}

function ChannelCard({ profile }: { profile: SocialProfile }) {
  const meta = PLATFORM_META[profile.platform] ?? {
    label: profile.service ?? profile.platform,
    icon: Linkedin,
  };
  const Icon = meta.icon;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar} alt="" />
            <AvatarFallback>
              <Icon className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{profile.name}</span>
              {profile.isConnected ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Needs reconnect
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {meta.label}
              {profile.accountType ? ` · ${profile.accountType}` : ''}
              {profile.username && profile.username !== profile.name
                ? ` · @${profile.username}`
                : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {scheduleSummary(profile)}
              {profile.timezone ? ` · ${profile.timezone}` : ''}
            </p>
            {profile.externalLink && (
              <a
                href={profile.externalLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                Open profile
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChannelsPanel() {
  const status = useBufferStatus();
  const { profiles, loading, error } = useSocialProfiles({
    fetchOnMount: status.data?.configured !== false,
  });
  const [personalOpen, setPersonalOpen] = useState(false);

  const missing = EXPECTED.filter((platform) => !profiles.some((p) => p.platform === platform));
  const account = status.data?.account;

  return (
    <div className="space-y-6">
      {status.data && !status.data.configured && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Buffer is not configured</AlertTitle>
          <AlertDescription>
            Set the <code>BUFFER_API_KEY</code> Edge Function secret (create the key at
            publish.buffer.com → Settings → API) to read channels, posts and metrics here.
          </AlertDescription>
        </Alert>
      )}
      {status.data?.configured && status.data.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Buffer is configured but unreachable</AlertTitle>
          <AlertDescription>{status.data.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Buffer channels</CardTitle>
              <p className="text-sm text-muted-foreground">
                {account
                  ? `Organisation “${account.organizations[0]?.name ?? '—'}” · ${account.email}`
                  : 'Channels are connected and reconnected in Buffer; the app and the routines publish through them.'}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href={BUFFER_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Manage in Buffer
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {EXPECTED.map((p) => (
                <Skeleton key={p} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map((profile) => (
                <ChannelCard key={profile.id} profile={profile} />
              ))}
              {missing.map((platform) => {
                const meta = PLATFORM_META[platform];
                const Icon = meta.icon;
                return (
                  <Card key={platform} className="border-dashed">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 font-medium">
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Not connected in Buffer. Add it there (Channels → Connect) and it appears
                        here and in the weekly automation automatically.
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          variant="ghost"
          size="sm"
          className="px-0"
          onClick={() => setPersonalOpen((v) => !v)}
        >
          {personalOpen ? (
            <ChevronUp className="h-4 w-4 mr-1" />
          ) : (
            <ChevronDown className="h-4 w-4 mr-1" />
          )}
          Personal LinkedIn profile (optional, posts as you rather than the company page)
        </Button>
        {personalOpen && (
          <div className="mt-3">
            <LinkedInConnector />
          </div>
        )}
      </div>
    </div>
  );
}
