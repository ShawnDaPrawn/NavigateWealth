/**
 * Applications Module — Admin Application Management
 *
 * Underline tabs per status (kept in the address, ?status=), a table with a
 * main action per row, and full pages for an application's review
 * (?application=<id>), completing one on the applicant's behalf (?behalf=<id>)
 * and previewing the client form (?preview=form). Invite, approve and reject
 * are centred dialogs.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../ui/button';
import { Tabs } from '../../../ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '../../../auth/AuthContext';
import { Eye, Send } from 'lucide-react';

import { Application, TabStatus, ApplicationStats } from './types';
import { applicationsApi } from './api';
import { normalizeApplicationData } from './utils';
import { ApplicationsTable } from './components/ApplicationsTable';
import { ReviewPage } from './components/ReviewPage';
import { ApproveDialog, DeclineDialog } from './components/ActionDialogs';
import { ApplicationPreviewPage } from './components/ApplicationPreviewPage';
import { InviteDialog } from './components/InviteDialog';
import { CompleteOnBehalfPage } from './components/CompleteOnBehalfPage';
import { useCurrentUserPermissions } from '../personnel';
import { pendingCountsKeys } from '../../../../utils/queryKeys';
import {
  ErrorState,
  NavTabsList,
  NavTabsTrigger,
  NoAccess,
  PageHeader,
  useBreadcrumbTrail,
  useConfirm,
  useRecordInUrl,
  useUrlState,
} from '../../layout/page';
import { moduleSearchParams } from '../../layout/moduleSearchParams';
import { communicationApi } from '../communication';
import { downloadApplicationAsPdf } from './components/application-pdf';

const APPLICATION_STATUSES: readonly TabStatus[] = [
  'incomplete',
  'pending',
  'invited',
  'approved',
  'rejected',
  'all',
];

const TAB_LABEL: Record<TabStatus, string> = {
  incomplete: 'Incomplete',
  pending: 'Pending review',
  invited: 'Invited',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};

function tabCount(stats: ApplicationStats | null, tab: TabStatus): number | undefined {
  if (!stats) return undefined;
  switch (tab) {
    case 'incomplete':
      return stats.incomplete ?? 0;
    case 'pending':
      return stats.submitted_for_review ?? 0;
    case 'invited':
      return stats.invited ?? 0;
    case 'approved':
      return stats.approved ?? 0;
    case 'rejected':
      return stats.declined ?? 0;
    case 'all':
      return stats.total ?? 0;
  }
}

function applicantName(app: Application | null): string {
  if (!app) return '';
  const data = normalizeApplicationData(app.application_data);
  return (
    [data.firstName, data.lastName].filter(Boolean).join(' ') || app.user_name || 'the applicant'
  );
}

/** The address names the form preview with this value (?preview=form). */
const PREVIEW = 'form';

export function ApplicationsModule() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');
  const { canDo } = useCurrentUserPermissions();

  const canCreateApp = canDo('applications', 'create');
  const canApprove = canDo('applications', 'approve');

  // The status being viewed is in the address (?status=approved).
  const [activeTab, setActiveTab] = useUrlState<TabStatus>(
    'status',
    'pending',
    APPLICATION_STATUSES,
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Open pages
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [completeOnBehalfApp, setCompleteOnBehalfApp] = useState<Application | null>(null);

  // Dialog state
  const [actionApp, setActionApp] = useState<Application | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  // Read through a ref, not a dependency: depending on `applications.length`
  // changed this callback's identity when the first response arrived, which
  // re-ran the load effect and fetched the whole list a second time on every
  // open of the module.
  const hasApplicationsRef = useRef(false);

  const loadApplications = useCallback(async () => {
    try {
      setRefreshing(true);
      if (!hasApplicationsRef.current) setLoading(true);

      const data = await applicationsApi.getApplications(activeTab);
      setApplications(data);
      setLoadError(null);
      hasApplicationsRef.current = data.length > 0;
    } catch (error) {
      console.error('Error loading applications:', error);
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  const loadStats = useCallback(async () => {
    try {
      const data = await applicationsApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Load data
  useEffect(() => {
    if (isAdmin) {
      loadApplications();
    }
  }, [activeTab, isAdmin, loadApplications]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin, loadStats]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadApplications(), loadStats()]);
  }, [loadApplications, loadStats]);

  const handleTabChange = useCallback(
    (tab: TabStatus) => {
      setActiveTab(tab);
      setSearchQuery(''); // Clear search when switching tabs
    },
    [setActiveTab],
  );

  // ── Pages in the address ───────────────────────────────────────────────
  // An application named in the address is fetched by id (its detail holds
  // every field the review needs).
  const [fetching, setFetching] = useState<string | null>(null);
  const missing = useRef(new Set<string>());
  const openByIdFromUrl = (
    id: string,
    current: Application | null,
    open: (app: Application) => void,
  ): 'opened' | 'waiting' | 'missing' => {
    if (current?.id === id) return 'opened';
    if (missing.current.has(id)) {
      missing.current.delete(id);
      toast.error('Application not found', {
        description: 'It may have been removed. You are back on the list.',
      });
      return 'missing';
    }
    if (fetching !== id) {
      setFetching(id);
      applicationsApi
        .getApplicationDetail(id)
        .then((detail) => open(detail))
        .catch(() => missing.current.add(id))
        .finally(() => setFetching(null));
    }
    return 'waiting';
  };

  useRecordInUrl('application', reviewApp?.id ?? null, {
    ready: isAdmin && fetching === null,
    openFromUrl: (id) => (isAdmin ? openByIdFromUrl(id, reviewApp, setReviewApp) : 'waiting'),
    closeFromUrl: () => setReviewApp(null),
  });
  useRecordInUrl('behalf', completeOnBehalfApp?.id ?? null, {
    ready: isAdmin && fetching === null,
    openFromUrl: (id) =>
      isAdmin ? openByIdFromUrl(id, completeOnBehalfApp, setCompleteOnBehalfApp) : 'waiting',
    closeFromUrl: () => setCompleteOnBehalfApp(null),
  });
  useRecordInUrl('preview', previewOpen ? PREVIEW : null, {
    ready: true,
    openFromUrl: (value) => {
      if (value !== PREVIEW) return 'missing';
      setPreviewOpen(true);
      return 'opened';
    },
    closeFromUrl: () => setPreviewOpen(false),
  });

  const handleReview = useCallback(async (application: Application) => {
    try {
      const detail = await applicationsApi.getApplicationDetail(application.id);
      setReviewApp(detail);
    } catch (_error) {
      toast.error('Failed to load application details');
    }
  }, []);

  const handleApplicationUpdated = useCallback(
    async (updatedApp: Application) => {
      // Optimistic update first for immediate UI feedback
      setReviewApp(updatedApp);
      loadApplications();

      // Refetch detail from server to confirm persistence and ensure
      // all fields (including arrays like externalProviders) are reflected
      try {
        const detail = await applicationsApi.getApplicationDetail(updatedApp.id);
        setReviewApp(detail);
      } catch (error) {
        console.error('Failed to refetch application detail after amendment:', error);
        // Keep optimistic update on failure — user still sees their changes
      }
    },
    [loadApplications],
  );

  const handleApproveClick = useCallback(
    (application: Application) => {
      if (!canApprove) {
        toast.error('You do not have permission to approve applications');
        return;
      }
      setActionApp(application);
      setApproveDialogOpen(true);
    },
    [canApprove],
  );

  const handleDeclineClick = useCallback(
    (application: Application) => {
      if (!canApprove) {
        toast.error('You do not have permission to decline applications');
        return;
      }
      setActionApp(application);
      setDeclineReason('');
      setDeclineDialogOpen(true);
    },
    [canApprove],
  );

  const openClient = useCallback(
    (userId: string) => {
      const next = moduleSearchParams('clients');
      next.set('clientId', userId);
      setSearchParams(next);
    },
    [setSearchParams],
  );

  const afterDecision = useCallback(() => {
    loadApplications();
    loadStats();
    queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
  }, [loadApplications, loadStats, queryClient]);

  const confirmApprove = useCallback(async () => {
    if (!actionApp?.id) return;
    const approved = actionApp;

    try {
      setActionLoading(true);
      await applicationsApi.approveApplication(approved.id);
      toast.success('Application approved', {
        action: approved.user_id
          ? { label: 'Open client', onClick: () => openClient(approved.user_id) }
          : undefined,
      });
      setApproveDialogOpen(false);
      setReviewApp((open) => (open?.id === approved.id ? null : open));
      afterDecision();
    } catch (error) {
      toast.error("Couldn't approve the application. Try again.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  }, [actionApp, afterDecision, openClient]);

  const confirmDecline = useCallback(async () => {
    if (!actionApp?.id) return;
    const declined = actionApp;

    if (!declineReason.trim()) return; // the dialog says so inline

    try {
      setActionLoading(true);
      await applicationsApi.declineApplication(declined.id, declineReason);
      toast.success('Application rejected');
      setDeclineDialogOpen(false);
      setReviewApp((open) => (open?.id === declined.id ? null : open));
      afterDecision();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  }, [actionApp, declineReason, afterDecision]);

  const handleResendInvite = useCallback(async (application: Application) => {
    setResendingInviteId(application.id);
    try {
      const result = await applicationsApi.resendInvite(application.id);
      if (result.success) {
        toast.success('Invitation re-sent', {
          description: `A new invitation email has been sent to ${application.application_data?.emailAddress || 'the applicant'}.`,
        });
      } else {
        toast.error(result.error || 'Failed to resend invitation');
      }
    } catch (error: unknown) {
      console.error('Resend invite error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to resend invitation. Please try again.',
      );
    } finally {
      setResendingInviteId(null);
    }
  }, []);

  // Incomplete applications: the invite resend only serves invited ones, so a
  // reminder goes as a message (portal + email) through Communication.
  const handleSendReminder = useCallback(
    async (application: Application) => {
      const data = normalizeApplicationData(application.application_data);
      const email = data.emailAddress || application.user_email;
      const name = applicantName(application);
      if (!email) {
        toast.error('No email address on this application');
        return;
      }
      const ok = await confirm({
        title: `Send a reminder to ${name}?`,
        description: `${email} gets an email asking them to sign in and finish their application.`,
        confirmLabel: 'Send reminder',
      });
      if (!ok) return;
      const signIn = `${window.location.origin}/login`;
      try {
        const result = await communicationApi.sendDirectMessage({
          clientId: application.user_id,
          subject: 'Finish your Navigate Wealth application',
          message: `<p>Hello ${data.firstName || 'there'},</p><p>You started an application with Navigate Wealth${
            application.application_number ? ` (${application.application_number})` : ''
          } but have not finished it yet. Sign in to pick up where you left off:</p><p><a href="${signIn}">${signIn}</a></p><p>If you have any questions, reply to this email and we will help.</p>`,
          category: 'General',
          priority: 'normal',
          sendEmail: true,
          clientEmail: email,
        });
        if (result.success && result.status !== 'failed' && result.status !== 'rejected') {
          toast.success(`Reminder sent to ${email}`);
        } else {
          toast.error('Failed to send the reminder. Please try again.', {
            description: result.failureReason,
          });
        }
      } catch (error) {
        toast.error('Failed to send the reminder. Please try again.', {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [confirm],
  );

  const handleDownloadPdf = useCallback(async (application: Application) => {
    try {
      // The detail holds every field the review shows.
      const detail = await applicationsApi
        .getApplicationDetail(application.id)
        .catch(() => application);
      await downloadApplicationAsPdf(detail);
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('Application PDF error:', error);
      toast.error('Failed to generate PDF');
    }
  }, []);

  // ── Breadcrumb: Work / Applications / Pending review (/ APP-number) ──────
  const tabLabel = TAB_LABEL[activeTab];
  const backToList = () => {
    setReviewApp(null);
    setCompleteOnBehalfApp(null);
  };
  useBreadcrumbTrail(
    previewOpen
      ? [{ label: 'Preview form' }]
      : completeOnBehalfApp
        ? [{ label: tabLabel, onClick: backToList }, { label: 'Complete on behalf' }]
        : reviewApp
          ? [
              { label: tabLabel, onClick: backToList },
              { label: reviewApp.application_number || applicantName(reviewApp) },
            ]
          : [{ label: tabLabel }],
  );

  const dialogs = (
    <>
      <ApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        onConfirm={confirmApprove}
        loading={actionLoading}
        applicantName={applicantName(actionApp)}
      />
      <DeclineDialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        onConfirm={confirmDecline}
        loading={actionLoading}
        reason={declineReason}
        setReason={setDeclineReason}
        applicantName={applicantName(actionApp)}
      />
      {confirmDialog}
      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInviteSent={() => {
          loadApplications();
          loadStats();
        }}
      />
    </>
  );

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6 lg:p-8">
        <PageHeader
          title="Applications"
          description="Review, approve and manage client applications."
        />
        <NoAccess
          what="Applications"
          howToGetAccess={
            isAuthenticated
              ? 'Admin privileges are required. Log in with an admin account.'
              : 'Log in as an administrator to review applications.'
          }
          action={<Button onClick={() => navigate('/login')}>Log in</Button>}
        />
      </div>
    );
  }

  if (previewOpen) {
    return <ApplicationPreviewPage onExit={() => setPreviewOpen(false)} />;
  }

  if (completeOnBehalfApp) {
    return (
      <CompleteOnBehalfPage
        key={completeOnBehalfApp.id}
        application={completeOnBehalfApp}
        backLabel={tabLabel}
        onClose={() => setCompleteOnBehalfApp(null)}
        onComplete={afterDecision}
        adminUserId={user?.id || ''}
      />
    );
  }

  if (reviewApp) {
    return (
      <>
        <ReviewPage
          key={reviewApp.id}
          application={reviewApp}
          backLabel={tabLabel}
          onClose={() => setReviewApp(null)}
          onApprove={handleApproveClick}
          onDecline={handleDeclineClick}
          onApplicationUpdated={handleApplicationUpdated}
          onCompleteOnBehalf={(app) => {
            setReviewApp(null);
            setCompleteOnBehalfApp(app);
          }}
          onResendInvite={handleResendInvite}
          onDownloadPdf={(app) => void handleDownloadPdf(app)}
          canApprove={canApprove}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-6 lg:p-8">
      <PageHeader
        title="Applications"
        description="Review, approve and manage client applications."
        actions={
          <>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview form
            </Button>
            <Button onClick={() => setInviteDialogOpen(true)} disabled={!canCreateApp}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Invite applicant
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as TabStatus)}>
        <NavTabsList aria-label="Application status">
          {APPLICATION_STATUSES.map((tab) => (
            <NavTabsTrigger key={tab} value={tab} count={tabCount(stats, tab)}>
              {TAB_LABEL[tab]}
            </NavTabsTrigger>
          ))}
        </NavTabsList>
      </Tabs>

      {loadError && !loading && applications.length === 0 ? (
        <ErrorState
          title="Unable to load applications"
          description="Something went wrong while loading applications. Nothing you entered was lost."
          onRetry={() => void handleRefresh()}
          details={loadError}
        />
      ) : (
        <ApplicationsTable
          loading={loading}
          refreshing={refreshing}
          activeTab={activeTab}
          applications={applications}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          onReview={handleReview}
          onApprove={handleApproveClick}
          onDecline={handleDeclineClick}
          onResendInvite={handleResendInvite}
          onCompleteOnBehalf={setCompleteOnBehalfApp}
          onOpenClient={(app) => openClient(app.user_id)}
          onSendReminder={(app) => void handleSendReminder(app)}
          onDownloadPdf={(app) => void handleDownloadPdf(app)}
          onInvite={() => setInviteDialogOpen(true)}
          resendingInviteId={resendingInviteId}
          canApprove={canApprove}
          canInvite={canCreateApp}
        />
      )}

      {dialogs}
    </div>
  );
}
