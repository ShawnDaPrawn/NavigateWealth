/**
 * Requests Module - Service Layer
 * 
 * Business logic for request management system
 * Includes "Immune System" runtime validation using Zod
 */

import { z } from "npm:zod";
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { APIError } from './error.middleware.ts';
import {
  RequestTemplate,
  Request,
  AuditLogEntry,
  TemplateStatus,
  RequestStatus,
  AuditAction,
  ApprovalOutcome,
  RequestPriority,
  RequestCategory,
  RequestType,
  ClientAssociationRule,
  FieldType,
  FieldVisibility,
  AssignmentRule,
} from './requests-types.ts';

const log = createModuleLogger('requests-service');

// ============================================================================
// ZOD SCHEMAS FOR RUNTIME VALIDATION
// ============================================================================

// Helper for enum validation with fallback
function createEnumSchema<T extends Record<string, string>>(enumObj: T, fallback: T[keyof T]) {
  return z.nativeEnum(enumObj).catch(fallback);
}

// Request Schema - Lenient and Healing
const RequestAssigneeSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  role: z.enum(['Admin', 'Adviser', 'Compliance Officer', 'External']).catch('Admin'),
  assignedAt: z.string(),
  assignedBy: z.string(),
});

const ComplianceChecklistItemStatusSchema = z.object({
  itemId: z.string(),
  completed: z.boolean(),
  completedBy: z.string().optional(),
  completedAt: z.string().optional(),
  evidenceDocumentIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const LifecycleStageStatusSchema = z.object({
  stageId: z.string(),
  enteredAt: z.string(),
  exitedAt: z.string().optional(),
  completedRequirements: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const DeficiencySchema = z.object({
  id: z.string(),
  description: z.string(),
  requiresDocument: z.boolean(),
  requiresComment: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  remedialDocumentIds: z.array(z.string()).default([]),
  remedialComment: z.string().optional(),
});

// The main Request schema that "heals" bad data
const RequestSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  templateVersion: z.number().default(1),
  
  status: createEnumSchema(RequestStatus, RequestStatus.NEW),
  priority: createEnumSchema(RequestPriority, RequestPriority.MEDIUM),
  
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  
  // Default to empty object if missing
  requestDetails: z.record(z.unknown()).default({}),
  
  // Default to empty array if missing
  assignees: z.array(RequestAssigneeSchema).default([]),
  
  // Handle complex nested objects that might be missing in old data
  complianceApproval: z.object({
    required: z.boolean().default(false),
    checklistStatus: z.array(ComplianceChecklistItemStatusSchema).default([]),
    approvedBy: z.string().optional(),
    approvedAt: z.string().optional(),
  }).default({
    required: false,
    checklistStatus: []
  }),
  
  lifecycle: z.object({
    currentStageId: z.string().optional(),
    stageHistory: z.array(LifecycleStageStatusSchema).default([]),
    startedAt: z.string().optional(),
  }).default({
    stageHistory: []
  }),
  
  complianceSignOff: z.object({
    required: z.boolean().default(false),
    outcome: createEnumSchema(ApprovalOutcome, undefined).optional(),
    approvedBy: z.string().optional(),
    approvedAt: z.string().optional(),
    deficiencies: z.array(DeficiencySchema).default([]),
  }).default({
    required: false,
    deficiencies: []
  }),
  
  finalised: z.boolean().default(false),
  finalisedAt: z.string().optional(),
  finalisedBy: z.string().optional(),
  
  documentIds: z.array(z.string()).default([]),
  
  createdBy: z.string().default('system'),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedBy: z.string().default('system'),
  updatedAt: z.string().default(() => new Date().toISOString()),
}).passthrough(); // Allow extra properties but don't validate them

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class RequestsService {
  
  // ==========================================================================
  // TEMPLATE MANAGEMENT
  // ==========================================================================
  
  /**
   * Get all templates with optional filtering
   */
  async getAllTemplates(filters?: {
    status?: TemplateStatus[];
    category?: string[];
  }): Promise<RequestTemplate[]> {
    try {
      // Remove generic type argument as kv.getByPrefix does not support it
      const allTemplates = (await kv.getByPrefix('requests:template:')) as RequestTemplate[];
      
      // We accept templates as they are for now, assuming they are less prone to "zombie" issues
      // but we could add Zod validation here too if needed.
      
      if (!filters) {
        return allTemplates;
      }
      
      return allTemplates.filter(template => {
        if (filters.status && !filters.status.includes(template.status)) {
          return false;
        }
        if (filters.category && !filters.category.includes(template.category)) {
          return false;
        }
        return true;
      });
    } catch (error) {
      throw new APIError(`Failed to retrieve templates: ${error}`, 500);
    }
  }
  
  /**
   * Get a single template by ID
   */
  async getTemplateById(templateId: string): Promise<RequestTemplate | null> {
    try {
      // Remove generic type argument
      const template = (await kv.get(`requests:template:${templateId}`)) as RequestTemplate;
      return template;
    } catch (error) {
      throw new APIError(`Failed to retrieve template: ${error}`, 500);
    }
  }
  
  /**
   * Create a new template
   */
  async createTemplate(
    templateData: Partial<RequestTemplate>,
    userId: string,
    userName: string
  ): Promise<RequestTemplate> {
    try {
      const now = new Date().toISOString();
      const templateId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newTemplate: RequestTemplate = {
        id: templateId,
        version: 1,
        name: templateData.name || 'Untitled Template',
        category: templateData.category!,
        requestType: templateData.requestType!,
        clientAssociationRule: templateData.clientAssociationRule!,
        defaultPriority: templateData.defaultPriority || RequestPriority.MEDIUM,
        defaultQueue: templateData.defaultQueue || 'New Requests',
        providerLane: templateData.providerLane,
        status: templateData.status || TemplateStatus.DRAFT,
        requestDetailsSchema: templateData.requestDetailsSchema || [],
        assigneeConfiguration: templateData.assigneeConfiguration || {
          defaultRoles: [],
          assignmentRule: AssignmentRule.MANUAL_REQUIRED,
          allowExternalAssignees: false,
          reminderConfig: {
            enabled: false,
            intervalHours: 48,
            sendToInternal: true,
            sendToExternal: false,
          },
        },
        complianceApprovalConfig: templateData.complianceApprovalConfig || {
          enabled: false,
          checklistItems: [],
        },
        lifecycleConfiguration: templateData.lifecycleConfiguration || {
          stages: [],
        },
        complianceSignOffConfig: templateData.complianceSignOffConfig || {
          enabled: false,
          approverRole: 'Super Admin',
          deficiencyWorkflow: {
            allowDeficiencies: true,
            requireRemedialDocuments: false,
            requireRemedialComments: false,
          },
        },
        finalisationConfig: templateData.finalisationConfig || {
          completionStateLabel: 'Completed',
          lockAfterCompletion: true,
          requiredFinalDocuments: [],
          sendCompletionEmail: false,
        },
        communicationTriggers: templateData.communicationTriggers || [],
        pdfOutputConfig: templateData.pdfOutputConfig || {
          templateVersion: '1.0',
          includeSections: [],
          includeAuditLog: true,
        },
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
        owner: userId,
      };
      
      await kv.set(`requests:template:${templateId}`, newTemplate);
      
      log.success('Template created', { templateId, name: newTemplate.name });
      
      return newTemplate;
    } catch (error) {
      log.error('Failed to create template', error as Error);
      throw new Error(`Failed to create template: ${error}`);
    }
  }
  
  /**
   * Update an existing template
   * If template is active and createNewVersion=true, creates a new version
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<RequestTemplate>,
    userId: string,
    userName: string,
    createNewVersion: boolean = false
  ): Promise<RequestTemplate> {
    try {
      const existingTemplate = await this.getTemplateById(templateId);
      
      if (!existingTemplate) {
        throw new Error('Template not found');
      }
      
      const now = new Date().toISOString();
      
      // If template is active and we should create new version
      if (existingTemplate.status === TemplateStatus.ACTIVE && createNewVersion) {
        const newVersionId = `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newVersion: RequestTemplate = {
          ...existingTemplate,
          ...updates,
          id: newVersionId,
          version: existingTemplate.version + 1,
          previousVersionId: templateId,
          updatedBy: userId,
          updatedAt: now,
        };
        
        await kv.set(`requests:template:${newVersionId}`, newVersion);
        
        // Archive the old version
        await kv.set(`requests:template:${templateId}`, {
          ...existingTemplate,
          status: TemplateStatus.ARCHIVED,
          updatedBy: userId,
          updatedAt: now,
        });
        
        log.success('Template version created', { 
          oldId: templateId, 
          newId: newVersionId, 
          version: newVersion.version 
        });
        
        return newVersion;
      } else {
        // Simple update without versioning
        const updatedTemplate: RequestTemplate = {
          ...existingTemplate,
          ...updates,
          updatedBy: userId,
          updatedAt: now,
        };
        
        await kv.set(`requests:template:${templateId}`, updatedTemplate);
        
        log.success('Template updated', { templateId });
        
        return updatedTemplate;
      }
    } catch (error) {
      log.error('Failed to update template', error as Error, { templateId });
      throw new Error(`Failed to update template: ${error}`);
    }
  }
  
  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    userId: string,
    userName: string
  ): Promise<RequestTemplate> {
    try {
      const existingTemplate = await this.getTemplateById(templateId);
      
      if (!existingTemplate) {
        throw new Error('Template not found');
      }
      
      const newTemplate = await this.createTemplate(
        {
          ...existingTemplate,
          name: `${existingTemplate.name} (Copy)`,
          status: TemplateStatus.DRAFT,
        },
        userId,
        userName
      );
      
      log.success('Template duplicated', { 
        originalId: templateId, 
        newId: newTemplate.id 
      });
      
      return newTemplate;
    } catch (error) {
      log.error('Failed to duplicate template', error as Error, { templateId });
      throw new Error(`Failed to duplicate template: ${error}`);
    }
  }
  
  /**
   * Archive a template
   */
  async archiveTemplate(
    templateId: string,
    userId: string,
    userName: string
  ): Promise<RequestTemplate> {
    try {
      const updatedTemplate = await this.updateTemplate(
        templateId,
        { status: TemplateStatus.ARCHIVED },
        userId,
        userName,
        false
      );
      
      log.success('Template archived', { templateId });
      
      return updatedTemplate;
    } catch (error) {
      log.error('Failed to archive template', error as Error, { templateId });
      throw new Error(`Failed to archive template: ${error}`);
    }
  }
  
  // ==========================================================================
  // REQUEST MANAGEMENT (WITH ZOD VALIDATION)
  // ==========================================================================
  
  /**
   * Helper to validate and heal a request object
   */
  private validateAndHealRequest(data: Record<string, unknown>): Request {
    const result = RequestSchema.safeParse(data);
    
    if (result.success) {
      return result.data as Request;
    } else {
      log.warn('Found malformed request, attempting to heal', { 
        requestId: data.id, 
        errors: result.error.errors 
      });
      
      // If Zod fails, we can either return null or try to force it.
      // Since our schema uses .default() heavily, safeParse should succeed even for partial data.
      // If it fails, it means there's a type mismatch that couldn't be coerced (e.g. array vs object).
      // In that case, we might need to return a minimal valid object or the original data casted
      // (but original data causes frontend crashes).
      
      // Attempt to salvage ID and TemplateID at minimum
      const salvaged: Request = {
         id: data.id || 'unknown',
         templateId: data.templateId || 'unknown',
         templateVersion: data.templateVersion || 1,
         status: data.status || RequestStatus.NEW,
         priority: data.priority || RequestPriority.MEDIUM,
         requestDetails: data.requestDetails || {},
         assignees: Array.isArray(data.assignees) ? data.assignees : [],
         complianceApproval: {
           required: false,
           checklistStatus: [],
           ...data.complianceApproval
         },
         lifecycle: {
           stageHistory: [],
           ...data.lifecycle
         },
         complianceSignOff: {
           required: false,
           deficiencies: [],
           ...data.complianceSignOff
         },
         finalised: !!data.finalised,
         documentIds: Array.isArray(data.documentIds) ? data.documentIds : [],
         createdBy: data.createdBy || 'system',
         createdAt: data.createdAt || new Date().toISOString(),
         updatedBy: data.updatedBy || 'system',
         updatedAt: data.updatedAt || new Date().toISOString(),
      };
      
      return salvaged;
    }
  }

  /**
   * Get all requests with optional filtering
   */
  async getAllRequests(filters?: {
    status?: RequestStatus[];
    templateId?: string;
    clientId?: string;
    assigneeId?: string;
  }): Promise<Request[]> {
    try {
      // Remove generic type argument
      const rawRequests = await kv.getByPrefix('requests:request:');
      
      // Validate and heal every request
      const validRequests = rawRequests.map(r => this.validateAndHealRequest(r));
      
      if (!filters) {
        return validRequests;
      }
      
      return validRequests.filter(request => {
        if (filters.status && !filters.status.includes(request.status)) {
          return false;
        }
        if (filters.templateId && request.templateId !== filters.templateId) {
          return false;
        }
        if (filters.clientId && request.clientId !== filters.clientId) {
          return false;
        }
        if (filters.assigneeId && !request.assignees.some(a => a.userId === filters.assigneeId)) {
          return false;
        }
        return true;
      });
    } catch (error) {
      log.error('Failed to retrieve requests', error as Error);
      throw new APIError(`Failed to retrieve requests: ${(error as Error).message}`, 500);
    }
  }
  
  /**
   * Get a single request by ID
   */
  async getRequestById(requestId: string): Promise<Request | null> {
    try {
      // Remove generic type argument
      const rawRequest = await kv.get(`requests:request:${requestId}`);
      
      if (!rawRequest) return null;
      
      return this.validateAndHealRequest(rawRequest);
    } catch (error) {
      throw new APIError(`Failed to retrieve request: ${error}`, 500);
    }
  }
  
  /**
   * Create a new request from a template
   */
  async createRequest(
    templateId: string,
    requestData: {
      clientId?: string;
      clientName?: string;
      requestDetails: Record<string, unknown>;
      assignees?: string[];
      priority?: RequestPriority;
    },
    userId: string,
    userName: string
  ): Promise<Request> {
    try {
      const template = await this.getTemplateById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      if (template.status !== TemplateStatus.ACTIVE) {
        throw new Error('Cannot create request from inactive template');
      }
      
      const now = new Date().toISOString();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize compliance checklist status
      const checklistStatus = template.complianceApprovalConfig.checklistItems.map(item => ({
        itemId: item.id,
        completed: false,
        evidenceDocumentIds: [],
      }));
      
      const newRequest: Request = {
        id: requestId,
        templateId: template.id,
        templateVersion: template.version,
        status: RequestStatus.NEW,
        priority: requestData.priority || template.defaultPriority,
        clientId: requestData.clientId,
        clientName: requestData.clientName,
        requestDetails: requestData.requestDetails,
        assignees: [],
        complianceApproval: {
          required: template.complianceApprovalConfig.enabled,
          checklistStatus,
        },
        lifecycle: {
          stageHistory: [],
        },
        complianceSignOff: {
          required: template.complianceSignOffConfig.enabled,
          deficiencies: [],
        },
        finalised: false,
        documentIds: [],
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      };
      
      await kv.set(`requests:request:${requestId}`, newRequest);
      
      // Create audit log entry
      await this.createAuditLogEntry(requestId, AuditAction.CREATED, userId, userName, {
        templateId,
        templateName: template.name,
      });
      
      log.success('Request created', { requestId, templateId });
      
      return newRequest;
    } catch (error) {
      log.error('Failed to create request', error as Error, { templateId });
      throw new Error(`Failed to create request: ${error}`);
    }
  }
  
  /**
   * Update a request
   */
  async updateRequest(
    requestId: string,
    updates: Partial<Request>,
    userId: string,
    userName: string
  ): Promise<Request> {
    try {
      const existingRequest = await this.getRequestById(requestId);
      
      if (!existingRequest) {
        throw new Error('Request not found');
      }
      
      if (existingRequest.finalised) {
        throw new Error('Cannot update finalised request');
      }
      
      const now = new Date().toISOString();
      
      const updatedRequest: Request = {
        ...existingRequest,
        ...updates,
        updatedBy: userId,
        updatedAt: now,
      };
      
      await kv.set(`requests:request:${requestId}`, updatedRequest);
      
      await this.createAuditLogEntry(requestId, AuditAction.UPDATED, userId, userName, {
        changes: updates,
      });
      
      log.success('Request updated', { requestId });
      
      return updatedRequest;
    } catch (error) {
      log.error('Failed to update request', error as Error, { requestId });
      throw new Error(`Failed to update request: ${error}`);
    }
  }
  
  /**
   * Move request to a different lifecycle stage
   */
  async moveLifecycleStage(
    requestId: string,
    targetStageId: string,
    userId: string,
    userName: string,
    notes?: string
  ): Promise<Request> {
    try {
      const request = await this.getRequestById(requestId);
      
      if (!request) {
        throw new Error('Request not found');
      }
      
      const template = await this.getTemplateById(request.templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      const now = new Date().toISOString();
      
      // Check if this is the first stage entry
      const isFirstStage = request.lifecycle.stageHistory.length === 0;
      
      // Exit current stage if exists
      if (request.lifecycle.currentStageId) {
        const currentStageIndex = request.lifecycle.stageHistory.findIndex(
          s => s.stageId === request.lifecycle.currentStageId && !s.exitedAt
        );
        if (currentStageIndex >= 0) {
          request.lifecycle.stageHistory[currentStageIndex].exitedAt = now;
        }
      }
      
      // Enter new stage
      request.lifecycle.currentStageId = targetStageId;
      request.lifecycle.stageHistory.push({
        stageId: targetStageId,
        enteredAt: now,
        completedRequirements: [],
      });
      
      // If entering lifecycle for the first time, update status
      if (isFirstStage) {
        request.status = RequestStatus.IN_LIFECYCLE;
        request.lifecycle.startedAt = now;
      }
      
      const updatedRequest = await this.updateRequest(requestId, request, userId, userName);
      
      await this.createAuditLogEntry(requestId, AuditAction.STAGE_MOVED_FORWARD, userId, userName, {
        targetStageId,
        notes,
      });
      
      log.success('Lifecycle stage moved', { requestId, targetStageId });
      
      return updatedRequest;
    } catch (error) {
      log.error('Failed to move lifecycle stage', error as Error, { requestId });
      throw new Error(`Failed to move lifecycle stage: ${error}`);
    }
  }
  
  /**
   * Update compliance sign-off
   */
  async updateComplianceSignOff(
    requestId: string,
    outcome: ApprovalOutcome,
    userId: string,
    userName: string,
    deficiencies?: Array<{
      description: string;
      requiresDocument: boolean;
      requiresComment: boolean;
    }>
  ): Promise<Request> {
    try {
      const request = await this.getRequestById(requestId);
      
      if (!request) {
        throw new Error('Request not found');
      }
      
      const now = new Date().toISOString();
      
      request.complianceSignOff.outcome = outcome;
      request.complianceSignOff.approvedBy = userId;
      request.complianceSignOff.approvedAt = now;
      
      if (outcome === ApprovalOutcome.DEFICIENT && deficiencies) {
        request.complianceSignOff.deficiencies = deficiencies.map(d => ({
          id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...d,
          createdBy: userId,
          createdAt: now,
          remedialDocumentIds: [],
        }));
      }
      
      if (outcome === ApprovalOutcome.APPROVED) {
        request.status = RequestStatus.IN_SIGN_OFF;
      }
      
      const updatedRequest = await this.updateRequest(requestId, request, userId, userName);
      
      await this.createAuditLogEntry(
        requestId,
        outcome === ApprovalOutcome.APPROVED ? AuditAction.COMPLIANCE_APPROVED : AuditAction.COMPLIANCE_REJECTED,
        userId,
        userName,
        { outcome, deficiencies }
      );
      
      log.success('Compliance sign-off updated', { requestId, outcome });
      
      return updatedRequest;
    } catch (error) {
      log.error('Failed to update compliance sign-off', error as Error, { requestId });
      throw new Error(`Failed to update compliance sign-off: ${error}`);
    }
  }
  
  /**
   * Finalise a request
   */
  async finaliseRequest(
    requestId: string,
    userId: string,
    userName: string
  ): Promise<Request> {
    try {
      const request = await this.getRequestById(requestId);
      
      if (!request) {
        throw new Error('Request not found');
      }
      
      const template = await this.getTemplateById(request.templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Validate all requirements are met
      if (request.complianceSignOff.required && request.complianceSignOff.outcome !== ApprovalOutcome.APPROVED) {
        throw new Error('Compliance sign-off must be approved before finalisation');
      }
      
      const now = new Date().toISOString();
      
      request.finalised = true;
      request.finalisedAt = now;
      request.finalisedBy = userId;
      request.status = RequestStatus.COMPLETED;
      
      const updatedRequest = await this.updateRequest(requestId, request, userId, userName);
      
      await this.createAuditLogEntry(requestId, AuditAction.FINALISED, userId, userName, {
        finalisedAt: now,
      });
      
      log.success('Request finalised', { requestId });
      
      return updatedRequest;
    } catch (error) {
      log.error('Failed to finalise request', error as Error, { requestId });
      throw new Error(`Failed to finalise request: ${error}`);
    }
  }
  
  /**
   * Delete a request
   */
  async deleteRequest(
    requestId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const request = await this.getRequestById(requestId);
      
      if (!request) {
        throw new Error('Request not found');
      }
      
      await kv.del(`requests:request:${requestId}`);
      
      await this.createAuditLogEntry(requestId, AuditAction.DELETED, userId, userName, {});
      
      log.success('Request deleted', { requestId });
    } catch (error) {
      log.error('Failed to delete request', error as Error, { requestId });
      throw new Error(`Failed to delete request: ${error}`);
    }
  }
  
  // ==========================================================================
  // AUDIT LOG
  // ==========================================================================
  
  /**
   * Create an audit log entry
   */
  async createAuditLogEntry(
    requestId: string,
    action: AuditAction,
    userId: string,
    userName: string,
    details: Record<string, unknown>,
    previousValue?: unknown,
    newValue?: unknown
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const entry: AuditLogEntry = {
        id: auditId,
        requestId,
        action,
        performedBy: userId,
        performedByName: userName,
        performedAt: now,
        details,
        previousValue,
        newValue,
      };
      
      await kv.set(`requests:audit:${requestId}:${now}`, entry);
    } catch (error) {
      // Don't throw - audit logging should not break main operations
      log.warn('Failed to create audit log entry', { requestId, action, error });
    }
  }
  
  /**
   * Get audit log for a request
   */
  async getAuditLog(requestId: string): Promise<AuditLogEntry[]> {
    try {
      const entries = await kv.getByPrefix<AuditLogEntry>(`requests:audit:${requestId}:`);
      return entries.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    } catch (error) {
      throw new Error(`Failed to retrieve audit log: ${error}`);
    }
  }
}