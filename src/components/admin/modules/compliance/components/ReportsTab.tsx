import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { NewBusinessRegisterTab } from './NewBusinessRegisterTab';
import { CancellationRegisterTab } from './CancellationRegisterTab';
import { ComplaintsTCFTab } from './ComplaintsTCFTab';
import { ConflictsMarketingTab } from './ConflictsMarketingTab';
import { CPDRegisterTab } from './CPDRegisterTab';
import { ProductTrainingRegisterTab } from './ProductTrainingRegisterTab';

export function ReportsTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Compliance Registers & Reports</h2>
        <p className="text-muted-foreground">
          Centralised registers for tracking business activities, complaints, conflicts, and training.
        </p>
      </div>

      <Tabs defaultValue="new-business" className="w-full">
        <div className="w-full overflow-x-auto pb-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="new-business">New Business</TabsTrigger>
              <TabsTrigger value="cancellation">Cancellations</TabsTrigger>
              <TabsTrigger value="complaints">Complaints</TabsTrigger>
              <TabsTrigger value="gifts">Gifts & Conflicts</TabsTrigger>
              <TabsTrigger value="cpd">CPD</TabsTrigger>
              <TabsTrigger value="pst">Product Training</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="new-business" className="mt-6">
          <NewBusinessRegisterTab />
        </TabsContent>
        
        <TabsContent value="cancellation" className="mt-6">
          <CancellationRegisterTab />
        </TabsContent>

        <TabsContent value="complaints" className="mt-6">
          <ComplaintsTCFTab />
        </TabsContent>

        <TabsContent value="gifts" className="mt-6">
          <ConflictsMarketingTab />
        </TabsContent>
        
        <TabsContent value="cpd" className="mt-6">
          <CPDRegisterTab />
        </TabsContent>
        
        <TabsContent value="pst" className="mt-6">
          <ProductTrainingRegisterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
