import React, { useState } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '../../../../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '../../../../ui/avatar';
import { Badge } from '../../../../ui/badge';
import { ClientProfileViewerFull } from '../../../ClientProfileViewerFull';
import { PolicyDetailsSection } from '../../../profile-sections/PolicyDetailsSection';
import { DocumentsTab } from './DocumentsTab';
import { SecurityTab } from './SecurityTab';
import { ComplianceTab } from './ComplianceTab';
import { CommunicationTab } from './CommunicationTab';
import { EsignTab } from './EsignTab';
import { ClientOverviewTab } from './ClientOverviewTab';
import { ClientNotesTab } from './ClientNotesTab';
import { Client } from '../types';
import { useQuery } from '@tanstack/react-query';
import { communicationApi } from '../../communication/api';
import { clientKeys } from '../hooks/queryKeys';

interface ClientDrawerProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the current user can edit clients. Defaults to true for backwards compat. */
  canEdit?: boolean;
  /** Whether the current user can delete clients. Defaults to true for backwards compat. */
  canDelete?: boolean;
}

export function ClientDrawer({ client, open, onOpenChange, canEdit = true, canDelete = true }: ClientDrawerProps) {
  if (!client) return null;

  return (
    <ClientDrawerInner client={client} open={open} onOpenChange={onOpenChange} canEdit={canEdit} canDelete={canDelete} />
  );
}

/** Props for the inner component — client is guaranteed non-null by the outer guard. */
interface ClientDrawerInnerProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}

/**
 * Inner component for the client drawer workspace.
 *
 * WORKAROUND: Radix nested-dialog focus-scope conflict
 * The ClientDrawer is a Radix Sheet (Dialog under the hood).  Several child
 * components (WillDraftingWizard, FNA wizards, PDF viewer, etc.) open their
 * own Radix Dialogs inside this Sheet.  When the Sheet runs with `modal={true}`,
 * its FocusScope continuously reclaims focus from the inner Dialog's inputs,
 * making text fields uneditable.
 *
 * Setting `modal={false}` permanently disables the Sheet's focus trap.
 * This is acceptable for a 1400px admin workspace drawer — users are never
 * "trapped" inside it anyway, and the inner Dialogs provide their own modal
 * focus trapping when they need it.
 *
 * The Sheet's visual overlay and close-on-X behaviour are unaffected because
 * SheetOverlay always renders and onOpenChange remains wired.
 */
function ClientDrawerInner({ client, open, onOpenChange, canEdit, canDelete }: ClientDrawerInnerProps) {
  const [sanctionsScreeningRunning, setSanctionsScreeningRunning] = useState(false);
  // Hardcoded for now as in original file
  const lastSanctionsCheck = '2024-01-15 14:30:00';

  const handleSanctionsScreening = () => {
    setSanctionsScreeningRunning(true);
    // Simulate API call
    setTimeout(() => {
      setSanctionsScreeningRunning(false);
    }, 3000);
  };

  const { data: communications = [] } = useQuery({
    queryKey: clientKeys.communicationLogs(client.id),
    queryFn: () => communicationApi.getClientLogs(client.id),
    enabled: open && !!client.id,
  });

  const communicationCount = communications.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        className="w-[1400px] overflow-y-auto transition-[max-width] duration-300"
        style={{ maxWidth: 'calc(100vw - var(--sidebar-width, 18rem))' }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/api/placeholder/40/40" />
                <AvatarFallback>
                  {client.firstName[0]}{client.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{client.firstName} {client.lastName}</div>
                <div className="text-sm text-muted-foreground font-normal">
                  {client.preferredName !== client.firstName && 
                    `"${client.preferredName}" • `
                  }
                  Client ID: {client.id}
                </div>
              </div>
            </div>
          </SheetTitle>
          <SheetDescription>
            Complete client profile and management tools
          </SheetDescription>
        </SheetHeader>

        {/* MAIN TABS - Level 1: Primary Navigation
            Uses ShadCN Tabs component with rounded, filled style
            See: /components/admin/TAB_DESIGN_STANDARDS.md */}
        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personal">Personal Details</TabsTrigger>
            <TabsTrigger value="policies">Policy Details</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="esign">E-Sign</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="communication">
              <span className="inline-flex items-center gap-1.5">
                Communication
                {communicationCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 border-0 leading-none"
                  >
                    {communicationCount}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* 0. Overview — Client-side dashboard view */}
          <TabsContent value="overview" className="space-y-4">
            <ClientOverviewTab client={client} />
          </TabsContent>

          {/* 1. Personal Details Section */}
          <TabsContent value="personal" className="space-y-4 h-[calc(100vh-300px)]">
            <ClientProfileViewerFull 
              clientData={client}
            />
          </TabsContent>

          {/* 2. Policy Details Section */}
          <TabsContent value="policies" className="space-y-4">
            <PolicyDetailsSection selectedClient={client} />
          </TabsContent>

          {/* 3. Security Section */}
          <TabsContent value="security" className="space-y-4">
            <SecurityTab selectedClient={client} />
          </TabsContent>

          {/* 4. Documents Section */}
          <TabsContent value="documents" className="space-y-4">
            <DocumentsTab selectedClient={client} />
          </TabsContent>

          {/* 5. E-Sign Section */}
          <TabsContent value="esign" className="space-y-4">
            <EsignTab selectedClient={client} />
          </TabsContent>

          {/* 6. Compliance Section */}
          <TabsContent value="compliance" className="space-y-4">
            <ComplianceTab 
              selectedClient={client}
              sanctionsScreeningRunning={sanctionsScreeningRunning}
              onRunSanctionsScreening={handleSanctionsScreening}
              lastSanctionsCheck={lastSanctionsCheck}
            />
          </TabsContent>

          {/* 7. Communication Section */}
          <TabsContent value="communication" className="space-y-4">
            <CommunicationTab client={client} />
          </TabsContent>

          {/* 8. Notes Section */}
          <TabsContent value="notes" className="space-y-4">
            <ClientNotesTab selectedClient={client} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}