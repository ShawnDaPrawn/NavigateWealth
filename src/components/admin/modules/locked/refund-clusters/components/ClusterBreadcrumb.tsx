/**
 * Breadcrumb shown above an opened cluster's detail view:
 *
 *   Accounts › Refund Clusters › [Cluster name]
 *
 * The "Refund Clusters" crumb is the back action — it returns to the cluster
 * list. Keeps the user oriented in place of the old full-page takeover that
 * offered only a bare "Back to clusters" button. Composes the shared
 * `ui/breadcrumb` primitives; lives inside the module so it deletes with it.
 */

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../../../../ui/breadcrumb';

interface ClusterBreadcrumbProps {
  clusterName?: string;
  onBack: () => void;
}

export function ClusterBreadcrumb({ clusterName, onBack }: ClusterBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <span className="text-muted-foreground">Accounts</span>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={onBack} className="cursor-pointer">
              Refund Clusters
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{clusterName || 'Cluster'}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
