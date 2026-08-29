/**
 * Newsletter Studio — a listmonk-style newsletter manager embedded in the
 * admin platform: campaigns with a real lifecycle and batched background
 * delivery, reusable templates, audience lists (communication groups), and
 * an engagement dashboard. Server counterpart: /newsletter-studio routes.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
// Cross-module dependency: newsletter → personnel (public hook surface).
// Same §3.1 exception the communication module documents — capability checks
// are personnel's public API, re-implementing them would fork authz logic.
import { useCurrentUserPermissions } from '../personnel';
import { CampaignsTab, type CampaignsView } from './components/CampaignsTab';
import { DashboardTab } from './components/DashboardTab';
import { TemplatesTab } from './components/TemplatesTab';
import { AudiencesTab } from './components/AudiencesTab';

export function NewsletterModule() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [campaignsView, setCampaignsView] = useState<CampaignsView>({ kind: 'list' });
  const { canDo } = useCurrentUserPermissions();
  const canSend = canDo('newsletter', 'send');

  const openCampaigns = (view: CampaignsView) => {
    setCampaignsView(view);
    setActiveTab('campaigns');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Newsletter Studio</h2>
        <p className="text-sm text-muted-foreground">
          Compose, schedule and track newsletter campaigns — delivery runs in the background and
          honours every unsubscribe.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="audiences">Audiences</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab
            onOpenCampaign={(campaign) =>
              openCampaigns({ kind: 'detail', campaignId: campaign.id })
            }
            onNewCampaign={() => openCampaigns({ kind: 'editor', campaign: null })}
          />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsTab canSend={canSend} view={campaignsView} onViewChange={setCampaignsView} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="audiences">
          <AudiencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
