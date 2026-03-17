/**
 * Resources Module Utilities
 * Helper functions and business logic
 */

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

/**
 * Get auth token from localStorage
 */
export function getAuthToken(): string {
  try {
    const storageKey = `sb-${projectId}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const session = JSON.parse(stored);
      return session.access_token || publicAnonKey;
    }
  } catch (e) {
    console.error('[ResourcesModule] Error reading auth token:', e);
  }
  return publicAnonKey;
}

/**
 * Format file size from bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    Forms: '\u{1F4C4}',
    Templates: '\u{1F4CB}',
    Requests: '\u{1F4DD}',
    Legal: '\u2696\uFE0F',
    Letters: '\u{2709}\uFE0F',
    Training: '\u{1F393}',
    'Knowledge Base': '\u{1F4DA}',
    Calculators: '\u{1F9EE}',
  };
  
  return iconMap[category] || '\u{1F4C4}';
}

/**
 * Get category color class
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    Forms: 'bg-blue-100 text-blue-700',
    Templates: 'bg-purple-100 text-purple-700',
    Requests: 'bg-green-100 text-green-700',
    Legal: 'bg-amber-100 text-amber-700',
    Letters: 'bg-violet-100 text-violet-700',
    Training: 'bg-orange-100 text-orange-700',
    'Knowledge Base': 'bg-indigo-100 text-indigo-700',
    Calculators: 'bg-pink-100 text-pink-700',
  };
  
  return colorMap[category] || 'bg-gray-100 text-gray-700';
}

/**
 * Get difficulty badge color
 */
export function getDifficultyColor(difficulty: string): string {
  const colorMap: Record<string, string> = {
    Beginner: 'bg-green-100 text-green-700',
    Intermediate: 'bg-yellow-100 text-yellow-700',
    Advanced: 'bg-red-100 text-red-700',
  };
  
  return colorMap[difficulty] || 'bg-gray-100 text-gray-700';
}

/**
 * Format duration (e.g., "45 min", "3 hours")
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Generate star rating HTML
 */
export function getStarRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    '⭐'.repeat(fullStars) +
    (hasHalfStar ? '✨' : '') +
    '☆'.repeat(emptyStars)
  );
}

/**
 * Format view count
 */
export function formatViewCount(views: number): string {
  if (views < 1000) {
    return views.toString();
  }
  
  if (views < 1000000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  
  return `${(views / 1000000).toFixed(1)}M`;
}

/**
 * Calculate relative time (e.g., "2 days ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Validate form name
 */
export function validateFormName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Form name is required' };
  }
  
  if (name.length < 3) {
    return { valid: false, error: 'Form name must be at least 3 characters' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Form name must be less than 100 characters' };
  }
  
  return { valid: true };
}

import type { FormBlock } from './builder/types';

/**
 * Sanitize form data for preview
 */
export function sanitizeFormData(data: Record<string, unknown>): Record<string, unknown> {
  // Remove any sensitive or unnecessary fields
  const sanitized = { ...data };
  
  // Remove internal fields
  delete sanitized._internal;
  delete sanitized.__typename;
  
  // Ensure nested objects exist
  if (!sanitized.client) sanitized.client = {};
  if (!sanitized.personalInformation) sanitized.personalInformation = {};
  if (!sanitized.adviser) sanitized.adviser = {};
  
  return sanitized;
}

/**
 * Generate form preview data from client and adviser
 */
export function generatePreviewData(
  client?: { firstName?: string; lastName?: string; idNumber?: string; email?: string; applicationNumber?: string; profile?: Record<string, unknown> },
  adviser?: { name?: string; email?: string; phone?: string; title?: string; licenseNumber?: string }
): Record<string, unknown> {
  return {
    // Client data (flat keys)
    'client.name': client ? `${client.firstName} ${client.lastName}` : '',
    'client.idNumber': client?.idNumber || '',
    'client.email': client?.email || '',
    'client.address': client?.profile?.address || '',
    'client.phone': client?.profile?.phone || '',
    
    // Client data (nested)
    client: {
      name: client ? `${client.firstName} ${client.lastName}` : '',
      idNumber: client?.idNumber || '',
      email: client?.email || '',
      address: client?.profile?.address || '',
      phone: client?.profile?.phone || '',
    },
    
    // Personal Information (nested)
    personalInformation: {
      firstName: client?.firstName || '',
      lastName: client?.lastName || '',
      idNumber: client?.idNumber || '',
      email: client?.email || '',
      dateOfBirth: client?.profile?.dateOfBirth || '',
      gender: client?.profile?.gender || '',
      maritalStatus: client?.profile?.maritalStatus || '',
    },
    
    // Adviser data
    adviser: {
      name: adviser?.name || '',
      email: adviser?.email || '',
      phone: adviser?.phone || '',
      title: adviser?.title || '',
      licenseNumber: adviser?.licenseNumber || '',
    },
    
    // Additional common fields
    date: new Date().toLocaleDateString(),
    applicationNumber: client?.applicationNumber || '',
  };
}

/**
 * Check if form has required fields
 */
export function hasRequiredFields(blocks: FormBlock[]): boolean {
  if (!blocks || blocks.length === 0) return false;
  
  // Check if form has at least one data collection block
  const dataBlocks = ['field_grid', 'table', 'signature', 'client_summary'];
  return blocks.some((block) => dataBlocks.includes(block.type));
}

/**
 * Count total fields in form
 */
export function countFormFields(blocks: FormBlock[]): number {
  if (!blocks) return 0;
  
  let count = 0;
  
  blocks.forEach((block) => {
    if (block.type === 'field_grid' && block.data?.fields) {
      count += block.data.fields.length;
    } else if (block.type === 'table' && block.data?.rows) {
      count += block.data.rows.length * (block.data.columnHeaders?.length || 0);
    } else if (block.type === 'signature' && block.data?.signatories) {
      count += block.data.signatories.length;
    }
  });
  
  return count;
}

/**
 * Estimate form completion time (in minutes)
 */
export function estimateCompletionTime(blocks: FormBlock[]): number {
  const fieldCount = countFormFields(blocks);
  
  // Rough estimate: 30 seconds per field
  const minutes = Math.ceil((fieldCount * 0.5) + 2); // +2 for reading time
  
  return Math.max(5, minutes); // Minimum 5 minutes
}

/**
 * Export form as JSON
 */
export function exportFormAsJSON(form: { name: string; [key: string]: unknown }): void {
  const dataStr = JSON.stringify(form, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${form.name.replace(/\s+/g, '_')}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Import form from JSON
 */
export async function importFormFromJSON(file: File): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}