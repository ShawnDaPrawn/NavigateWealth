/**
 * Accounts section of the Locked module.
 *
 * Owns both the section-nav tab (Overview / Refund Clusters / Disbursement)
 * and the "which cluster is open" state, so that opening a cluster can become a
 * focused detail screen: the section-nav bar is hidden and only the breadcrumb
 * + the cluster's own tabs remain. This guarantees the section nav and the
 * cluster nav are never on screen at the same time (the bug that made the two
 * tab bars indistinguishable).
 *
 * The section tab is controlled so it survives drilling into a cluster and back
 * — returning from a cluster lands you back on Refund Clusters, not Overview.
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { ComingSoonBadge } from '../components/ComingSoonBadge';
import { RefundManagerPanel } from './components/RefundManagerPanel';
import { RefundClustersPanel } from './RefundClustersPanel';
import { ContractorsPanel } from './ContractorsPanel';
import { ClusterDetailView } from './components/ClusterDetailView';
import { ClusterBreadcrumb } from './components/ClusterBreadcrumb';
import { SUBTAB_LIST, SUBTAB_TRIGGER } from './components/subTabs';
import { useRefundClusters } from './hooks/useRefundClusters';

type AccountsTab = 'overview' | 'refund-clusters' | 'contractors';

export function AccountsPanel() {
  const [tab, setTab] = useState<AccountsTab>('overview');
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const { data: clusters = [] } = useRefundClusters();

  // Detail screen: section-nav bar hidden, breadcrumb owns wayfinding.
  if (openClusterId) {
    const openCluster = clusters.find((c) => c.id === openClusterId);
    return (
      <div className="space-y-4">
        <ClusterBreadcrumb clusterName={openCluster?.name} onBack={() => setOpenClusterId(null)} />
        <ClusterDetailView clusterId={openClusterId} onBack={() => setOpenClusterId(null)} />
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as AccountsTab)} className="space-y-4">
      <div className="w-full overflow-x-auto">
        <TabsList className={SUBTAB_LIST}>
          <TabsTrigger value="overview" className={SUBTAB_TRIGGER}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="refund-clusters" className={SUBTAB_TRIGGER}>
            Refund Clusters
          </TabsTrigger>
          <TabsTrigger value="disbursement-clusters" className={SUBTAB_TRIGGER} disabled>
            Disbursement Clusters
            <ComingSoonBadge />
          </TabsTrigger>
          <TabsTrigger value="contractors" className={SUBTAB_TRIGGER}>
            Contractors
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <RefundManagerPanel />
      </TabsContent>
      <TabsContent value="refund-clusters">
        <RefundClustersPanel onOpenCluster={setOpenClusterId} />
      </TabsContent>
      <TabsContent value="contractors">
        <ContractorsPanel />
      </TabsContent>
    </Tabs>
  );
}
