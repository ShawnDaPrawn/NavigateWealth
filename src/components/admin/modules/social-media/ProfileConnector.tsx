/**
 * Profile Connector — Connected Profiles Tab
 *
 * Manages social media profile connections. The LinkedIn connector uses
 * real OAuth 2.0; other platforms show a connect-ready state.
 *
 * Layout follows the admin panel stat-card + list pattern (§8.3):
 *   1. Compact LinkedIn integration card (real OAuth)
 *   2. Other connected profiles list
 *   3. Available platforms section (connect new)
 *   4. Collapsed platform guidelines reference
 *
 * @module social-media/ProfileConnector
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../ui/dialog';
import { toast } from 'sonner@2.0.3';
import {
  Plus,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Unlink,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SocialProfile, SocialPlatform, PLATFORM_LIMITS } from './types';
import { LinkedInConnector } from './components/LinkedInConnector';
import { BRAND } from './constants';

// ============================================================================
// Types
// ============================================================================

interface ProfileConnectorProps {
  profiles: SocialProfile[];
  onConnect: (platform: SocialPlatform) => void;
  onDisconnect: (profileId: string) => void;
  onRefresh: (profileId: string) => void;
}

interface PlatformConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconBg: string;
  description: string;
  available: boolean;
}

// ============================================================================
// Constants (config-driven per §5.3)
// ============================================================================

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0A66C2',
    iconBg: 'bg-[#0A66C2]',
    description: 'Professional network — real OAuth 2.0 integration',
    available: true,
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    iconBg: 'bg-gradient-to-br from-purple-600 to-pink-500',
    description: 'Visual platform for engaging content',
    available: false,
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: '#1877F2',
    iconBg: 'bg-[#1877F2]',
    description: 'Connect with a broad audience',
    available: false,
  },
  x: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: '#000000',
    iconBg: 'bg-black',
    description: 'Real-time conversations and updates',
    available: false,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatFollowerCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function formatLastSync(date?: Date): string {
  if (!date) return 'Never';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ============================================================================
// Component
// ============================================================================

export function ProfileConnector({
  profiles,
  onConnect,
  onDisconnect,
  onRefresh,
}: ProfileConnectorProps) {
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleConnect = async (platform: SocialPlatform) => {
    if (platform === 'linkedin') return;

    setConnectingPlatform(platform);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      onConnect(platform);
      toast.success(`Successfully connected to ${PLATFORM_CONFIG[platform].name}!`);
      setShowConnectDialog(false);
    } catch (error) {
      toast.error(`Failed to connect to ${PLATFORM_CONFIG[platform].name}`);
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (profileId: string) => {
    try {
      onDisconnect(profileId);
      toast.success('Profile disconnected successfully');
    } catch (error) {
      toast.error('Failed to disconnect profile');
    }
  };

  const handleRefresh = async (profileId: string) => {
    try {
      onRefresh(profileId);
      toast.success('Profile data refreshed');
    } catch (error) {
      toast.error('Failed to refresh profile data');
    }
  };

  // --------------------------------------------------------------------------
  // Derived
  // --------------------------------------------------------------------------

  const nonLinkedinProfiles = profiles.filter(p => p.platform !== 'linkedin');
  const connectedNonLinkedin = nonLinkedinProfiles.filter(p => p.isConnected);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Section 1: LinkedIn Integration (Real OAuth) */}
      <LinkedInConnector />

      {/* Section 2: Other Connected Profiles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Other Social Profiles</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {connectedNonLinkedin.length > 0
                ? `${connectedNonLinkedin.length} profile${connectedNonLinkedin.length !== 1 ? 's' : ''} connected`
                : 'Connect additional social media platforms'}
            </p>
          </div>

          <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="flex items-center gap-2"
                style={{ backgroundColor: BRAND.navy }}
              >
                <Plus className="h-3.5 w-3.5" />
                Connect Platform
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Connect Social Media Platform</DialogTitle>
                <DialogDescription>
                  Choose a platform to connect. LinkedIn is managed separately via OAuth.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 mt-4">
                {Object.entries(PLATFORM_CONFIG)
                  .filter(([key]) => key !== 'linkedin')
                  .map(([platform, config]) => {
                    const Icon = config.icon;
                    const isConnected = profiles.some(
                      p => p.platform === platform && p.isConnected,
                    );
                    const isConnecting = connectingPlatform === platform;

                    return (
                      <button
                        key={platform}
                        className="w-full flex items-center gap-3 p-3.5 rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        onClick={() => handleConnect(platform as SocialPlatform)}
                        disabled={isConnected || isConnecting || !config.available}
                      >
                        <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${config.iconBg} text-white shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{config.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {config.description}
                          </div>
                        </div>
                        {isConnected && (
                          <Badge className="bg-green-600 text-white text-[10px] shrink-0">
                            Connected
                          </Badge>
                        )}
                        {!config.available && !isConnected && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Coming Soon
                          </Badge>
                        )}
                        {isConnecting && (
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {nonLinkedinProfiles.length === 0 ? (
            <div className="text-center py-10 border rounded-lg border-dashed bg-gray-50/50">
              <div
                className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: BRAND.navyLight }}
              >
                <ExternalLink className="h-5 w-5" style={{ color: BRAND.navy }} />
              </div>
              <p className="font-medium text-sm text-gray-900">No additional profiles connected</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Connect Instagram, Facebook, or X to manage all your social media from one place.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowConnectDialog(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Connect Platform
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {nonLinkedinProfiles.map(profile => {
                const config = PLATFORM_CONFIG[profile.platform];
                const Icon = config.icon;

                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3.5 border rounded-lg hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${config.iconBg} text-white shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={profile.avatar} alt={profile.name} />
                        <AvatarFallback className="text-xs">
                          {profile.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{profile.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="truncate">{profile.username}</span>
                          {profile.followerCount != null && profile.followerCount > 0 && (
                            <div className="contents">
                              <span>·</span>
                              <span className="shrink-0">{formatFollowerCount(profile.followerCount)} followers</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {profile.isConnected ? (
                        <div className="contents">
                          <div className="text-right mr-1 hidden sm:block">
                            <Badge className="bg-green-600 hover:bg-green-700 text-white text-[10px] flex items-center gap-1">
                              <CheckCircle className="h-2.5 w-2.5" />
                              Connected
                            </Badge>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Synced {formatLastSync(profile.lastSync)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRefresh(profile.id)}
                            title="Refresh profile data"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDisconnect(profile.id)}
                            title="Disconnect profile"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="contents">
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Disconnected
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => handleConnect(profile.platform)}
                            className="flex items-center gap-1.5 h-7 text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Reconnect
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Platform Reference (collapsible) */}
      <Card>
        <button
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
          onClick={() => setShowGuidelines(!showGuidelines)}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center h-8 w-8 rounded-lg"
              style={{ backgroundColor: BRAND.navyLight }}
            >
              <Info className="h-4 w-4" style={{ color: BRAND.navy }} />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900">Platform Posting Guidelines</span>
              <p className="text-xs text-muted-foreground mt-0">
                Character limits, image specs, and feature support
              </p>
            </div>
          </div>
          {showGuidelines ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showGuidelines && (
          <CardContent className="pt-0 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(PLATFORM_CONFIG).map(([platform, config]) => {
                const Icon = config.icon;
                const limits = PLATFORM_LIMITS[platform as SocialPlatform];

                return (
                  <div
                    key={platform}
                    className="p-3.5 border rounded-lg bg-gray-50/50"
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-md ${config.iconBg} text-white`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium text-sm">{config.name}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Max characters</span>
                        <span className="font-medium text-gray-700">
                          {limits.maxCharacters.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Max images</span>
                        <span className="font-medium text-gray-700">{limits.maxImages}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Aspect ratios</span>
                        <span className="font-medium text-gray-700 text-right">
                          {limits.aspectRatios.recommended.join(', ')}
                        </span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {limits.features.hashtags && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            Hashtags
                          </Badge>
                        )}
                        {limits.features.mentions && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            Mentions
                          </Badge>
                        )}
                        {limits.features.polls && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            Polls
                          </Badge>
                        )}
                        {limits.features.stories && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            Stories
                          </Badge>
                        )}
                        {limits.features.firstComment && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            First Comment
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
