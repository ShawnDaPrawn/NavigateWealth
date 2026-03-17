import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { DocumentsInsuranceTab } from './DocumentsInsuranceTab';
import { StatutoryReturnsTab } from './StatutoryReturnsTab';
import { POPIAPAIATab } from './POPIAPAIATab';
import { RecordKeepingTab } from './RecordKeepingTab';

export function PracticeTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Practice Management</h2>
        <p className="text-muted-foreground">
          General compliance documents, statutory returns, data protection, and record keeping.
        </p>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <div className="w-full overflow-x-auto pb-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="documents">Documents & Insurance</TabsTrigger>
              <TabsTrigger value="statutory">Statutory Returns</TabsTrigger>
              <TabsTrigger value="popia">POPIA / PAIA</TabsTrigger>
              <TabsTrigger value="records">Record Keeping</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="documents" className="mt-6">
          <DocumentsInsuranceTab />
        </TabsContent>
        
        <TabsContent value="statutory" className="mt-6">
          <StatutoryReturnsTab />
        </TabsContent>

        <TabsContent value="popia" className="mt-6">
          <POPIAPAIATab />
        </TabsContent>

        <TabsContent value="records" className="mt-6">
          <RecordKeepingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
