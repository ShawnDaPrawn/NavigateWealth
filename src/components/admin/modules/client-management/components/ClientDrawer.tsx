import React, { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { AlertTriangle, Loader2, UserX } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../../../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Badge } from '../../../../ui/badge';
import { Client } from '../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { communicationApi } from '../../communication';
import { clientKeys } from '../hooks/queryKeys';
import { getClientProfileQueryOptions } from '../api';
import { NotesAPI } from '../../notes';
import { NOTES_STALE_TIME } from '../../notes';
import { noteKeys } from '../../../../../utils/queryKeys';
import { esignApi, esignKeys, QUERY_GC_TIME, QUERY_STALE_TIME } from '../../esign';
import type { FNAListFocus } from '../../fna';
import { AskVascoPortalTab } from './AskVascoPortalTab';
import { ClientAvatar } from './ClientAvatar';
import { useOptionalUnsavedChangesRegistry } from '../../../../shared/unsaved-changes';
import { Button } from '../../../../ui/button';
import { useFreshClientOnOpen, type FreshClientState } from '../hooks/useFreshClientOnOpen';

const loadClientProfileViewerFull = () =>
  import('./clientProfile/ClientProfileViewerFull').then((m) => ({
    default: m.ClientProfileViewerFull,
  }));
const ClientProfileViewerFull = React.lazy(loadClientProfileViewerFull);
const loadPolicyDetailsSection = () =>
  import('../../../profile-sections/PolicyDetailsSection').then((m) => ({
    default: m.PolicyDetailsSection,
  }));
const PolicyDetailsSection = React.lazy(loadPolicyDetailsSection);
const loadDocumentsTab = () => import('./DocumentsTab').then((m) => ({ default: m.DocumentsTab }));
const DocumentsTab = React.lazy(loadDocumentsTab);
const loadSecurityTab = () => import('./SecurityTab').then((m) => ({ default: m.SecurityTab }));
const SecurityTab = React.lazy(loadSecurityTab);
const loadComplianceTab = () =>
  import('./ComplianceTab').then((m) => ({ default: m.ComplianceTab }));
const ComplianceTab = React.lazy(loadComplianceTab);
const loadCommunicationTab = () =>
  import('./CommunicationTab').then((m) => ({ default: m.CommunicationTab }));
const CommunicationTab = React.lazy(loadCommunicationTab);
const loadEsignTab = () => import('./EsignTab').then((m) => ({ default: m.EsignTab }));
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
  /**
   * Open on Policy Details → this category's FNA list, with the FNA highlighted
   * — where publishing an FNA from outside the drawer lands the adviser.
   */
  fnaFocus?: FNAListFocus;
}

export function ClientDrawer({
  client,
  open,
  onOpenChange,
  canEdit = true,
  canDelete = true,
  fnaFocus,
}: ClientDrawerProps) {
  if (!client) return null;

  return (
    <ClientDrawerInner
      key={client.id}
      client={client}
      open={open}
      onOpenChange={onOpenChange}
      canEdit={canEdit}
      canDelete={canDelete}
      fnaFocus={fnaFocus}
    />
  );
}

/** Props for the inner component — client is guaranteed non-null by the outer guard. */
interface ClientDrawerInnerProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
  fnaFocus?: FNAListFocus;
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
  | 'askVasco'
  | 'esign'
  | 'compliance'
  | 'communication'
  | 'notes';

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
function ClientDrawerInner({
  client: listClient,
  open,
  onOpenChange,
  canEdit,
  fnaFocus,
}: ClientDrawerInnerProps) {
  const unsavedChangesRegistry = useOptionalUnsavedChangesRegistry();
  const [sanctionsScreeningRunning, setSanctionsScreeningRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>(fnaFocus ? 'policies' : 'overview');
  // Never the list row: everything below the shell reads the record fetched by
  // this open (useFreshClientOnOpen explains why).
  const fresh = useFreshClientOnOpen(listClient.id, open);

  const handleTabChange = (value: string) => {
    const nextTab = value as DrawerTab;
    if (activeTab === 'personal' && nextTab !== 'personal') {
      const switchTab = () => setActiveTab(nextTab);
      if (unsavedChangesRegistry?.getDirtyEntries().length) {
        unsavedChangesRegistry.tryLeaveAny(switchTab);
        return;
      }
    }
    setActiveTab(nextTab);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      const closeDrawer = () => onOpenChange(false);
      if (activeTab === 'personal' && unsavedChangesRegistry?.getDirtyEntries().length) {
        unsavedChangesRegistry.tryLeaveAny(closeDrawer);
        return;
      }
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  };

  const handleSanctionsScreening = () => {
    setSanctionsScreeningRunning(true);
    // Simulate API call
    setTimeout(() => {
      setSanctionsScreeningRunning(false);
    }, 3000);
  };

  useEffect(() => {
    if (!open) setActiveTab('overview');
  }, [open]);

  // Keep the profile on screen while the drawer animates closed. A new open
  // forgets it, so it can never stand in for the record that open fetches.
  const readyClient = fresh.status === 'ready' ? fresh.client : null;
  const [closingClient, setClosingClient] = useState<Client | null>(null);
  useEffect(() => {
    if (readyClient) setClosingClient(readyClient);
  }, [readyClient]);
  useLayoutEffect(() => {
    if (open) setClosingClient(null);
  }, [open]);
  const workspaceClient = readyClient ?? (open ? null : closingClient);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        // Fill everything right of the admin sidebar on desktop. A fixed pixel
        // width left the page behind visible when the browser was zoomed out.
        className="w-full overflow-y-auto transition-[width] duration-300 sm:max-w-none lg:w-[calc(100vw-var(--sidebar-width,18rem))]"
      >
        {workspaceClient ? (
          <ClientWorkspace
            client={workspaceClient}
            open={open}
            canEdit={canEdit}
            fnaFocus={fnaFocus}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            sanctionsScreeningRunning={sanctionsScreeningRunning}
            onRunSanctionsScreening={handleSanctionsScreening}
          />
        ) : (
          <ClientDrawerPending
            state={fresh.status === 'ready' ? { status: 'loading' } : fresh}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** What the drawer shows until this open's record has arrived. Never client data. */
function ClientDrawerPending({
  state,
  onClose,
}: {
  state: Exclude<FreshClientState, { status: 'ready' }>;
  onClose: () => void;
}) {
  if (state.status === 'missing') {
    return (
      <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-muted-foreground" aria-hidden />
            Client not available
          </SheetTitle>
          <SheetDescription>
            This client is no longer listed in Client Management. They may have been removed or
            their application declined.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            Could not load this client
          </SheetTitle>
          <SheetDescription>
            The latest details could not be loaded. Nothing is shown rather than an older copy.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 flex gap-2">
          <Button onClick={state.retry}>Try again</Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          Opening client profile
        </SheetTitle>
        <SheetDescription>Loading the latest details from the server.</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-3" aria-hidden>
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-muted/70" />
        <div className="h-40 w-full animate-pulse rounded-lg bg-muted/50" />
      </div>
    </>
  );
}

interface ClientWorkspaceProps {
  client: Client;
  open: boolean;
  canEdit: boolean;
  fnaFocus?: FNAListFocus;
  activeTab: DrawerTab;
  onTabChange: (value: string) => void;
  sanctionsScreeningRunning: boolean;
  onRunSanctionsScreening: () => void;
}

/** The profile itself. Mounted only with the record fetched by this open. */
function ClientWorkspace({
  client,
  open,
  canEdit,
  fnaFocus,
  activeTab,
  onTabChange,
  sanctionsScreeningRunning,
  onRunSanctionsScreening,
}: ClientWorkspaceProps) {
  const queryClient = useQueryClient();
  // Hardcoded for now as in original file
  const lastSanctionsCheck = '2024-01-15 14:30:00';

  const { data: communications = [] } = useQuery({
    queryKey: clientKeys.communicationLogs(client.id),
    queryFn: () => communicationApi.getClientLogs(client.id),
    enabled: open && !!client.id,
  });

  const communicationCount = communications.length;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    // The profile, policies and FNA status were already started when the
    // profile opened (useFreshClientOnOpen); these warm the other tabs.
    const preloadSequence: Array<() => Promise<unknown>> = [
      () => queryClient.prefetchQuery(getClientProfileQueryOptions(client.id)),
      () => loadClientProfileViewerFull(),
      async () => {
        await loadPolicyDetailsSection();
      },
      async () => {
        await loadDocumentsTab();
      },
      () =>
        queryClient.prefetchQuery({
          queryKey: noteKeys.clientNotes(client.id),
          queryFn: () => NotesAPI.getClientNotes(client.id),
          staleTime: NOTES_STALE_TIME,
        }),
      () => loadClientNotesTab(),
      () =>
        queryClient.prefetchQuery({
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
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClientAvatar
              clientId={client.id}
              firstName={client.firstName}
              lastName={client.lastName}
              className="h-12 w-12"
              editable={canEdit}
            />
            <div>
              <div>
                {client.firstName} {client.lastName}
              </div>
              <div className="text-sm text-muted-foreground font-normal">
                {client.preferredName !== client.firstName && `"${client.preferredName}" • `}
                Client ID: {client.id}
              </div>
            </div>
          </div>
        </SheetTitle>
        <SheetDescription>Complete client profile and management tools</SheetDescription>
      </SheetHeader>

      {/* MAIN TABS - Level 1: Primary Navigation
            Uses ShadCN Tabs component with rounded, filled style
            See: /components/admin/TAB_DESIGN_STANDARDS.md */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-6">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal Details</TabsTrigger>
          <TabsTrigger value="policies">Policy Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="askVasco">Ask Vasco</TabsTrigger>
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
          <Suspense fallback={<TabPanelFallback />}>
            <ClientOverviewTab client={client} />
          </Suspense>
        </TabsContent>

        {/* 1. Personal Details Section */}
        <TabsContent value="personal" className="space-y-4 h-[calc(100vh-300px)]">
          <Suspense fallback={<TabPanelFallback />}>
            <ClientProfileViewerFull clientData={client} />
          </Suspense>
        </TabsContent>

        {/* 2. Policy Details Section */}
        <TabsContent value="policies" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <PolicyDetailsSection
              fnaFocus={fnaFocus}
              selectedClient={
                client as unknown as React.ComponentProps<
                  typeof PolicyDetailsSection
                >['selectedClient']
              }
            />
          </Suspense>
        </TabsContent>

        {/* 3. Security Section */}
        <TabsContent value="security" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <SecurityTab selectedClient={client} />
          </Suspense>
        </TabsContent>

        {/* 4. Documents Section */}
        <TabsContent value="documents" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <DocumentsTab selectedClient={client} />
          </Suspense>
        </TabsContent>

        {/* 5. Ask Vasco Section */}
        <TabsContent value="askVasco" className="space-y-4">
          <AskVascoPortalTab selectedClient={client} />
        </TabsContent>

        {/* 6. E-Sign Section */}
        <TabsContent value="esign" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <EsignTab selectedClient={client} />
          </Suspense>
        </TabsContent>

        {/* 7. Compliance Section */}
        <TabsContent value="compliance" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <ComplianceTab
              selectedClient={client}
              sanctionsScreeningRunning={sanctionsScreeningRunning}
              onRunSanctionsScreening={onRunSanctionsScreening}
              lastSanctionsCheck={lastSanctionsCheck}
            />
          </Suspense>
        </TabsContent>

        {/* 8. Communication Section */}
        <TabsContent value="communication" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <CommunicationTab client={client} />
          </Suspense>
        </TabsContent>

        {/* 9. Notes Section */}
        <TabsContent value="notes" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <ClientNotesTab selectedClient={client} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </>
  );
}
