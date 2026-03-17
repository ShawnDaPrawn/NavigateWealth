import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { 
  FileText, 
  Share2, 
  Link as LinkIcon,
  ShieldAlert
} from 'lucide-react';
import { PublicationsTab } from './PublicationsTab';
import { SocialMediaTab } from './SocialMediaTab';
import { LinktreeTab } from './LinktreeTab';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';
import { SocialMediaSkeleton } from './components/SocialMediaSkeleton';

export function SocialMediaModule() {
  const { can, isLoading } = useCurrentUserPermissions();
  const [activeMainTab, setActiveMainTab] = useState('');

  const canPublications = can('publications');
  const canMarketing = can('marketing');

  // Determine initial active tab based on permissions
  useEffect(() => {
    if (isLoading) return;
    
    if (canPublications) {
      setActiveMainTab('publications');
    } else if (canMarketing) {
      setActiveMainTab('social-media');
    }
  }, [canPublications, canMarketing, isLoading]);

  if (isLoading) {
    return <SocialMediaSkeleton />;
  }

  if (!canPublications && !canMarketing) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">
          You do not have permission to view the Social Media & Marketing module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Social Media & Marketing</h1>
        <p className="text-muted-foreground">
          Manage publications, social media, and your link-in-bio page
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger 
            value="publications" 
            className="flex items-center gap-2"
            disabled={!canPublications}
          >
            <FileText className="h-4 w-4" />
            Publications
          </TabsTrigger>
          <TabsTrigger 
            value="social-media" 
            className="flex items-center gap-2"
            disabled={!canMarketing}
          >
            <Share2 className="h-4 w-4" />
            Social Media
          </TabsTrigger>
          <TabsTrigger 
            value="linktree" 
            className="flex items-center gap-2"
            disabled={!canMarketing}
          >
            <LinkIcon className="h-4 w-4" />
            Link in Bio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="publications" className="mt-6">
          {canPublications && <PublicationsTab />}
        </TabsContent>

        <TabsContent value="social-media" className="mt-6">
          {canMarketing && <SocialMediaTab />}
        </TabsContent>

        <TabsContent value="linktree" className="mt-6">
          {canMarketing && <LinktreeTab />}
        </TabsContent>
      </Tabs>
    </div>
  );
}