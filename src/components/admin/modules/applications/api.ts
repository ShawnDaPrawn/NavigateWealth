import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { Application, ApplicationsResponse, StatsResponse, TabStatus } from './types';
import { ENDPOINTS, STATUS_MAP } from './constants';

export const applicationsApi = {
  getApplications: async (activeTab: TabStatus): Promise<Application[]> => {
    const backendStatus = STATUS_MAP[activeTab as keyof typeof STATUS_MAP];
    if (!backendStatus) return [];

    const url = `/${ENDPOINTS.APPLICATIONS}?status=${backendStatus}&sortBy=submitted_at&sortOrder=desc`;
    
    try {
      const data = await api.get<ApplicationsResponse>(url);
      return data.applications || [];
    } catch (error) {
      logger.error('Failed to fetch applications', error, { activeTab });
      throw error;
    }
  },

  getStats: async (): Promise<StatsResponse['stats']> => {
    try {
      const data = await api.get<StatsResponse>(`/${ENDPOINTS.STATS}`);
      return data.stats;
    } catch (error) {
      logger.error('Failed to fetch stats', error);
      throw error;
    }
  },

  getApplicationDetail: async (applicationId: string): Promise<Application> => {
    try {
      const data = await api.get<{ application: Application }>(`/${ENDPOINTS.APPLICATION_DETAIL(applicationId)}`);
      return data.application;
    } catch (error) {
      logger.error('Failed to fetch application detail', error, { applicationId });
      throw error;
    }
  },

  approveApplication: async (applicationId: string): Promise<void> => {
    try {
      await api.post(`/${ENDPOINTS.APPROVE(applicationId)}`);
    } catch (error) {
      logger.error('Failed to approve application', error, { applicationId });
      throw error;
    }
  },

  declineApplication: async (applicationId: string, reason: string): Promise<void> => {
    try {
      await api.post(`/${ENDPOINTS.DECLINE(applicationId)}`, { reason });
    } catch (error) {
      logger.error('Failed to decline application', error, { applicationId });
      throw error;
    }
  },

  updateApplicationData: async (
    applicationId: string,
    applicationData: Record<string, unknown>,
    amendmentNotes?: string,
  ): Promise<{ success: boolean; amendments_count: number }> => {
    try {
      const result = await api.patch<{ success: boolean; amendments_count: number }>(
        `/${ENDPOINTS.UPDATE_APPLICATION(applicationId)}`,
        { application_data: applicationData, amendment_notes: amendmentNotes },
      );
      return result;
    } catch (error) {
      logger.error('Failed to update application data', error, { applicationId });
      throw error;
    }
  },

  inviteApplicant: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    cellphoneNumber?: string;
  }): Promise<{
    success: boolean;
    applicationId?: string;
    applicationNumber?: string;
    error?: string;
  }> => {
    try {
      const result = await api.post<{
        success: boolean;
        applicationId?: string;
        applicationNumber?: string;
        error?: string;
      }>(`/${ENDPOINTS.INVITE}`, data);
      return result;
    } catch (error) {
      logger.error('Failed to send application invite', error, { email: data.email });
      throw error;
    }
  },

  resendInvite: async (applicationId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await api.post<{ success: boolean; error?: string }>(
        `/${ENDPOINTS.RESEND_INVITE}`,
        { applicationId },
      );
      return result;
    } catch (error) {
      logger.error('Failed to resend application invite', error, { applicationId });
      throw error;
    }
  },
};