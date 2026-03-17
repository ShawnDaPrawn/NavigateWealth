/**
 * Applications Module — Admin Application Management
 * Refactored: Unified navigation via stats cards, cleaner header layout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../ui/button';
import { toast } from 'sonner@2.0.3';
import { AdminAuthNotice } from '../../AdminAuthNotice';
import { useAuth } from '../../../auth/AuthContext';
import {
  Eye,
  Send,
} from 'lucide-react';

import { Application, TabStatus, ApplicationStats } from './types';
import { applicationsApi } from './api';
import { StatsCards } from './components/StatsCards';
import { ApplicationsTable } from './components/ApplicationsTable';
import { ReviewDialog } from './components/ReviewDialog';
import { ApproveDialog, DeclineDialog } from './components/ActionDialogs';
import { ApplicationPreviewDialog } from './components/ApplicationPreviewDialog';
import { InviteDialog } from './components/InviteDialog';
import { AdminCompleteDialog } from './components/AdminCompleteDialog';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';
import { pendingCountsKeys } from '../../../../utils/queryKeys';

export function ApplicationsModule() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');
  const { canDo } = useCurrentUserPermissions();

  const canCreateApp = canDo('applications', 'create');
  const canApprove = canDo('applications', 'approve');

  // State
  const [activeTab, setActiveTab] = useState<TabStatus>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Dialog state
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [completeOnBehalfApp, setCompleteOnBehalfApp] = useState<Application | null>(null);

  // Load data
  useEffect(() => {
    if (isAdmin) {
      loadApplications();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadApplications = useCallback(async () => {
    try {
      setRefreshing(true);
      if (!applications.length) setLoading(true);

      const data = await applicationsApi.getApplications(activeTab);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
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

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadApplications(), loadStats()]);
  }, [loadApplications, loadStats]);

  const handleTabChange = useCallback((tab: TabStatus) => {
    setActiveTab(tab);
    setSearchQuery(''); // Clear search when switching tabs
  }, []);

  const handleReview = useCallback(async (application: Application) => {
    try {
      const detail = await applicationsApi.getApplicationDetail(application.id);
      setSelectedApplication(detail);
      setReviewDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load application details');
    }
  }, []);

  const handleApplicationUpdated = useCallback(async (updatedApp: Application) => {
    // Optimistic update first for immediate UI feedback
    setSelectedApplication(updatedApp);
    loadApplications();

    // Refetch detail from server to confirm persistence and ensure
    // all fields (including arrays like externalProviders) are reflected
    try {
      const detail = await applicationsApi.getApplicationDetail(updatedApp.id);
      setSelectedApplication(detail);
    } catch (error) {
      console.error('Failed to refetch application detail after amendment:', error);
      // Keep optimistic update on failure — user still sees their changes
    }
  }, [loadApplications]);

  const handleApproveClick = useCallback((application: Application) => {
    if (!canApprove) {
      toast.error('You do not have permission to approve applications');
      return;
    }
    setSelectedApplication(application);
    setApproveDialogOpen(true);
  }, [canApprove]);

  const handleDeclineClick = useCallback((application: Application) => {
    if (!canApprove) {
      toast.error('You do not have permission to decline applications');
      return;
    }
    setSelectedApplication(application);
    setDeclineReason('');
    setDeclineDialogOpen(true);
  }, [canApprove]);

  const confirmApprove = useCallback(async () => {
    if (!selectedApplication?.id) return;

    try {
      setActionLoading(true);
      await applicationsApi.approveApplication(selectedApplication.id);
      toast.success('Application approved successfully');
      setApproveDialogOpen(false);
      setReviewDialogOpen(false);

      loadApplications();
      loadStats();
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  }, [selectedApplication, loadApplications, loadStats, queryClient]);

  const confirmDecline = useCallback(async () => {
    if (!selectedApplication?.id) return;

    if (!declineReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setActionLoading(true);
      await applicationsApi.declineApplication(selectedApplication.id, declineReason);
      toast.success('Application rejected');
      setDeclineDialogOpen(false);
      setReviewDialogOpen(false);

      loadApplications();
      loadStats();
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  }, [selectedApplication, declineReason, loadApplications, loadStats, queryClient]);

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
      toast.error(error?.message || 'Failed to resend invitation. Please try again.');
    } finally {
      setResendingInviteId(null);
    }
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {!isAdmin && <AdminAuthNotice />}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Applications</h2>
          <p className="text-muted-foreground mt-1">
            Review, approve, and manage client applications
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview Form
          </Button>
          <Button
            onClick={() => setInviteDialogOpen(true)}
            size="sm"
            className="gap-2"
            disabled={!isAdmin || !canCreateApp}
          >
            <Send className="h-4 w-4" />
            Invite Applicant
          </Button>
        </div>
      </div>

      {/* Stats Cards — serve as tab navigation */}
      <StatsCards stats={stats} activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* Applications Table */}
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
        resendingInviteId={resendingInviteId}
      />

      {/* Dialogs */}
      <ReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        selectedApplication={selectedApplication}
        onApprove={handleApproveClick}
        onDecline={handleDeclineClick}
        onApplicationUpdated={handleApplicationUpdated}
      />

      <ApproveDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        onConfirm={confirmApprove}
        loading={actionLoading}
      />

      <DeclineDialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        onConfirm={confirmDecline}
        loading={actionLoading}
        reason={declineReason}
        setReason={setDeclineReason}
      />

      <ApplicationPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInviteSent={() => {
          loadApplications();
          loadStats();
        }}
      />

      <AdminCompleteDialog
        application={completeOnBehalfApp}
        open={!!completeOnBehalfApp}
        onClose={() => setCompleteOnBehalfApp(null)}
        onComplete={() => {
          loadApplications();
          loadStats();
          queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
        }}
        adminUserId={user?.id || ''}
      />
    </div>
  );
}