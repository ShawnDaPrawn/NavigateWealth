import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { 
  Briefcase, 
  Database, 
  LayoutTemplate,
  Building2,
  Key,
  ShieldAlert,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ProviderManagementTab } from './ProviderManagementTab';
import { ProductManagementTab } from './ProductManagementTab';
import { IntegrationsTab } from './IntegrationsTab';
import { UniversalKeyManager } from '../resources';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';
import { ProductManagementSkeleton } from './components/ProductManagementSkeleton';

// Lazy-load the Document AI tab since it's less frequently accessed
const DocumentMappingTab = React.lazy(() =>
  import('./components/DocumentMappingTab').then(m => ({ default: m.DocumentMappingTab }))
);

export function ProductManagementModule() {
  const { can, isLoading } = useCurrentUserPermissions();
  const [activeTab, setActiveTab] = useState('providers');

  const canAccess = can('product-management');

  // Determine initial active tab
  useEffect(() => {
    if (isLoading) return;
    if (canAccess && !activeTab) {
      setActiveTab('providers');
    }
  }, [canAccess, isLoading, activeTab]);

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
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Product Configuration</h1>
        <p className="text-lg text-gray-500 max-w-3xl">
          Manage your financial product providers, define product data structures, and configure external data integrations.
        </p>
      </div>

      {/* Main Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="providers">
            <Building2 className="w-4 h-4 mr-2" />
            Provider Management
          </TabsTrigger>
          
          <TabsTrigger value="products">
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Product Structure
          </TabsTrigger>

          <TabsTrigger value="keys">
            <Key className="w-4 h-4 mr-2" />
            Key Manager
          </TabsTrigger>

          <TabsTrigger value="integrations">
            <Database className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>

          <TabsTrigger value="document-ai">
            <Sparkles className="w-4 h-4 mr-2" />
            Document AI
          </TabsTrigger>
        </TabsList>

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
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          }>
            <DocumentMappingTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}