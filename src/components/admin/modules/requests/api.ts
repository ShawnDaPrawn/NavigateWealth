// ============================================================================
// REQUESTS API
// Navigate Wealth Admin Dashboard
//
// Client-side API for requests and templates using shared API client
//
// Provides two namespaces:
// - templateApi: Template CRUD operations
// - requestApi: Request CRUD and workflow operations
//
// All functions use the shared API client with automatic error handling
// and authentication.
//
// @module requests/api
// ============================================================================

import { api } from '../../../../utils/api/client';
import {
  RequestTemplate,
  Request,
  CreateRequestRequest,
  MoveLifecycleStageRequest,
  ComplianceApprovalRequest,
  AuditLogEntry,
  ListRequestsFilters,
} from './types';

// ============================================================================
// TEMPLATE API NAMESPACE
// ============================================================================

/**
 * Template API operations
 * 
 * Manages request templates (blueprints for requests)
 */
export const templateApi = {
  /**
   * Get all templates
   * 
   * @param filters - Optional filters for status and category
   * @returns Promise resolving to array of templates
   * 
   * @example
   * ```typescript
   * const activeTemplates = await templateApi.getAll({ 
   *   status: ['Active'],
   *   category: ['Risk', 'Retirement']
   * });
   * ```
   */
  async getAll(filters?: { status?: string[]; category?: string[] }): Promise<RequestTemplate[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status.join(','));
    if (filters?.category) params.append('category', filters.category.join(','));

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{ success: boolean; data: RequestTemplate[] }>(`/requests/templates${query}`);
    return response.data || [];
  },

  /**
   * Get a single template by ID
   * 
   * @param id - Template ID
   * @returns Promise resolving to template
   * 
   * @example
   * ```typescript
   * const template = await templateApi.getById('tmpl_123');
   * ```
   */
  async getById(id: string): Promise<RequestTemplate> {
    const response = await api.get<{ success: boolean; data: RequestTemplate }>(`/requests/templates/${id}`);
    return response.data;
  },

  /**
   * Create a new template
   * 
   * @param template - Template data
   * @returns Promise resolving to created template
   * 
   * @example
   * ```typescript
   * const newTemplate = await templateApi.create({
   *   name: 'Risk Policy Request',
   *   category: RequestCategory.RISK,
   *   requestType: RequestType.QUOTE,
   *   clientAssociationRule: ClientAssociationRule.REQUIRED,
   *   defaultPriority: RequestPriority.MEDIUM,
   *   status: TemplateStatus.DRAFT
   * });
   * ```
   */
  async create(template: Partial<RequestTemplate>): Promise<RequestTemplate> {
    const response = await api.post<{ success: boolean; data: RequestTemplate }>('/requests/templates', template);
    return response.data;
  },

  /**
   * Update a template
   * 
   * @param id - Template ID
   * @param template - Updated template data
   * @param createNewVersion - Whether to create a new version
   * @returns Promise resolving to updated template
   * 
   * @example
   * ```typescript
   * const updated = await templateApi.update('tmpl_123', {
   *   name: 'Updated Template Name'
   * }, false);
   * ```
   */
  async update(id: string, template: Partial<RequestTemplate>, createNewVersion: boolean = false): Promise<RequestTemplate> {
    const response = await api.put<{ success: boolean; data: RequestTemplate }>(`/requests/templates/${id}`, { ...template, createNewVersion });
    return response.data;
  },

  /**
   * Duplicate a template
   * 
   * @param id - Template ID to duplicate
   * @returns Promise resolving to duplicated template
   * 
   * @example
   * ```typescript
   * const duplicate = await templateApi.duplicate('tmpl_123');
   * ```
   */
  async duplicate(id: string): Promise<RequestTemplate> {
    const response = await api.post<{ success: boolean; data: RequestTemplate }>(`/requests/templates/${id}/duplicate`);
    return response.data;
  },

  /**
   * Archive a template
   * 
   * @param id - Template ID to archive
   * @returns Promise resolving to archived template
   * 
   * @example
   * ```typescript
   * await templateApi.archive('tmpl_123');
   * ```
   */
  async archive(id: string): Promise<RequestTemplate> {
    const response = await api.delete<{ success: boolean; data: RequestTemplate }>(`/requests/templates/${id}`);
    return response.data;
  },
};

// ============================================================================
// REQUEST API NAMESPACE
// ============================================================================

/**
 * Request API operations
 * 
 * Manages request instances, workflow, and lifecycle
 */
export const requestApi = {
  /**
   * Get all requests
   * 
   * @param filters - Optional filters
   * @returns Promise resolving to array of requests
   * 
   * @example
   * ```typescript
   * const requests = await requestApi.getAll({
   *   status: ['IN_LIFECYCLE'],
   *   priority: ['URGENT'],
   *   assigneeId: 'user_123'
   * });
   * ```
   */
  async getAll(filters?: ListRequestsFilters): Promise<Request[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status.join(','));
    if (filters?.templateId) params.append('templateId', filters.templateId);
    if (filters?.clientId) params.append('clientId', filters.clientId);
    if (filters?.assigneeId) params.append('assigneeId', filters.assigneeId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{ success: boolean; data: Request[] }>(`/requests${query}`);
    return response.data || [];
  },

  /**
   * Get a single request by ID
   * 
   * @param id - Request ID
   * @returns Promise resolving to request
   * 
   * @example
   * ```typescript
   * const request = await requestApi.getById('req_123');
   * ```
   */
  async getById(id: string): Promise<Request> {
    const response = await api.get<{ success: boolean; data: Request }>(`/requests/${id}`);
    return response.data;
  },

  /**
   * Create a new request
   * 
   * @param request - Request data
   * @returns Promise resolving to created request
   * 
   * @example
   * ```typescript
   * const newRequest = await requestApi.create({
   *   templateId: 'tmpl_123',
   *   clientId: 'client_123',
   *   assigneeId: 'user_123',
   *   priority: RequestPriority.HIGH,
   *   status: RequestStatus.IN_LIFECYCLE
   * });
   * ```
   */
  async create(request: CreateRequestRequest): Promise<Request> {
    const response = await api.post<{ success: boolean; data: Request }>('/requests', request);
    return response.data;
  },

  /**
   * Update a request
   * 
   * @param id - Request ID
   * @param updates - Updated request data
   * @returns Promise resolving to updated request
   * 
   * @example
   * ```typescript
   * const updated = await requestApi.update('req_123', {
   *   priority: RequestPriority.MEDIUM
   * });
   * ```
   */
  async update(id: string, updates: Partial<Request>): Promise<Request> {
    const response = await api.put<{ success: boolean; data: Request }>(`/requests/${id}`, updates);
    return response.data;
  },

  /**
   * Delete a request
   * 
   * @param id - Request ID
   * @returns Promise resolving to void
   * 
   * @example
   * ```typescript
   * await requestApi.delete('req_123');
   * ```
   */
  async delete(id: string): Promise<void> {
    await api.delete<void>(`/requests/${id}`);
  },

  /**
   * Move lifecycle stage
   * 
   * @param id - Request ID
   * @param data - Lifecycle stage data
   * @returns Promise resolving to updated request
   * 
   * @example
   * ```typescript
   * const updated = await requestApi.moveLifecycleStage('req_123', {
   *   stage: LifecycleStage.APPROVAL
   * });
   * ```
   */
  async moveLifecycleStage(id: string, data: MoveLifecycleStageRequest): Promise<Request> {
    const response = await api.patch<{ success: boolean; data: Request }>(`/requests/${id}/lifecycle`, data);
    return response.data;
  },

  /**
   * Update compliance approval
   * 
   * @param id - Request ID
   * @param complianceApproval - Compliance approval data
   * @returns Promise resolving to updated request
   * 
   * @example
   * ```typescript
   * const updated = await requestApi.updateCompliance('req_123', {
   *   approved: true,
   *   comments: 'Compliance checks passed'
   * });
   * ```
   */
  async updateCompliance(id: string, complianceApproval: Record<string, unknown>): Promise<Request> {
    const response = await api.patch<{ success: boolean; data: Request }>(`/requests/${id}/compliance`, { complianceApproval });
    return response.data;
  },

  /**
   * Compliance sign-off
   * 
   * @param id - Request ID
   * @param data - Sign-off data
   * @returns Promise resolving to updated request
   * 
   * @example
   * ```typescript
   * const updated = await requestApi.signOff('req_123', {
   *   signOffBy: 'user_123',
   *   signOffDate: new Date().toISOString()
   * });
   * ```
   */
  async signOff(id: string, data: ComplianceApprovalRequest): Promise<Request> {
    const response = await api.patch<{ success: boolean; data: Request }>(`/requests/${id}/sign-off`, data);
    return response.data;
  },

  /**
   * Finalise request
   * 
   * @param id - Request ID
   * @returns Promise resolving to updated request
   * 
   * @example
   * ```typescript
   * const finalised = await requestApi.finalise('req_123');
   * ```
   */
  async finalise(id: string): Promise<Request> {
    const response = await api.patch<{ success: boolean; data: Request }>(`/requests/${id}/finalise`);
    return response.data;
  },

  /**
   * Get audit log
   * 
   * @param id - Request ID
   * @returns Promise resolving to array of audit log entries
   * 
   * @example
   * ```typescript
   * const auditLog = await requestApi.getAuditLog('req_123');
   * ```
   */
  async getAuditLog(id: string): Promise<AuditLogEntry[]> {
    const response = await api.get<{ success: boolean; data: AuditLogEntry[] }>(`/requests/${id}/audit-log`);
    return response.data || [];
  },
};