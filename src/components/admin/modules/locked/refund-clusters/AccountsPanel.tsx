/**
 * Accounts section of the Locked module.
 *
 * Owns the section control (Overview / Refund clusters / Disbursement
 * clusters) and the "which cluster is open" state. Both are in the address:
 * `?tab=accounts&section=refund-clusters&cluster=<id>`. An open cluster is a
 * page of its own (LockedModule hides its header and tabs while `cluster` is
 * set), with "‹ Back to clusters" returning to the list.
 */

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger, useRecordInUrl, useUrlState } from '../../../layout/page';
import { ComingSoonBadge } from '../components/ComingSoonBadge';
import { RefundManagerPanel } from './components/RefundManagerPanel';
import { RefundClustersPanel } from './RefundClustersPanel';
import { ClusterDetailView } from './components/ClusterDetailView';
import { CLUSTER_PARAM, CLUSTER_TAB_PARAM, ENTITY_PARAM, ENTITY_TYPE_PARAM } from './constants';
import { useRefundClusters } from './hooks/useRefundClusters';

type AccountsSection = 'overview' | 'refund-clusters';
const ACCOUNTS_SECTIONS: readonly AccountsSection[] = ['overview', 'refund-clusters'];

export function AccountsPanel() {
  const [section, setSection] = useUrlState<AccountsSection>(
    'section',
    'overview',
    ACCOUNTS_SECTIONS,
  );
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const { data: clusters, isLoading } = useRefundClusters();
  const [, setSearchParams] = useSearchParams();

  useRecordInUrl(CLUSTER_PARAM, openClusterId, {
    ready: !isLoading,
    openFromUrl: (id) => {
      if (!clusters) return 'waiting';
      if (!clusters.some((c) => c.id === id)) {
        toast.error('Cluster not found');
        return 'missing';
      }
      setOpenClusterId(id);
      return 'opened';
    },
    closeFromUrl: () => setOpenClusterId(null),
  });

  // Back to the list: the cluster and everything inside it leave the address.
  const closeCluster = useCallback(() => {
    setOpenClusterId(null);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      for (const key of [CLUSTER_PARAM, CLUSTER_TAB_PARAM, ENTITY_TYPE_PARAM, ENTITY_PARAM]) {
        params.delete(key);
      }
      return params;
    });
  }, [setSearchParams]);

  if (openClusterId) {
    return <ClusterDetailView clusterId={openClusterId} onBack={closeCluster} />;
  }

  return (
    <Tabs
      value={section}
      onValueChange={(value) => setSection(value as AccountsSection)}
      className="gap-4"
    >
      <SegmentedList aria-label="Accounts section">
        <SegmentedTrigger value="overview">Overview</SegmentedTrigger>
        <SegmentedTrigger value="refund-clusters">Refund clusters</SegmentedTrigger>
        <SegmentedTrigger value="disbursement-clusters" disabled className="disabled:opacity-50">
          Disbursement clusters
          <ComingSoonBadge />
        </SegmentedTrigger>
      </SegmentedList>

      <TabsContent value="overview">
        <RefundManagerPanel />
      </TabsContent>
      <TabsContent value="refund-clusters">
        <RefundClustersPanel onOpenCluster={setOpenClusterId} />
      </TabsContent>
    </Tabs>
  );
}
