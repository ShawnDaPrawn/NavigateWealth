import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, Download, KeyRound, Loader2, MoreHorizontal, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { ErrorState, NavTabsList, NavTabsTrigger, useUrlState } from '../../../layout/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { invalidateClientPolicies } from '../../../../../shared/api/clientPolicies';
import { deriveAccountStatus } from '../utils';
import { CLIENT_PAGE_PARAMS, CLIENT_TABS, type ClientTab } from './clientPageParams';
import type { OverviewActions } from './ClientOverviewTab';
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
const KeyInspectorTab = React.lazy(() =>
  import('./KeyInspectorTab').then((m) => ({ default: m.KeyInspectorTab })),
);

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

type DrawerTab = ClientTab;

/**
 * The client record, shown as a full page in place of the client list
 * (design system: records are pages, never side panels). It used to be a
 * Radix Sheet; inner dialogs (will wizard, FNA wizards, PDF viewer) now trap
 * focus on their own with no outer focus scope to fight.
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
  // The open tab lives in the address (?ctab=), next to ?client=.
  const [activeTab, setActiveTab] = useUrlState<DrawerTab>('ctab', 'overview', CLIENT_TABS);
  const [, setSearchParams] = useSearchParams();
  // An FNA published from outside lands on Policy details.
  useEffect(() => {
    if (fnaFocus) setActiveTab('policies');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per open
  }, []);
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
      const closeDrawer = () => {
        // The tab and section of this client do not belong on the list.
        setSearchParams(
          (current) => {
            const params = new URLSearchParams(current);
            CLIENT_PAGE_PARAMS.forEach((k) => params.delete(k));
            return params;
          },
          { replace: true },
        );
        onOpenChange(false);
      };
      if (activeTab === 'personal' && unsavedChangesRegistry?.getDirtyEntries().length) {
        unsavedChangesRegistry.tryLeaveAny(closeDrawer);
        return;
      }
      closeDrawer();
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
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => handleOpenChange(false)}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Personal clients
      </button>
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
          onClose={() => handleOpenChange(false)}
        />
      )}
    </div>
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
      <ErrorState
        title="This client could not be opened"
        description="This client is no longer listed in Client Management. They may have been removed or their application declined."
        secondaryAction={
          <Button variant="outline" onClick={onClose}>
            Back to clients
          </Button>
        }
      />
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="This client could not be opened"
        description="The latest details could not be loaded. Nothing is shown rather than an older copy."
        onRetry={state.retry}
        secondaryAction={
          <Button variant="outline" onClick={onClose}>
            Back to clients
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-nw-ink">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          Opening client profile
        </h1>
        <p className="text-sm text-nw-text-3">Loading the latest details from the server.</p>
      </div>
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

  // Refresh and Download PDF sit in the record header (design: CM 5). The PDF
  // is built from the Overview's figures, so the Overview hands its actions up;
  // from another tab, Download PDF opens the Overview and runs once it is ready.
  const overviewActionsRef = useRef<OverviewActions | null>(null);
  const [overviewGenerating, setOverviewGenerating] = useState(false);
  const pendingPdfRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const registerOverviewActions = useCallback((actions: OverviewActions | null) => {
    overviewActionsRef.current = actions;
    setOverviewGenerating(actions?.generatingPdf ?? false);
    if (actions && pendingPdfRef.current) {
      pendingPdfRef.current = false;
      void actions.downloadPdf();
    }
  }, []);

  const handleDownloadPdf = () => {
    const actions = overviewActionsRef.current;
    if (actions) {
      void actions.downloadPdf();
      return;
    }
    pendingPdfRef.current = true;
    onTabChange('overview');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      overviewActionsRef.current?.refresh();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getClientProfileQueryOptions(client.id).queryKey,
        }),
        queryClient.invalidateQueries({ queryKey: clientKeys.detail(client.id) }),
        invalidateClientPolicies(queryClient, client.id),
        queryClient.invalidateQueries({ queryKey: clientKeys.communicationLogs(client.id) }),
      ]);
      toast.success('Client details refreshed');
    } catch (error) {
      console.error('Failed to refresh client:', error);
      toast.error('Could not refresh the client');
    } finally {
      setRefreshing(false);
    }
  };

  const accountStatus = deriveAccountStatus(client);
  const approved = client.applicationStatus === 'approved';
  const shortId =
    client.id.length > 12 ? `${client.id.slice(0, 4)}…${client.id.slice(-4)}` : client.id;
  const joined = client.createdAt
    ? new Date(client.createdAt).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const copyClientId = async () => {
    try {
      await navigator.clipboard.writeText(client.id);
      toast.success('Client ID copied');
    } catch {
      toast.error('Could not copy the client ID');
    }
  };

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ClientAvatar
            clientId={client.id}
            firstName={client.firstName}
            lastName={client.lastName}
            className="h-12 w-12"
            editable={canEdit}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-nw-ink">
                {client.firstName} {client.lastName}
              </h1>
              <StatusPill
                tone={
                  accountStatus === 'active'
                    ? 'green'
                    : accountStatus === 'suspended'
                      ? 'amber'
                      : 'red'
                }
              >
                {ACCOUNT_LABEL[accountStatus]}
              </StatusPill>
              <StatusPill tone={approved ? 'violet' : 'gray'}>
                {approved ? 'Approved' : 'In application'}
              </StatusPill>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-sm text-nw-text-3">
              {client.preferredName && client.preferredName !== client.firstName && (
                <span>“{client.preferredName}” ·</span>
              )}
              <span>{client.email}</span>
              <span>·</span>
              <button
                type="button"
                onClick={() => void copyClientId()}
                className="rounded font-mono text-xs hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
                title={client.id}
                aria-label={`Copy client ID ${client.id}`}
              >
                Client ID {shortId}
              </button>
              {joined && <span>· Joined {joined}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={overviewGenerating}>
            {overviewGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Download PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setKeysOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                Key inspector
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={keysOpen} onOpenChange={setKeysOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Key inspector</DialogTitle>
            <DialogDescription>
              The calculated keys for {client.firstName} {client.lastName}, and the policies behind
              them.
            </DialogDescription>
          </DialogHeader>
          {keysOpen && (
            <Suspense fallback={<TabPanelFallback />}>
              <KeyInspectorTab selectedClient={client} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* MAIN TABS - Level 1: Primary Navigation
            Uses ShadCN Tabs component with rounded, filled style
            See: /components/admin/TAB_DESIGN_STANDARDS.md */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-6 gap-5">
        <NavTabsList aria-label="Client record">
          <NavTabsTrigger value="overview">Overview</NavTabsTrigger>
          <NavTabsTrigger value="personal">Personal details</NavTabsTrigger>
          <NavTabsTrigger value="policies">Policy details</NavTabsTrigger>
          <NavTabsTrigger value="security">Security</NavTabsTrigger>
          <NavTabsTrigger value="documents">Documents</NavTabsTrigger>
          <NavTabsTrigger value="vasco">Ask Vasco</NavTabsTrigger>
          <NavTabsTrigger value="esign">E-Sign</NavTabsTrigger>
          <NavTabsTrigger value="compliance">Compliance</NavTabsTrigger>
          <NavTabsTrigger value="communication" count={communicationCount || undefined}>
            Communication
          </NavTabsTrigger>
          <NavTabsTrigger value="notes">Notes</NavTabsTrigger>
        </NavTabsList>

        {/* 0. Overview — Client-side dashboard view */}
        <TabsContent value="overview" className="space-y-4">
          <Suspense fallback={<TabPanelFallback />}>
            <ClientOverviewTab
              client={client}
              onRegisterActions={registerOverviewActions}
              onOpenTab={onTabChange}
            />
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
        <TabsContent value="vasco" className="space-y-4">
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

const ACCOUNT_LABEL = { active: 'Active', suspended: 'Suspended', closed: 'Closed' } as const;

const PILL_TONES = {
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-nw-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  violet: 'border-violet-200 bg-nw-violet-50 text-nw-violet-600',
  gray: 'border-gray-200 bg-gray-50 text-nw-text-2',
} as const;

/** A small status pill next to the client's name. */
function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
