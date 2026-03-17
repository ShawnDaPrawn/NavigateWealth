/**
 * Advice Engine Module - Main Index
 * 
 * Centralized exports for the advice engine module.
 * Provides clean public API for consuming code.
 * 
 * @module advice-engine
 */

import React, { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { AskAIInterface } from './components/AskAIInterface';
import { Brain, FileText, Loader2 } from 'lucide-react';

// Heavy sub-component — lazy-loaded (only shown on tab switch)
const DraftRoAInterface = React.lazy(() => import('./components/DraftRoAInterface').then(m => ({ default: m.DraftRoAInterface })));

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

export function AdviceEngineModule() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advice Engine</h1>
          <p className="text-muted-foreground">
            AI-powered advisory tools for client consultation and compliant record keeping
          </p>
        </div>
      </div>

      {/* Main Interface */}
      <Tabs defaultValue="ask-vasco" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ask-vasco" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Ask Vasco
          </TabsTrigger>
          <TabsTrigger value="draft-roa" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Draft RoA
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}