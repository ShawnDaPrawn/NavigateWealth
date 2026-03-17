import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { AMLFICATab } from './AMLFICATab';
import { FAISTab } from './FAISTab';
import { DebarmentSupervisionTab } from './DebarmentSupervisionTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';

export function CDDTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">Customer Due Diligence (CDD)</h2>
        <p className="text-muted-foreground">
          Manage Client and Staff due diligence requirements, including AML/FICA checks and FAIS Fit & Proper status.
        </p>
      </div>

      <Tabs defaultValue="client-cdd" className="w-full">
        <div className="w-full overflow-x-auto pb-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="client-cdd">Client CDD</TabsTrigger>
              <TabsTrigger value="staff-cdd">Staff CDD</TabsTrigger>
            </TabsList>
        </div>
        
        <TabsContent value="client-cdd" className="mt-6 space-y-6">
          <AMLFICATab />
        </TabsContent>
        
        <TabsContent value="staff-cdd" className="mt-6 space-y-6">
          <Tabs defaultValue="fais" className="w-full">
             <div className="mb-4">
                <TabsList>
                    <TabsTrigger value="fais">FAIS Fit & Proper</TabsTrigger>
                    <TabsTrigger value="debarment">Debarment & Supervision</TabsTrigger>
                </TabsList>
             </div>
             <TabsContent value="fais">
                <FAISTab />
             </TabsContent>
             <TabsContent value="debarment">
                <DebarmentSupervisionTab />
             </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
