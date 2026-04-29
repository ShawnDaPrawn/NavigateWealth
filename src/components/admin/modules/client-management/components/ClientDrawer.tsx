import React, { Suspense, useEffect, useState } from 'react';
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
import { Client } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { communicationApi } from '../../communication/api';
import { clientKeys } from '../hooks/queryKeys';
import { getClientProfileQueryOptions } from '../api';
import { NotesAPI } from '../../notes/api';
import { NOTES_STALE_TIME } from '../../notes/constants';
import { noteKeys } from '../../../../../utils/queryKeys';
import { esignApi } from '../../esign/api';
import { QUERY_GC_TIME, QUERY_STALE_TIME } from '../../esign/constants';
import { esignKeys } from '../../esign/hooks/useEnvelopesQuery';

const loadClientProfileViewerFull = () =>
  import('../../../ClientProfileViewerFull').then((m) => ({ default: m.ClientProfileViewerFull }));
const ClientProfileViewerFull = React.lazy(loadClientProfileViewerFull);
const loadPolicyDetailsSection = () =>
  import('../../../profile-sections/PolicyDetailsSection').then((m) => ({ default: m.PolicyDetailsSection }));
const PolicyDetailsSection = React.lazy(loadPolicyDetailsSection);
const loadDocumentsTab = () =>
  import('./DocumentsTab').then((m) => ({ default: m.DocumentsTab }));
const DocumentsTab = React.lazy(loadDocumentsTab);
const loadSecurityTab = () =>
  import('./SecurityTab').then((m) => ({ default: m.SecurityTab }));
const SecurityTab = React.lazy(loadSecurityTab);
const loadComplianceTab = () =>
  import('./ComplianceTab').then((m) => ({ default: m.ComplianceTab }));
const ComplianceTab = React.lazy(loadComplianceTab);
const loadCommunicationTab = () =>
  import('./CommunicationTab').then((m) => ({ default: m.CommunicationTab }));
const CommunicationTab = React.lazy(loadCommunicationTab);
const loadEsignTab = () =>
  import('./EsignTab').then((m) => ({ default: m.EsignTab }));
const EsignTab = React.lazy(loadEsignTab);
const loadClientOverviewTab = () =>
  import('./ClientOverviewTab').then((m) => ({ default: m.ClientOverviewTab }));
const ClientOverviewTab = React.lazy(loadClientOverviewTab);
const loadClientNotesTab = () =>
  import('./ClientNotesTab').then((m) => ({ default: m.ClientNotesTab }));
const ClientNotesTab = React.lazy(loadClientNotesTab);

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

function TabPanelFallback() {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-8 text-sm text-muted-foreground">
      Loading section...
    </div>
  );
}

type DrawerTab =
  | 'overview'
  | 'personal'
  | 'policies'
  | 'security'
  | 'documents'
  | 'esign'
  | 'compliance'
  | 'communication'
  | 'notes';

const DEFAULT_PERSISTED_TABS: DrawerTab[] = ['overview'];

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
  const queryClient = useQueryClient();
  const [sanctionsScreeningRunning, setSanctionsScreeningRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [persistedTabs, setPersistedTabs] = useState<Set<DrawerTab>>(() => new Set(DEFAULT_PERSISTED_TABS));
  // Hardcoded for now as in original file
  const lastSanctionsCheck = '2024-01-15 14:30:00';

  const persistTab = (tab: DrawerTab) => {
    setPersistedTabs((previous) => {
      if (previous.has(tab)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(tab);
      return next;
    });
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as DrawerTab;
    setActiveTab(nextTab);
    persistTab(nextTab);
  };

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

  useEffect(() => {
    if (!open) {
      setActiveTab('overview');
      setPersistedTabs(new Set(DEFAULT_PERSISTED_TABS));
      return;
    }

    setPersistedTabs(new Set(DEFAULT_PERSISTED_TABS));

    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });

    const preloadSequence: Array<() => Promise<unknown>> = [
      () => queryClient.prefetchQuery(getClientProfileQueryOptions(client.id)),
      () => loadClientProfileViewerFull(),
      async () => {
        await loadPolicyDetailsSection();
        persistTab('policies');
      },
      async () => {
        await loadDocumentsTab();
        persistTab('documents');
      },
      () => queryClient.prefetchQuery({
        queryKey: noteKeys.clientNotes(client.id),
        queryFn: () => NotesAPI.getClientNotes(client.id),
        staleTime: NOTES_STALE_TIME,
      }),
      () => loadClientNotesTab(),
      () => queryClient.prefetchQuery({
        queryKey: clientKeys.communicationLogs(client.id),
        queryFn: () => communicationApi.getClientLogs(client.id),
        staleTime: 60 * 1000,
      }),
      () => loadCommunicationTab(),
      () => loadSecurityTab(),
      async () => {
        await queryClient.prefetchQuery({
          queryKey: esignKeys.clientEnvelopes(client.id),
          queryFn: async () => {
            const response = await esignApi.getClientEnvelopes(client.id, client.email);
            return response.envelopes || [];
          },
          staleTime: QUERY_STALE_TIME,
          gcTime: QUERY_GC_TIME,
        });
        await loadEsignTab();
        persistTab('esign');
      },
      () => loadComplianceTab(),
    ];

    const runSmartPreload = async () => {
      await wait(200);

      for (const step of preloadSequence) {
        if (cancelled) return;

        try {
          await step();
        } catch (error) {
          console.warn('[ClientDrawer] Background preload step failed', error);
        }

        await wait(120);
      }
    };

    void runSmartPreload();

    return () => {
      cancelled = true;
    };
  }, [client.email, client.id, open, queryClient]);

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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
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
          <TabsContent value="overview" forceMount={persistedTabs.has('overview')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <ClientOverviewTab client={client} />
            </Suspense>
          </TabsContent>

          {/* 1. Personal Details Section */}
          <TabsContent value="personal" forceMount={persistedTabs.has('personal')} className="space-y-4 h-[calc(100vh-300px)]">
            <Suspense fallback={<TabPanelFallback />}>
              <ClientProfileViewerFull clientData={client} />
            </Suspense>
          </TabsContent>

          {/* 2. Policy Details Section */}
          <TabsContent value="policies" forceMount={persistedTabs.has('policies')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <PolicyDetailsSection selectedClient={client} />
            </Suspense>
          </TabsContent>

          {/* 3. Security Section */}
          <TabsContent value="security" forceMount={persistedTabs.has('security')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <SecurityTab selectedClient={client} />
            </Suspense>
          </TabsContent>

          {/* 4. Documents Section */}
          <TabsContent value="documents" forceMount={persistedTabs.has('documents')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <DocumentsTab selectedClient={client} />
            </Suspense>
          </TabsContent>

          {/* 5. E-Sign Section */}
          <TabsContent value="esign" forceMount={persistedTabs.has('esign')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <EsignTab selectedClient={client} />
            </Suspense>
          </TabsContent>

          {/* 6. Compliance Section */}
          <TabsContent value="compliance" forceMount={persistedTabs.has('compliance')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <ComplianceTab 
                selectedClient={client}
                sanctionsScreeningRunning={sanctionsScreeningRunning}
                onRunSanctionsScreening={handleSanctionsScreening}
                lastSanctionsCheck={lastSanctionsCheck}
              />
            </Suspense>
          </TabsContent>

          {/* 7. Communication Section */}
          <TabsContent value="communication" forceMount={persistedTabs.has('communication')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <CommunicationTab client={client} />
            </Suspense>
          </TabsContent>

          {/* 8. Notes Section */}
          <TabsContent value="notes" forceMount={persistedTabs.has('notes')} className="space-y-4">
            <Suspense fallback={<TabPanelFallback />}>
              <ClientNotesTab selectedClient={client} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
