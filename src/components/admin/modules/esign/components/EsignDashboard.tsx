/**
 * E-Signature home: page header, figures, and the module's four tabs
 * (Envelopes · Templates · Metrics · Manage). The open tab and the Manage
 * tool live in the address bar (`?tab=manage&tool=webhooks`), so reload,
 * Back and shared links land in the same place.
 *
 * The Manage tools used to open as dialogs from launcher cards; they now
 * render on the page under a segmented control (design system: no pop-ups
 * for tools, no third navigation level).
 */

import React, { Suspense } from 'react';
import { Button } from '../../../../ui/button';
import { Plus, AlertCircle, Loader2 } from 'lucide-react';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import {
  PageHeader,
  StatCard,
  NavTabsList,
  NavTabsTrigger,
  SegmentedList,
  SegmentedTrigger,
  useUrlState,
} from '../../../layout/page';
import { EnvelopesList } from './EnvelopesList';
import { TemplateLibrary } from './TemplateLibrary';
import { NotificationBell } from './NotificationBell';
import type { EsignEnvelope, EsignTemplateRecord } from '../types';
import { useEnvelopes } from '../hooks/useEnvelopes';
import { EXPIRING_SOON_DAYS } from '../constants';
import {
  ESIGN_TABS,
  MANAGE_TOOLS,
  computeEnvelopeMetrics,
  type EsignTab,
  type ManageAccess,
  type ManageTool,
} from './dashboardModel';

// Lazy so the envelopes tab stays fast.
const MetricsPanel = React.lazy(() =>
  import('./MetricsPanel').then((m) => ({ default: m.MetricsPanel })),
);
const NotificationPrefsDialog = React.lazy(() =>
  import('./NotificationPrefsDialog').then((m) => ({ default: m.NotificationPrefsDialog })),
);
const WebhooksDialog = React.lazy(() =>
  import('./WebhooksDialog').then((m) => ({ default: m.WebhooksDialog })),
);
const PacketsDialog = React.lazy(() =>
  import('./PacketsDialog').then((m) => ({ default: m.PacketsDialog })),
);
const RecoveryBinDialog = React.lazy(() =>
  import('./RecoveryBinDialog').then((m) => ({ default: m.RecoveryBinDialog })),
);
const AuditLogDialog = React.lazy(() =>
  import('./AuditLogDialog').then((m) => ({ default: m.AuditLogDialog })),
);
const RetentionPolicyDialog = React.lazy(() =>
  import('./RetentionPolicyDialog').then((m) => ({ default: m.RetentionPolicyDialog })),
);
const BrandingDialog = React.lazy(() =>
  import('./BrandingDialog').then((m) => ({ default: m.BrandingDialog })),
);

const MANAGE_LABELS: Record<ManageTool, string> = {
  notifications: 'Notifications',
  webhooks: 'Webhooks',
  packets: 'Packets',
  recovery: 'Recovery bin',
  audit: 'Audit log',
  retention: 'Retention',
  branding: 'Branding',
};

interface EsignDashboardProps {
  /** The role can see envelopes but not create or send: header shows "View only". */
  viewOnly?: boolean;
  onCreateNew: () => void;
  onViewEnvelope: (envelope: EsignEnvelope) => void;
  onResumePrepare?: (envelope: EsignEnvelope) => void;
  resumingEnvelopeId?: string | null;
  onUseTemplate?: (template: EsignTemplateRecord) => void;
  onStartTemplateBuilder?: (seed: {
    name: string;
    description?: string;
    category?: string;
  }) => void;
  onConfigureTemplate?: (template: EsignTemplateRecord) => void;
  /** Opens the bulk-send dialog. Absent when the person cannot send. */
  onBulkSend?: () => void;
  /** Which Manage tools to show. */
  manageAccess: ManageAccess;
  /** Reload envelopes after a Manage tool changed them (packets, recovery bin). */
  onRefresh: () => void;
  /** Open an envelope from the audit log. */
  onOpenEnvelopeById: (envelopeId: string) => void;
  refreshTrigger?: number;
}

export function EsignDashboard({
  onCreateNew,
  onViewEnvelope,
  onResumePrepare,
  resumingEnvelopeId,
  onUseTemplate,
  onStartTemplateBuilder,
  onConfigureTemplate,
  onBulkSend,
  manageAccess,
  onRefresh,
  onOpenEnvelopeById,
  refreshTrigger,
  viewOnly = false,
}: EsignDashboardProps) {
  const { envelopes, error: envelopesError } = useEnvelopes({ autoLoad: true, refreshTrigger });
  // Unknown totals show "—", not a misleading 0, when the list failed to load.
  const shown = (value: number | string) => (envelopesError ? '—' : value);
  const [tab, setTab] = useUrlState<EsignTab>('tab', 'envelopes', ESIGN_TABS);

  const availableTools = MANAGE_TOOLS.filter((tool) => manageAccess[tool]);
  const [tool, setTool] = useUrlState<ManageTool>(
    'tool',
    availableTools[0] ?? 'notifications',
    availableTools,
  );

  const metrics = computeEnvelopeMetrics(envelopes, new Date());
  const openEnvelopeById = (envelopeId: string) => {
    const target = envelopes.find((e) => e.id === envelopeId);
    if (target) onViewEnvelope(target);
    else onOpenEnvelopeById(envelopeId);
  };

  const noop = () => undefined;
  const renderTool = (which: ManageTool) => {
    switch (which) {
      case 'notifications':
        return (
          <div className="flex flex-col gap-4">
            <div className="flex w-fit items-center gap-3 rounded-xl border border-nw-line bg-white px-4 py-3">
              <NotificationBell onOpenEnvelope={openEnvelopeById} />
              <div className="text-sm">
                <div className="font-medium text-nw-ink">Inbox</div>
                <div className="text-xs text-nw-text-3">Unread envelope activity</div>
              </div>
            </div>
            <NotificationPrefsDialog open onOpenChange={noop} inline />
          </div>
        );
      case 'webhooks':
        return <WebhooksDialog open onOpenChange={noop} inline />;
      case 'packets':
        return <PacketsDialog open onOpenChange={noop} onCompleted={onRefresh} inline />;
      case 'recovery':
        return <RecoveryBinDialog open onOpenChange={noop} onChanged={onRefresh} inline />;
      case 'audit':
        return <AuditLogDialog open onOpenChange={noop} onOpenEnvelope={openEnvelopeById} inline />;
      case 'retention':
        return <RetentionPolicyDialog open onOpenChange={noop} inline />;
      case 'branding':
        return <BrandingDialog open onOpenChange={noop} inline />;
    }
  };

  const loading = (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-nw-violet" aria-label="Loading" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="E-Signature"
        description="Signature envelopes, templates and signer workflows."
        viewOnly={viewOnly}
        actions={
          <>
            {onBulkSend && (
              <Button variant="outline" onClick={onBulkSend}>
                Bulk send from template
              </Button>
            )}
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New envelope
            </Button>
          </>
        }
      />

      {metrics.expiringSoon > 0 && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-nw-amber-100/40 px-4 py-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="text-sm text-nw-amber-700">
            <strong>{metrics.expiringSoon}</strong> envelope{metrics.expiringSoon > 1 ? 's' : ''}{' '}
            expiring within {EXPIRING_SOON_DAYS} days. Consider sending reminders. Expired envelopes
            are swept automatically.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Action required"
          value={shown(metrics.pending)}
          meta="Pending signatures"
          tone={!envelopesError && metrics.pending > 0 ? 'attention' : 'default'}
        />
        <StatCard label="Completed" value={shown(metrics.completed)} meta="Fully signed" />
        <StatCard label="Drafts" value={shown(metrics.draft)} meta="Not yet sent" />
        <StatCard
          label="Expired"
          value={shown(metrics.expired)}
          meta="Past deadline"
          tone={!envelopesError && metrics.expired > 0 ? 'attention' : 'default'}
        />
        <StatCard
          label="Completion rate"
          value={shown(`${metrics.completionRate}%`)}
          meta="Of sent envelopes"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as EsignTab)} className="gap-5">
        <NavTabsList aria-label="E-Signature">
          <NavTabsTrigger value="envelopes" count={envelopesError ? undefined : metrics.total}>
            Envelopes
          </NavTabsTrigger>
          <NavTabsTrigger value="templates">Templates</NavTabsTrigger>
          <NavTabsTrigger value="metrics">Metrics</NavTabsTrigger>
          {availableTools.length > 0 && <NavTabsTrigger value="manage">Manage</NavTabsTrigger>}
        </NavTabsList>

        <TabsContent value="envelopes" className="mt-0">
          <div className="rounded-xl border border-nw-line bg-white p-4">
            <EnvelopesList
              onViewEnvelope={onViewEnvelope}
              onCreateNew={onCreateNew}
              onResumePrepare={onResumePrepare}
              resumingEnvelopeId={resumingEnvelopeId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <div className="rounded-xl border border-nw-line bg-white p-4">
            <TemplateLibrary
              onUseTemplate={(template) => onUseTemplate?.(template)}
              onStartTemplateBuilder={onStartTemplateBuilder}
              onConfigureTemplate={onConfigureTemplate}
            />
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-0">
          <Suspense fallback={loading}>
            <MetricsPanel onOpenEnvelope={openEnvelopeById} />
          </Suspense>
        </TabsContent>

        {availableTools.length > 0 && (
          <TabsContent value="manage" className="mt-0">
            <Tabs value={tool} onValueChange={(v) => setTool(v as ManageTool)} className="gap-4">
              <SegmentedList aria-label="Manage">
                {availableTools.map((t) => (
                  <SegmentedTrigger key={t} value={t}>
                    {MANAGE_LABELS[t]}
                  </SegmentedTrigger>
                ))}
              </SegmentedList>
              {availableTools.map((t) => (
                <TabsContent key={t} value={t} className="mt-0">
                  {tool === t && <Suspense fallback={loading}>{renderTool(t)}</Suspense>}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
