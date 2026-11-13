import React, { Suspense } from 'react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { ProviderManagementTab } from './ProviderManagementTab';
import { ProductManagementTab } from './ProductManagementTab';
import { IntegrationsTab } from './IntegrationsTab';
import { UniversalKeyManager } from '../resources';
import { PageHeader, NavTabsList, NavTabsTrigger, useUrlState } from '../../layout/page';
import { useCurrentUserPermissions } from '../personnel';
import { ProductManagementSkeleton } from './components/ProductManagementSkeleton';

// Lazy-load the Document AI tab since it's less frequently accessed
const DocumentMappingTab = React.lazy(() =>
  import('./components/DocumentMappingTab').then((m) => ({ default: m.DocumentMappingTab })),
);

const PRODUCT_TABS = ['providers', 'products', 'keys', 'integrations', 'document-ai'] as const;

export function ProductManagementModule() {
  const { can, isLoading } = useCurrentUserPermissions();
  // The open tab is in the address (?tab=keys).
  const [activeTab, setActiveTab] = useUrlState('tab', 'providers', PRODUCT_TABS);

  const canAccess = can('product-management');

  if (isLoading) {
    return <ProductManagementSkeleton />;
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6">
        <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">
          You do not have permission to view the Product Management module.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Product Management"
        description="Product providers, product data structures and external data integrations."
      />

      {/* Main Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as (typeof PRODUCT_TABS)[number])}
        className="gap-5"
      >
        <NavTabsList aria-label="Product Management">
          <NavTabsTrigger value="providers">Providers</NavTabsTrigger>
          <NavTabsTrigger value="products">Product structure</NavTabsTrigger>
          <NavTabsTrigger value="keys">Key manager</NavTabsTrigger>
          <NavTabsTrigger value="integrations">Integrations</NavTabsTrigger>
          <NavTabsTrigger value="document-ai">Document AI</NavTabsTrigger>
        </NavTabsList>

        <TabsContent value="providers" className="m-0 focus-visible:outline-none">
          <ProviderManagementTab />
        </TabsContent>

        <TabsContent value="products" className="m-0 focus-visible:outline-none">
          <ProductManagementTab />
        </TabsContent>

        <TabsContent value="keys" className="m-0 focus-visible:outline-none">
          <UniversalKeyManager />
        </TabsContent>

        <TabsContent value="integrations" className="m-0 focus-visible:outline-none">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="document-ai" className="m-0 focus-visible:outline-none">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            }
          >
            <DocumentMappingTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
