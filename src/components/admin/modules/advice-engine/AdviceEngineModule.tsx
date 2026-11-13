/**
 * Advice Engine Module - Main Index
 *
 * Centralized exports for the advice engine module.
 * Provides clean public API for consuming code.
 *
 * @module advice-engine
 */

import React, { Suspense } from 'react';
import { Tabs, TabsContent } from '../../../ui/tabs';
import { PageHeader, NavTabsList, NavTabsTrigger, useUrlState } from '../../layout/page';
import { AskAIInterface } from './components/AskAIInterface';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';

// Heavy sub-component — lazy-loaded (only shown on tab switch)
const DraftRoAInterface = React.lazy(() =>
  import('./components/DraftRoAInterface').then((m) => ({ default: m.DraftRoAInterface })),
);
const RoAModuleContractManager = React.lazy(() =>
  import('./components/RoAModuleContractManager').then((m) => ({
    default: m.RoAModuleContractManager,
  })),
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

// ============================================================================
// Module Entry Point (only public export — no external barrel consumers)
// ============================================================================

const ADVICE_ENGINE_TABS = ['ask-vasco', 'draft-roa', 'roa-contracts'] as const;

export function AdviceEngineModule() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'super-admin';
  const allowedTabs = isSuperAdmin ? ADVICE_ENGINE_TABS : ADVICE_ENGINE_TABS.slice(0, 2);
  const [tab, setTab] = useUrlState('tab', 'ask-vasco', allowedTabs);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Advice Engine"
        description="AI-powered advisory tools for client consultation and compliant record keeping."
      />

      {/* Main Interface */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof ADVICE_ENGINE_TABS)[number])}
        className="gap-5"
      >
        <NavTabsList aria-label="Advice Engine">
          <NavTabsTrigger value="ask-vasco">Ask Vasco</NavTabsTrigger>
          <NavTabsTrigger value="draft-roa">Draft RoA</NavTabsTrigger>
          {isSuperAdmin && <NavTabsTrigger value="roa-contracts">RoA Contracts</NavTabsTrigger>}
        </NavTabsList>

        {/* Ask Vasco Tab */}
        <TabsContent value="ask-vasco">
          <AskAIInterface />
        </TabsContent>

        {/* Draft RoA Tab */}
        <TabsContent value="draft-roa">
          <Suspense fallback={<TabFallback />}>
            <DraftRoAInterface />
          </Suspense>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="roa-contracts">
            <Suspense fallback={<TabFallback />}>
              <RoAModuleContractManager />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
