import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Badge } from '../../../../ui/badge';
import { UserPlus, FileSpreadsheet, Users } from 'lucide-react';
import { SingleClientForm } from './SingleClientForm';
import { BulkImportTab } from './BulkImportTab';

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded: () => void;
}

export function AddClientDialog({ open, onOpenChange, onClientAdded }: AddClientDialogProps) {
  const [activeTab, setActiveTab] = useState('single');

  const handleSuccess = () => {
    onClientAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden p-0 gap-0 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col min-h-0 flex-1">
          {/* ── Fixed Header ─────────────────────────────── */}
          <div className="shrink-0">
            {/* Purple accent stripe */}
            <div className="h-1 bg-gradient-to-r from-[#6d28d9] via-purple-500 to-[#6d28d9]/60" />

            <DialogHeader className="px-7 pr-14 pt-5 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-[#6d28d9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    Add New Client
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 mt-0.5">
                    Add a single client or import a batch from Excel. An application will be created for review in the Applications module.
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium text-[#6d28d9] border-[#6d28d9]/20 bg-[#6d28d9]/5 shrink-0">
                  Client Onboarding
                </Badge>
              </div>
            </DialogHeader>

            {/* Tab triggers */}
            <div className="px-7 border-b border-gray-200">
              <TabsList className="h-10 bg-transparent p-0 gap-0 w-auto rounded-none">
                <TabsTrigger
                  value="single"
                  className="relative h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6d28d9] data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent px-5 text-sm font-medium text-gray-500 data-[state=active]:text-[#6d28d9] transition-colors"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Single Client
                </TabsTrigger>
                <TabsTrigger
                  value="bulk"
                  className="relative h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-[#6d28d9] data-[state=active]:bg-transparent data-[state=active]:shadow-none bg-transparent px-5 text-sm font-medium text-gray-500 data-[state=active]:text-[#6d28d9] transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Bulk Import
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* ── Scrollable Content ───────────────────────── */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/40">
            <TabsContent value="single" className="mt-0 p-7 pt-6 m-0">
              <SingleClientForm
                onSuccess={handleSuccess}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>

            <TabsContent value="bulk" className="mt-0 p-7 pt-6 m-0">
              <BulkImportTab
                onSuccess={handleSuccess}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}