/**
 * Advice Engine Module - API Layer
 * 
 * Centralized API client for all advice engine operations.
 * Provides type-safe methods for:
 * - AI chat interactions
 * - Client search
 * - Chat history management
 * - Record of Advice (RoA) drafts
 * 
 * @module advice-engine/api
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { ENDPOINTS } from './constants';
import type {
  ChatRequest,
  ChatResponse,
  ApiKeyStatus,
  SearchClientRequest,
  SearchClientResponse,
  HistoryData,
  RoADraft,
  RoAModule,
  RoAClientContext,
  RoAEvidenceItem,
  RoAGeneratedDocument,
  RoACompiledOutput,
  RoAModuleContract,
  RoAModuleContractSchemaFormat,
  RoAValidationResult,
  Client,
  Personnel,
} from './types';
import { moduleContractToRuntimeModule } from './roaModuleRuntime';

function normaliseClient(raw: Record<string, unknown>): Client {
  const profile = (raw.profile && typeof raw.profile === 'object' ? raw.profile : {}) as Record<string, unknown>;
  const personal = (profile.personalInformation && typeof profile.personalInformation === 'object'
    ? profile.personalInformation
    : {}) as Record<string, unknown>;

  return {
    user_id: String(raw.user_id || raw.id || profile.userId || ''),
    first_name: String(raw.first_name || raw.firstName || personal.firstName || ''),
    last_name: String(raw.last_name || raw.lastName || raw.surname || personal.lastName || ''),
    email: String(raw.email || personal.email || ''),
    phone: (raw.phone || raw.phoneNumber || personal.cellphone) as string | undefined,
    id_number: (raw.id_number || raw.idNumber || personal.idNumber) as string | undefined,
    date_of_birth: (raw.date_of_birth || raw.dateOfBirth || personal.dateOfBirth) as string | undefined,
  };
}

function normaliseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normaliseDraft(raw: RoADraft): RoADraft {
  return {
    ...raw,
    createdAt: normaliseDate(raw.createdAt),
    updatedAt: normaliseDate(raw.updatedAt),
  };
}

// ============================================================================
// Clients API
// ============================================================================

/**
 * Clients API
 * Handles client data fetching
 */
export const clientsApi = {
  /**
   * Get client by ID
   * 
   * @param clientId - Client ID
   * @returns Client details
   * @throws {APIError} If request fails
   */
  async getClient(clientId: string): Promise<Client> {
    try {
      const response = await api.get<{ client: Client }>(
        `${ENDPOINTS.CLIENT_DETAILS}/${clientId}`
      );
      return normaliseClient(response.client as unknown as Record<string, unknown>);
    } catch (error) {
      logger.error(`Failed to get client ${clientId}`, error);
      throw error;
    }
  },
};

// ============================================================================
// Personnel API
// ============================================================================

/**
 * Personnel API
 * Handles personnel/advisor data fetching
 */
export const personnelApi = {
  /**
   * Get all personnel
   * 
   * @returns List of personnel
   */
  async getPersonnel(): Promise<Personnel[]> {
    try {
      const response = await api.get<{ data: Personnel[] }>(
        ENDPOINTS.PERSONNEL_LIST
      );
      return response.data || [];
    } catch (error) {
      logger.error('Failed to get personnel', error);
      return [];
    }
  },
};

// ============================================================================
// AI Intelligence API
// ============================================================================

/**
 * AI Intelligence API
 * Handles AI chat, history, and client search
 */
export const aiIntelligenceApi = {
  /**
   * Get API key status
   * 
   * @returns API key status
   * @throws {APIError} If request fails
   * 
   * @example
   * const status = await aiIntelligenceApi.getStatus();
   * if (status.configured) {
   *   console.log('API key is configured');
   * }
   */
  async getStatus(): Promise<ApiKeyStatus> {
    try {
      const response = await api.get<ApiKeyStatus>(ENDPOINTS.AI_STATUS);
      return response;
    } catch (error) {
      logger.error('Failed to get API key status', error);
      // Return default unconfigured status on error
      return {
        configured: false,
        valid: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Send a chat message to the AI
   * 
   * @param request - Chat request data
   * @returns AI response
   * @throws {APIError} If request fails or API key is invalid
   * 
   * @example
   * const response = await aiIntelligenceApi.sendMessage({
   *   message: 'What are the client\'s active policies?',
   *   clientId: 'client-123',
   *   conversationHistory: [...previousMessages]
   * });
   * console.log(response.reply);
   */
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await api.post<ChatResponse>(ENDPOINTS.AI_CHAT, {
        message: request.message,
        clientId: request.clientId || null,
        conversationHistory: request.conversationHistory || [],
      });

      return response;
    } catch (error) {
      logger.error('Failed to send chat message', error);
      
      const message = getErrorMessage(error);
      // Handle specific error cases
      if (message.includes('API key') || message.includes('401')) {
        throw new Error('⚠️ OpenAI API Key Issue\n\nThe OpenAI API key needs to be updated.');
      }
      if (message.includes('403')) {
        throw new Error('Access denied. Admin privileges required.');
      }
      
      throw error;
    }
  },

  /**
   * Get chat history
   * 
   * @returns Chat history data
   * @throws {APIError} If request fails
   * 
   * @example
   * const history = await aiIntelligenceApi.getHistory();
   * history.messages.forEach(msg => {
   *   console.log(`${msg.query} -> ${msg.reply}`);
   * });
   */
  async getHistory(): Promise<HistoryData> {
    try {
      const response = await api.get<HistoryData>(ENDPOINTS.AI_HISTORY);
      return response;
    } catch (error) {
      logger.error('Failed to get chat history', error);
      // Return empty history on error
      return { messages: [] };
    }
  },

  /**
   * Clear chat history
   * 
   * @throws {APIError} If request fails
   * 
   * @example
   * await aiIntelligenceApi.clearHistory();
   * console.log('Chat history cleared');
   */
  async clearHistory(): Promise<void> {
    try {
      await api.delete(ENDPOINTS.AI_HISTORY);
    } catch (error) {
      logger.error('Failed to clear chat history', error);
      throw error;
    }
  },

  /**
   * Search for clients
   * 
   * @param searchTerm - Search query
   * @param limit - Maximum results (default: 10)
   * @returns Search results
   * @throws {APIError} If request fails
   * 
   * @example
   * const results = await aiIntelligenceApi.searchClients('John Smith');
   * console.log(`Found ${results.clients.length} clients`);
   */
  async searchClients(searchTerm: string, limit: number = 10): Promise<SearchClientResponse> {
    try {
      // Don't search if term is too short
      if (!searchTerm || searchTerm.length < 2) {
        return { clients: [], totalCount: 0 };
      }

      const request: SearchClientRequest = {
        searchTerm,
        limit,
      };

      const response = await api.post<SearchClientResponse>(
        ENDPOINTS.AI_SEARCH_CLIENTS,
        request
      );

      return response;
    } catch (error) {
      logger.error('Failed to search clients', error, { searchTerm });
      // Return empty results on error
      return { clients: [], totalCount: 0 };
    }
  },
};

// ============================================================================
// Record of Advice (RoA) API
// ============================================================================

/**
 * RoA API
 * Handles Record of Advice draft management
 */
export const roaApi = {
  /**
   * Get available RoA modules
   * 
   * @returns Array of RoA modules
   * @throws {APIError} If request fails
   * 
   * @example
   * const modules = await roaApi.getModules();
   * console.log(`${modules.length} modules available`);
   */
  async getModules(): Promise<RoAModule[]> {
    try {
      const response = await api.get<{ contracts: RoAModuleContract[] }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}?status=active`
      );
      const contractModules = (response.contracts || []).map(moduleContractToRuntimeModule);
      if (contractModules.length > 0) return contractModules;
    } catch (error) {
      logger.error('Failed to get RoA modules from active contracts', error);
    }

    try {
      const response = await api.get<{ modules: RoAModule[] }>(ENDPOINTS.ROA_MODULES);
      return response.modules || [];
    } catch (error) {
      logger.error('Failed to get legacy RoA modules fallback', error);
      return [];
    }
  },

  /**
   * Get the controlled schema format used by the super-admin contract editor.
   */
  async getModuleContractSchemaFormat(): Promise<RoAModuleContractSchemaFormat> {
    try {
      const response = await api.get<{ schema: RoAModuleContractSchemaFormat }>(
        ENDPOINTS.ROA_MODULE_CONTRACT_SCHEMA
      );
      return response.schema;
    } catch (error) {
      logger.error('Failed to get RoA module contract schema format', error);
      throw error;
    }
  },

  /**
   * Get editable RoA module contracts.
   */
  async getModuleContracts(options: { status?: string; includeArchived?: boolean } = {}): Promise<RoAModuleContract[]> {
    try {
      const params = new URLSearchParams();
      if (options.status) params.set('status', options.status);
      if (options.includeArchived) params.set('includeArchived', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ contracts: RoAModuleContract[] }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}${query}`
      );
      return response.contracts || [];
    } catch (error) {
      logger.error('Failed to get RoA module contracts', error);
      return [];
    }
  },

  /**
   * Get one editable RoA module contract.
   */
  async getModuleContract(moduleId: string): Promise<RoAModuleContract> {
    try {
      const response = await api.get<{ contract: RoAModuleContract }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}/${moduleId}`
      );
      return response.contract;
    } catch (error) {
      logger.error('Failed to get RoA module contract', error, { moduleId });
      throw error;
    }
  },

  /**
   * Save a draft/active module contract. Requires super-admin server access.
   */
  async saveModuleContract(contract: RoAModuleContract): Promise<RoAModuleContract> {
    try {
      const response = await api.put<{ contract: RoAModuleContract }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}/${contract.id}`,
        contract
      );
      return response.contract;
    } catch (error) {
      logger.error('Failed to save RoA module contract', error, { moduleId: contract.id });
      throw error;
    }
  },

  /**
   * Publish a module contract so advisers can use it in RoA drafting.
   */
  async publishModuleContract(moduleId: string): Promise<RoAModuleContract> {
    try {
      const response = await api.post<{ contract: RoAModuleContract }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}/${moduleId}/publish`,
        {}
      );
      return response.contract;
    } catch (error) {
      logger.error('Failed to publish RoA module contract', error, { moduleId });
      throw error;
    }
  },

  /**
   * Archive a module contract while retaining its version history.
   */
  async archiveModuleContract(moduleId: string): Promise<RoAModuleContract> {
    try {
      const response = await api.post<{ contract: RoAModuleContract }>(
        `${ENDPOINTS.ROA_MODULE_CONTRACTS}/${moduleId}/archive`,
        {}
      );
      return response.contract;
    } catch (error) {
      logger.error('Failed to archive RoA module contract', error, { moduleId });
      throw error;
    }
  },

  /**
   * Get a draft by ID
   * 
   * @param draftId - Draft ID
   * @returns RoA draft
   * @throws {APIError} If request fails or draft not found
   * 
   * @example
   * const draft = await roaApi.getDraft('draft-123');
   * console.log(draft.selectedModules);
   */
  async getDraft(draftId: string): Promise<RoADraft> {
    try {
      const response = await api.get<{ draft: RoADraft }>(
        `${ENDPOINTS.ROA_DRAFT}/${draftId}`
      );
      return normaliseDraft(response.draft);
    } catch (error) {
      logger.error(`Failed to get draft ${draftId}`, error);
      throw error;
    }
  },

  /**
   * Save a draft
   * 
   * @param draftId - Draft ID (if updating existing)
   * @param data - Draft data to save
   * @returns Saved draft
   * @throws {APIError} If request fails
   * 
   * @example
   * const draft = await roaApi.saveDraft('draft-123', {
   *   selectedModules: ['life-insurance', 'retirement'],
   *   moduleData: { ... }
   * });
   */
  async saveDraft(draftId: string | null, data: Partial<RoADraft>): Promise<RoADraft> {
    try {
      if (draftId) {
        // Update existing draft
        const response = await api.put<{ draft: RoADraft }>(
          `${ENDPOINTS.ROA_DRAFT}/${draftId}`,
          data
        );
        return normaliseDraft(response.draft);
      } else {
        // Create new draft
        const response = await api.post<{ draft: RoADraft }>(
          ENDPOINTS.ROA_DRAFT,
          data
        );
        return normaliseDraft(response.draft);
      }
    } catch (error) {
      logger.error('Failed to save draft', error);
      throw error;
    }
  },

  /**
   * Submit a draft (finalize)
   * 
   * @param draftId - Draft ID
   * @returns Submitted draft
   * @throws {APIError} If request fails or validation fails
   * 
   * @example
   * const submitted = await roaApi.submitDraft('draft-123');
   * console.log(`Draft submitted with status: ${submitted.status}`);
   */
  async submitDraft(draftId: string): Promise<RoADraft> {
    try {
      const response = await api.post<{ draft: RoADraft }>(
        `${ENDPOINTS.ROA_DRAFT}/${draftId}/submit`,
        {}
      );
      return normaliseDraft(response.draft);
    } catch (error) {
      logger.error('Failed to submit draft', error);
      throw error;
    }
  },

  /**
   * Delete a draft
   * 
   * @param draftId - Draft ID
   * @throws {APIError} If request fails
   * 
   * @example
   * await roaApi.deleteDraft('draft-123');
   * console.log('Draft deleted');
   */
  async deleteDraft(draftId: string): Promise<void> {
    try {
      await api.delete(`${ENDPOINTS.ROA_DRAFT}/${draftId}`);
    } catch (error) {
      logger.error('Failed to delete draft', error);
      throw error;
    }
  },

  /**
   * List all drafts
   * 
   * @param status - Filter by status (optional)
   * @returns Array of drafts
   * @throws {APIError} If request fails
   * 
   * @example
   * const drafts = await roaApi.listDrafts('draft');
   * console.log(`${drafts.length} draft RoAs found`);
   */
  async listDrafts(status?: string): Promise<RoADraft[]> {
    try {
      const params = status ? `?status=${status}` : '';
      const response = await api.get<{ drafts: RoADraft[] }>(
        `${ENDPOINTS.ROA_DRAFT}${params}`
      );
      return (response.drafts || []).map(normaliseDraft);
    } catch (error) {
      logger.error('Failed to list drafts', error);
      // Return empty array on error
      return [];
    }
  },

  /**
   * Build the full client/adviser data context for an RoA.
   */
  async getClientContext(clientId: string): Promise<RoAClientContext> {
    try {
      const response = await api.get<{ context: RoAClientContext }>(
        `${ENDPOINTS.ROA_CLIENT_CONTEXT}/${clientId}/context`
      );
      return response.context;
    } catch (error) {
      logger.error('Failed to get RoA client context', error, { clientId });
      throw error;
    }
  },

  async validateDraft(draftId: string): Promise<{ draft: RoADraft; validation?: RoAValidationResult }> {
    const response = await api.post<{ draft: RoADraft; validation?: RoAValidationResult }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/validate`,
      {}
    );
    return { ...response, draft: normaliseDraft(response.draft) };
  },

  async uploadDraftEvidence(
    draftId: string,
    evidence: {
      moduleId: string;
      requirementId: string;
      label?: string;
      type?: string;
      fileName: string;
      mimeType?: string;
      size?: number;
      source?: string;
      bytesBase64: string;
    }
  ): Promise<{ draft: RoADraft; evidence?: RoAEvidenceItem }> {
    const response = await api.post<{ draft: RoADraft; evidence?: RoAEvidenceItem }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/evidence`,
      evidence
    );
    return { ...response, draft: normaliseDraft(response.draft) };
  },

  async compileDraft(draftId: string): Promise<{ draft: RoADraft; compilation?: RoACompiledOutput }> {
    const response = await api.post<{ draft: RoADraft; compilation?: RoACompiledOutput }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/compile`,
      {}
    );
    return { ...response, draft: normaliseDraft(response.draft) };
  },

  async generateDraftDocuments(
    draftId: string,
    formats: Array<'pdf' | 'docx'>
  ): Promise<{ draft: RoADraft; documents?: RoAGeneratedDocument[]; compilation?: RoACompiledOutput }> {
    const response = await api.post<{ draft: RoADraft; documents?: RoAGeneratedDocument[]; compilation?: RoACompiledOutput }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/generate`,
      { formats }
    );
    return { ...response, draft: normaliseDraft(response.draft) };
  },

  async downloadGeneratedDocument(documentId: string): Promise<RoAGeneratedDocument> {
    const response = await api.get<{ document: RoAGeneratedDocument }>(
      `/advice-engine/roa/documents/${documentId}/download`
    );
    return response.document;
  },

  async finaliseDraft(draftId: string): Promise<{ draft: RoADraft; documents?: RoAGeneratedDocument[]; compilation?: RoACompiledOutput }> {
    const response = await api.post<{ draft: RoADraft; documents?: RoAGeneratedDocument[]; compilation?: RoACompiledOutput }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/finalise`,
      {}
    );
    return { ...response, draft: normaliseDraft(response.draft) };
  },

  async cloneDraftFromFinal(draftId: string): Promise<{ draft: RoADraft }> {
    const response = await api.post<{ draft: RoADraft }>(
      `${ENDPOINTS.ROA_DRAFT}/${draftId}/clone-from-final`,
      {}
    );
    return { draft: normaliseDraft(response.draft) };
  },
};

// ============================================================================
// Consolidated Advice Engine API
// ============================================================================

/**
 * Main Advice Engine API
 * Consolidated interface for all advice engine operations
 */
export const adviceEngineApi = {
  /** AI Intelligence API */
  ai: aiIntelligenceApi,
  
  /** RoA API */
  roa: roaApi,

  /** Clients API */
  clients: clientsApi,

  /** Personnel API */
  personnel: personnelApi,

  /**
   * Health check for advice engine services
   * 
   * @returns Service health status
   */
  async healthCheck(): Promise<{
    aiConfigured: boolean;
    roaAvailable: boolean;
  }> {
    try {
      const [aiStatus, contracts] = await Promise.all([
        aiIntelligenceApi.getStatus(),
        roaApi.getModuleContracts({ status: 'active' }),
      ]);

      return {
        aiConfigured: aiStatus.configured,
        roaAvailable: contracts.length > 0,
      };
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        aiConfigured: false,
        roaAvailable: false,
      };
    }
  },
};

// Default export
export default adviceEngineApi;
