/**
 * Resources API
 * Client-side API for resources, forms, training, and knowledge base
 */

import { api } from '../../../../utils/api/client';
import {
  ResourceResponse,
  CreateResourceRequest,
  UpdateResourceRequest,
  ListResourcesFilters,
  TrainingResource,
  KnowledgeArticle,
} from './types';

// ============================================================================
// RESOURCES API
// ============================================================================

export const resourcesApi = {
  /**
   * Get all resources with optional filters
   */
  async getAll(filters?: ListResourcesFilters): Promise<ResourceResponse[]> {
    const params = new URLSearchParams();
    
    if (filters?.category) {
      params.append('category', filters.category.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.clientType) {
      params.append('clientType', filters.clientType);
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.offset) {
      params.append('offset', filters.offset.toString());
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{ resources: ResourceResponse[] }>(`/resources${query}`);
    return response.resources || [];
  },

  /**
   * Get a single resource by ID
   */
  async getById(id: string): Promise<ResourceResponse> {
    const response = await api.get<{ resource: ResourceResponse }>(`/resources/${id}`);
    return response.resource;
  },

  /**
   * Create a new resource
   */
  async create(resource: CreateResourceRequest): Promise<ResourceResponse> {
    const response = await api.post<{ resource: ResourceResponse }>('/resources', resource);
    return response.resource;
  },

  /**
   * Update an existing resource
   */
  async update(id: string, updates: Partial<UpdateResourceRequest>): Promise<ResourceResponse> {
    const response = await api.put<{ resource: ResourceResponse }>(`/resources/${id}`, updates);
    return response.resource;
  },

  /**
   * Delete a resource
   */
  async delete(id: string): Promise<void> {
    return api.delete<void>(`/resources/${id}`);
  },

  /**
   * Duplicate a resource
   */
  async duplicate(id: string): Promise<ResourceResponse> {
    const response = await api.post<{ resource: ResourceResponse }>(`/resources/${id}/duplicate`);
    return response.resource;
  },

  /**
   * Update resource status (draft/published/archived)
   * Phase 1 — Form lifecycle management
   */
  async updateStatus(id: string, status: 'draft' | 'published' | 'archived'): Promise<ResourceResponse> {
    const response = await api.patch<{ resource: ResourceResponse }>(`/resources/${id}/status`, { status });
    return response.resource;
  },

  /**
   * Get resource statistics
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byClientType: Record<string, number>;
  }> {
    return api.get('/resources/stats');
  },
};

// ============================================================================
// TRAINING API
// ============================================================================

export const trainingApi = {
  /**
   * Get all training resources
   */
  async getAll(filters?: {
    type?: string;
    category?: string;
    difficulty?: string;
    search?: string;
  }): Promise<TrainingResource[]> {
    const params = new URLSearchParams();
    
    if (filters?.type) params.append('type', filters.type);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<TrainingResource[]>(`/resources/training${query}`);
  },

  /**
   * Get a single training resource
   */
  async getById(id: string): Promise<TrainingResource> {
    return api.get<TrainingResource>(`/resources/training/${id}`);
  },

  /**
   * Track training view
   */
  async trackView(id: string): Promise<void> {
    return api.post<void>(`/resources/training/${id}/view`);
  },

  /**
   * Rate training resource
   */
  async rate(id: string, rating: number): Promise<void> {
    return api.post<void>(`/resources/training/${id}/rate`, { rating });
  },
};

// ============================================================================
// KNOWLEDGE BASE API
// ============================================================================

export const knowledgeApi = {
  /**
   * Get all knowledge articles
   */
  async getAll(filters?: {
    category?: string;
    tags?: string[];
    search?: string;
  }): Promise<KnowledgeArticle[]> {
    const params = new URLSearchParams();
    
    if (filters?.category) params.append('category', filters.category);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<KnowledgeArticle[]>(`/resources/knowledge${query}`);
  },

  /**
   * Get a single knowledge article
   */
  async getById(id: string): Promise<KnowledgeArticle> {
    return api.get<KnowledgeArticle>(`/resources/knowledge/${id}`);
  },

  /**
   * Track article view
   */
  async trackView(id: string): Promise<void> {
    return api.post<void>(`/resources/knowledge/${id}/view`);
  },

  /**
   * Mark article as helpful
   */
  async markHelpful(id: string): Promise<void> {
    return api.post<void>(`/resources/knowledge/${id}/helpful`);
  },

  /**
   * Search knowledge base
   */
  async search(query: string): Promise<KnowledgeArticle[]> {
    return api.get<KnowledgeArticle[]>(`/resources/knowledge/search?q=${encodeURIComponent(query)}`);
  },
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  resources: resourcesApi,
  training: trainingApi,
  knowledge: knowledgeApi,
};