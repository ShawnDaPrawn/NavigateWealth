/**
 * Product Management Module - Type Definitions
 */

// Provider type
export type ProviderType = 
  | 'insurance'
  | 'investment'
  | 'medical_aid'
  | 'retirement'
  | 'other';

// Product category
export type ProductCategory = 
  | 'life_insurance'
  | 'disability_insurance'
  | 'dread_disease'
  | 'medical_aid'
  | 'retirement_annuity'
  | 'unit_trust'
  | 'endowment'
  | 'tax_free_savings'
  | 'other';

// Integration type
export type IntegrationType = 
  | 'api'
  | 'csv'
  | 'manual'
  | 'webhook';

// Provider
export interface Provider {
  id: string;
  name: string;
  code: string;
  type: ProviderType;
  description?: string;
  category_ids?: string[];
  logo_url?: string;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Product
export interface Product {
  id: string;
  provider_id: string;
  name: string;
  code: string;
  category: ProductCategory;
  description?: string;
  features?: string[];
  pricing?: {
    base_fee?: number;
    percentage?: number;
    min_premium?: number;
    max_premium?: number;
  };
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Integration
export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  provider_id?: string;
  config: {
    api_url?: string;
    api_key?: string;
    csv_path?: string;
    webhook_url?: string;
    [key: string]: unknown;
  };
  is_active: boolean;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

// Product filters
export interface ProductFilters {
  providerId?: string;
  category?: ProductCategory;
  active?: boolean;
}