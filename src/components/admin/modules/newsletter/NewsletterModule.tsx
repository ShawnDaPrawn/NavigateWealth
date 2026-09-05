/**
 * Newsletter Studio — a listmonk-style newsletter manager embedded in the
 * admin platform: campaigns with a real lifecycle and batched background
 * delivery, reusable templates, audience lists (communication groups), and
 * an engagement dashboard. Server counterpart: /newsletter-studio routes.
 *
 * The active tab and open campaign live in the URL (`nlTab`, `campaign`,
 * `edit`) so a refresh or a shared link lands on the same screen.
 */
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  ChevronRight,
  FileText,
  LayoutDashboard,
  Layers,
  Newspaper,
  Plus,
  Users,
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Skeleton } from '../../../ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { cn } from '../../../ui/utils';
// Cross-module dependency: newsletter → personnel (public hook surface).
// Same §3.1 exception the communication module documents — capability checks
// are personnel's public API, re-implementing them would fork authz logic.
import { useCurrentUserPermissions } from '../personnel';
import { AudiencesTab } from './components/AudiencesTab';
import { CampaignsTab, type CampaignsView, type EditorSeed } from './components/CampaignsTab';
import { DashboardTab, type StudioTab } from './components/DashboardTab';
import { TemplatesTab } from './components/TemplatesTab';
import { ErrorState } from './components/shared';
import { useStudioCampaign, useStudioDashboard } from './hooks/useNewsletterStudio';
import type { NewsletterCaps } from './types';
import { formatRelative } from './utils/format';
import { schedulerHealth } from './utils/scheduler';

const TABS: { id: StudioTab; label: string; icon: typeof Layers }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns', icon: Layers },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'audiences', label: 'Audiences', icon: Users },
];

const TAB_PARAM = 'nlTab';
const CAMPAIGN_PARAM = 'campaign';
const EDIT_PARAM = 'edit';

function isStudioTab(value: string | null): value is StudioTab {
  return TABS.some((tab) => tab.id === value);
}

export function NewsletterModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canDo } = useCurrentUserPermissions();
  // UX gating only — the server enforces the same capabilities independently.
  const caps: NewsletterCaps = useMemo(
    () => ({
      create: canDo('newsletter', 'create'),
      send: canDo('newsletter', 'send'),
      delete: canDo('newsletter', 'delete'),
    }),
    [canDo],
  );

  // Seeds (template / preselected lists) are transient UI state, not URL state.
  const [seed, setSeed] = useState<EditorSeed | undefined>(undefined);

  const tabParam = searchParams.get(TAB_PARAM);
  const campaignParam = searchParams.get(CAMPAIGN_PARAM);
  const editing = searchParams.get(EDIT_PARAM) === '1';

  const activeTab: StudioTab = campaignParam
    ? 'campaigns'
    : isStudioTab(tabParam)
      ? tabParam
      : 'dashboard';

  const openCampaignQuery = useStudioCampaign(
    campaignParam && campaignParam !== 'new' ? campaignParam : null,
  );
  const openCampaign = openCampaignQuery.data;

  const campaignsView: CampaignsView = useMemo(() => {
    if (!campaignParam) return { kind: 'list' };
    if (campaignParam === 'new') return { kind: 'editor', campaign: null, seed };
    if (editing) return { kind: 'editor', campaign: openCampaign ?? null, seed };
    return { kind: 'detail', campaignId: campaignParam };
  }, [campaignParam, editing, openCampaign, seed]);

  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setTab = useCallback(
    (tab: StudioTab) => {
      update((params) => {
        params.delete(CAMPAIGN_PARAM);
        params.delete(EDIT_PARAM);
        if (tab === 'dashboard') params.delete(TAB_PARAM);
        else params.set(TAB_PARAM, tab);
      });
    },
    [update],
  );

  const setCampaignsView = useCallback(
    (view: CampaignsView) => {
      if (view.kind === 'editor') setSeed(view.seed);
      update((params) => {
        params.set(TAB_PARAM, 'campaigns');
        params.delete(EDIT_PARAM);
        if (view.kind === 'list') {
          params.delete(CAMPAIGN_PARAM);
        } else if (view.kind === 'detail') {
          params.set(CAMPAIGN_PARAM, view.campaignId);
        } else if (view.campaign) {
          params.set(CAMPAIGN_PARAM, view.campaign.id);
          params.set(EDIT_PARAM, '1');
        } else {
          params.set(CAMPAIGN_PARAM, 'new');
        }
      });
    },
    [update],
  );

  const openNewCampaign = (editorSeed?: EditorSeed) =>
    setCampaignsView({ kind: 'editor', campaign: null, seed: editorSeed });

  // While the composer or drill-down is open the studio chrome steps back and
  // a breadcrumb takes its place, so the campaign gets the whole canvas.
  const focused = campaignsView.kind !== 'list';

  // Waiting for the campaign record before we can hand the composer an
  // existing campaign to edit — the editor must not mount with null and then
  // flip to "existing", or it would seed an empty form. Once loading ends
  // without a record (deleted, bad id, forbidden, network) the URL must not
  // dead-end on a blank page.
  const awaitingEditTarget = editing && campaignParam !== 'new' && !openCampaign;
  const editTargetFailed = awaitingEditTarget && !openCampaignQuery.isLoading;

  return (
    <div className="space-y-6">
      {focused ? (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <button
            type="button"
            onClick={() => setTab('dashboard')}
            className="hover:text-foreground"
          >
            Newsletter Studio
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className="hover:text-foreground"
          >
            Campaigns
          </button>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="truncate font-medium text-foreground">
            {campaignsView.kind === 'editor'
              ? campaignsView.campaign
                ? `Edit: ${campaignsView.campaign.name}`
                : 'New campaign'
              : (openCampaign?.name ?? 'Campaign')}
          </span>
        </nav>
      ) : (
        <StudioHeader canCreate={caps.create} onNewCampaign={() => openNewCampaign()} />
      )}

      {focused ? (
        editTargetFailed ? (
          <div className="space-y-4">
            <ErrorState
              title="This campaign could not be opened for editing"
              description={
                openCampaignQuery.error instanceof Error
                  ? openCampaignQuery.error.message
                  : 'It may have been deleted, or the link may be wrong.'
              }
              onRetry={() => openCampaignQuery.refetch()}
              retrying={openCampaignQuery.isFetching}
            />
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setTab('campaigns')}>
                Back to campaigns
              </Button>
            </div>
          </div>
        ) : awaitingEditTarget ? (
          <div className="space-y-4" data-testid="edit-target-loading">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        ) : (
          <CampaignsTab caps={caps} view={campaignsView} onViewChange={setCampaignsView} />
        )
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setTab(value as StudioTab)}
          className="space-y-5"
        >
          <TabsList className="h-10 max-w-full justify-start overflow-x-auto rounded-xl p-1">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 px-3">
                <tab.icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab
              caps={caps}
              onOpenCampaign={(campaignId) => setCampaignsView({ kind: 'detail', campaignId })}
              onNewCampaign={() => openNewCampaign()}
              onNavigate={setTab}
            />
          </TabsContent>
          <TabsContent value="campaigns">
            <CampaignsTab caps={caps} view={campaignsView} onViewChange={setCampaignsView} />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab caps={caps} onUseTemplate={(template) => openNewCampaign({ template })} />
          </TabsContent>
          <TabsContent value="audiences">
            <AudiencesTab
              caps={caps}
              onCreateCampaign={(listIds) => openNewCampaign({ listIds })}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function StudioHeader({
  canCreate,
  onNewCampaign,
}: {
  canCreate: boolean;
  onNewCampaign: () => void;
}) {
  const { data } = useStudioDashboard();
  const health = schedulerHealth(data?.processor);
  const pillTone =
    health.level === 'live'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800'
      : health.level === 'unknown'
        ? 'bg-muted text-muted-foreground ring-border'
        : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800';
  const dotTone =
    health.level === 'live'
      ? 'bg-emerald-500'
      : health.level === 'unknown'
        ? 'bg-slate-400'
        : 'bg-amber-500';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
          <Newspaper className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Newsletter Studio</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            Compose, schedule and track newsletter campaigns. Delivery runs in the background and
            honours every unsubscribe.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {data ? (
          <span
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ring-1 ring-inset',
              pillTone,
            )}
            title={
              health.level === 'live' && data.processor?.lastCronRunAt
                ? `${health.detail} Last check-in ${formatRelative(data.processor.lastCronRunAt)}.`
                : health.detail
            }
          >
            <span className={cn('h-2 w-2 rounded-full', dotTone)} aria-hidden />
            {health.label}
          </span>
        ) : null}
        {canCreate ? (
          <Button onClick={onNewCampaign}>
            <Plus className="h-4 w-4" aria-hidden /> New campaign
          </Button>
        ) : null}
      </div>
    </div>
  );
}
