import { Tabs, TabsContent } from '../../../ui/tabs';
import { ShieldAlert } from 'lucide-react';
import { PublicationsTab } from './PublicationsTab';
import { SocialMediaTab } from './SocialMediaTab';
import { LinktreeTab } from './LinktreeTab';
import { useCurrentUserPermissions } from '../personnel';
import { SocialMediaSkeleton } from './components/SocialMediaSkeleton';
import { PageHeader, NavTabsList, NavTabsTrigger, useUrlState } from '../../layout/page';

const MARKETING_TABS = ['publications', 'social-media', 'linktree'] as const;

export function SocialMediaModule() {
  const { can, isLoading } = useCurrentUserPermissions();
  const canPublications = can('publications');
  const canMarketing = can('marketing');

  // The open tab is in the address (?tab=linktree); only tabs this person
  // may use are accepted.
  const allowedTabs = MARKETING_TABS.filter((t) =>
    t === 'publications' ? canPublications : canMarketing,
  );
  const [activeMainTab, setActiveMainTab] = useUrlState(
    'tab',
    canPublications ? 'publications' : 'social-media',
    allowedTabs,
  );

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
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Social & Marketing"
        description="Publications, social media and your link-in-bio page."
      />

      {/* Main Tabs */}
      <Tabs
        value={activeMainTab}
        onValueChange={(v) => setActiveMainTab(v as (typeof MARKETING_TABS)[number])}
        className="gap-5"
      >
        <NavTabsList aria-label="Social & Marketing">
          <NavTabsTrigger value="publications" disabled={!canPublications}>
            Publications
          </NavTabsTrigger>
          <NavTabsTrigger value="social-media" disabled={!canMarketing}>
            Social media
          </NavTabsTrigger>
          <NavTabsTrigger value="linktree" disabled={!canMarketing}>
            Link in bio
          </NavTabsTrigger>
        </NavTabsList>

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
