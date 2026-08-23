/**
 * Categories and content types.
 *
 * Split out of `api.ts` (1,441 lines); `api.ts` still re-exports every group,
 * because consumers import the aggregate from there.
 */
import type {
  Category,
  ContentType,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateContentTypeInput,
  UpdateContentTypeInput,
  ReorderUpdate,
} from '../types';
import { BASE_URL, getAuthHeaders, handleResponse, headers } from './shared';

// ============================================================================
// CATEGORIES API
// ============================================================================

/**
 * Categories API namespace
 * All operations related to category management
 */
export const CategoriesAPI = {
  /**
   * Get all categories
   *
   * @returns Array of categories
   *
   * @example
   * ```typescript
   * const categories = await CategoriesAPI.getCategories();
   * ```
   */
  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${BASE_URL}/categories`, { headers });
    return handleResponse<Category[]>(response);
  },

  /**
   * Get single category by ID
   *
   * @param id - Category ID
   * @returns Category
   *
   * @example
   * ```typescript
   * const category = await CategoriesAPI.getCategory('cat-123');
   * ```
   */
  async getCategory(id: string): Promise<Category> {
    const response = await fetch(`${BASE_URL}/categories/${id}`, { headers });
    return handleResponse<Category>(response);
  },

  /**
   * Create new category
   *
   * @param input - Category data
   * @returns Created category
   *
   * @example
   * ```typescript
   * const category = await CategoriesAPI.createCategory({
   *   name: 'Financial Planning',
   *   icon: '📊',
   * });
   * ```
   */
  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const response = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<Category>(response);
  },

  /**
   * Update existing category
   *
   * @param input - Update data with category ID
   * @returns Updated category
   *
   * @example
   * ```typescript
   * const category = await CategoriesAPI.updateCategory({
   *   id: 'cat-123',
   *   name: 'Updated Name',
   * });
   * ```
   */
  async updateCategory(input: UpdateCategoryInput): Promise<Category> {
    const { id, ...updates } = input;
    const response = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<Category>(response);
  },

  /**
   * Delete category
   *
   * @param id - Category ID
   *
   * @example
   * ```typescript
   * await CategoriesAPI.deleteCategory('cat-123');
   * ```
   */
  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    await handleResponse<void>(response);
  },

  /**
   * Reorder categories
   * Updates sort_order for multiple categories
   *
   * @param updates - Array of {id, sort_order}
   *
   * @example
   * ```typescript
   * await CategoriesAPI.reorderCategories([
   *   { id: 'cat-1', sort_order: 0 },
   *   { id: 'cat-2', sort_order: 1 },
   * ]);
   * ```
   */
  async reorderCategories(updates: ReorderUpdate[]): Promise<void> {
    const response = await fetch(`${BASE_URL}/categories/reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ updates }),
    });
    await handleResponse<void>(response);
  },
};

// ============================================================================
// CONTENT TYPES API
// ============================================================================

/**
 * Content Types API namespace
 * All operations related to content type management
 */
export const ContentTypesAPI = {
  /**
   * Get all content types
   *
   * @returns Array of content types
   *
   * @example
   * ```typescript
   * const types = await ContentTypesAPI.getTypes();
   * ```
   */
  async getTypes(): Promise<ContentType[]> {
    const response = await fetch(`${BASE_URL}/types`, { headers });
    return handleResponse<ContentType[]>(response);
  },

  /**
   * Get single content type by ID
   *
   * @param id - Content type ID
   * @returns Content type
   *
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.getType('type-123');
   * ```
   */
  async getType(id: string): Promise<ContentType> {
    const response = await fetch(`${BASE_URL}/types/${id}`, { headers });
    return handleResponse<ContentType>(response);
  },

  /**
   * Create new content type
   *
   * @param input - Content type data
   * @returns Created content type
   *
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.createType({
   *   name: 'Blog Post',
   *   icon: '📝',
   * });
   * ```
   */
  async createType(input: CreateContentTypeInput): Promise<ContentType> {
    const response = await fetch(`${BASE_URL}/types`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<ContentType>(response);
  },

  /**
   * Update existing content type
   *
   * @param input - Update data with type ID
   * @returns Updated content type
   *
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.updateType({
   *   id: 'type-123',
   *   name: 'Updated Name',
   * });
   * ```
   */
  async updateType(input: UpdateContentTypeInput): Promise<ContentType> {
    const { id, ...updates } = input;
    const response = await fetch(`${BASE_URL}/types/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<ContentType>(response);
  },

  /**
   * Delete content type
   *
   * @param id - Content type ID
   *
   * @example
   * ```typescript
   * await ContentTypesAPI.deleteType('type-123');
   * ```
   */
  async deleteType(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/types/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    await handleResponse<void>(response);
  },

  /**
   * Reorder content types
   * Updates sort_order for multiple types
   *
   * @param updates - Array of {id, sort_order}
   *
   * @example
   * ```typescript
   * await ContentTypesAPI.reorderTypes([
   *   { id: 'type-1', sort_order: 0 },
   *   { id: 'type-2', sort_order: 1 },
   * ]);
   * ```
   */
  async reorderTypes(updates: ReorderUpdate[]): Promise<void> {
    const response = await fetch(`${BASE_URL}/types/reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ updates }),
    });
    await handleResponse<void>(response);
  },
};
