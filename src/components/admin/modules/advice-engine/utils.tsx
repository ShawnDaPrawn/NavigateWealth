/**
 * Advice Engine Module - Utility Functions
 * 
 * Reusable utility functions for:
 * - Message formatting and manipulation
 * - Client data formatting
 * - Conversation history management
 * - RoA form validation
 * - Date/time formatting
 * 
 * @module advice-engine/utils
 */

import type {
  Message,
  Client,
  ConversationHistory,
  RoAFormData,
  RoAFormValidationResult,
  RoAField,
  RoADraft,
  ApiKeyStatus,
} from './types';

// ============================================================================
// Message Utilities
// ============================================================================

/**
 * Format timestamp for display
 * 
 * @param date - Date to format
 * @returns Formatted time string (e.g., "2:30 PM")
 * 
 * @example
 * formatTimestamp(new Date()); // "2:30 PM"
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Truncate message content
 * 
 * @param content - Message content
 * @param maxLength - Maximum length
 * @returns Truncated content
 * 
 * @example
 * truncateMessage('Long message...', 50); // "Long message..."
 */
export function truncateMessage(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + '...';
}

/**
 * Count total characters in conversation
 * 
 * @param messages - Array of messages
 * @returns Total character count
 * 
 * @example
 * countConversationCharacters(messages); // 1234
 */
export function countConversationCharacters(messages: Message[]): number {
  return messages.reduce((total, msg) => total + msg.content.length, 0);
}

/**
 * Extract code blocks from message content
 * 
 * @param content - Message content
 * @returns Array of code blocks
 * 
 * @example
 * extractCodeBlocks('Some text ```code``` more text'); // ['code']
 */
export function extractCodeBlocks(content: string): string[] {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = content.match(codeBlockRegex) || [];
  return matches.map(block => block.replace(/```/g, '').trim());
}

// ============================================================================
// Conversation History Utilities
// ============================================================================

/**
 * Build conversation history from messages
 * 
 * @param messages - Array of messages
 * @param maxMessages - Maximum messages to include (default: 10)
 * @returns Conversation history object
 * 
 * @example
 * const history = buildConversationHistory(messages, 5);
 */
export function buildConversationHistory(
  messages: Message[],
  maxMessages: number = 10
): ConversationHistory {
  // Filter out system messages and take last N messages
  const relevantMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-maxMessages);

  return {
    messages: relevantMessages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };
}

/**
 * Get last N messages
 * 
 * @param messages - Array of messages
 * @param n - Number of messages to return
 * @returns Last N messages
 * 
 * @example
 * const recent = getLastNMessages(messages, 5);
 */
export function getLastNMessages(messages: Message[], n: number): Message[] {
  return messages.slice(-n);
}

/**
 * Get messages for specific client
 * 
 * @param messages - Array of messages
 * @param clientId - Client ID to filter by
 * @returns Messages for that client
 * 
 * @example
 * const clientMessages = getClientMessages(messages, 'client-123');
 */
export function getClientMessages(messages: Message[], clientId: string): Message[] {
  return messages.filter(m => m.clientId === clientId);
}

// ============================================================================
// Client Utilities
// ============================================================================

/**
 * Format client full name
 * 
 * @param client - Client object
 * @returns Formatted full name
 * 
 * @example
 * formatClientName({ first_name: 'John', last_name: 'Smith' }); // "John Smith"
 */
export function formatClientName(client: Client | null): string {
  if (!client) return '';
  return `${client.first_name} ${client.last_name}`.trim();
}

/**
 * Format client display (name + email)
 * 
 * @param client - Client object
 * @returns Formatted display string
 * 
 * @example
 * formatClientDisplay(client); // "John Smith (john@example.com)"
 */
export function formatClientDisplay(client: Client): string {
  const name = formatClientName(client);
  if (client.email) {
    return `${name} (${client.email})`;
  }
  return name;
}

/**
 * Get client initials
 * 
 * @param client - Client object
 * @returns Initials (e.g., "JS")
 * 
 * @example
 * getClientInitials({ first_name: 'John', last_name: 'Smith' }); // "JS"
 */
export function getClientInitials(client: Client): string {
  const firstInitial = client.first_name?.charAt(0) || '';
  const lastInitial = client.last_name?.charAt(0) || '';
  return (firstInitial + lastInitial).toUpperCase();
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate chat input
 * 
 * @param input - Input string
 * @returns Whether input is valid
 * 
 * @example
 * validateChatInput('Hello'); // true
 * validateChatInput(''); // false
 */
export function validateChatInput(input: string): boolean {
  // Input must be non-empty and not just whitespace
  const trimmed = input.trim();
  return trimmed.length > 0 && trimmed.length <= 4000;
}

/**
 * Validate RoA form data
 * 
 * @param data - Form data
 * @param fields - Field definitions
 * @returns Validation result
 * 
 * @example
 * const result = validateRoAForm(formData, fields);
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 */
export function validateRoAForm(
  data: RoAFormData,
  fields: RoAField[]
): RoAFormValidationResult {
  const errors: Record<string, string> = {};

  fields.forEach(field => {
    const value = data[field.key];

    // Required field validation
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.key] = `${field.label} is required`;
      return;
    }

    // Skip further validation if field is empty and not required
    if (!field.required && (value === undefined || value === null || value === '')) {
      return;
    }

    // Type-specific validation
    if (field.type === 'text' || field.type === 'textarea') {
      const strValue = String(value);
      
      if (field.validation?.minLength && strValue.length < field.validation.minLength) {
        errors[field.key] = `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      
      if (field.validation?.maxLength && strValue.length > field.validation.maxLength) {
        errors[field.key] = `${field.label} must be at most ${field.validation.maxLength} characters`;
      }
      
      if (field.validation?.pattern && !field.validation.pattern.test(strValue)) {
        errors[field.key] = `${field.label} format is invalid`;
      }
    }

    if (field.type === 'number') {
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        errors[field.key] = `${field.label} must be a number`;
        return;
      }
      
      if (field.validation?.min !== undefined && numValue < field.validation.min) {
        errors[field.key] = `${field.label} must be at least ${field.validation.min}`;
      }
      
      if (field.validation?.max !== undefined && numValue > field.validation.max) {
        errors[field.key] = `${field.label} must be at most ${field.validation.max}`;
      }
    }

    if (field.type === 'select' && field.options) {
      if (!field.options.includes(value)) {
        errors[field.key] = `${field.label} must be one of the available options`;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    message: Object.keys(errors).length > 0 
      ? `Please fix ${Object.keys(errors).length} validation error(s)` 
      : undefined,
  };
}

// ============================================================================
// RoA Draft Utilities
// ============================================================================

/**
 * Calculate RoA draft completion percentage
 * 
 * @param draft - RoA draft
 * @param totalFields - Total number of fields
 * @returns Completion percentage (0-100)
 * 
 * @example
 * const completion = calculateDraftCompletion(draft, 20); // 75
 */
export function calculateDraftCompletion(draft: RoADraft, totalFields: number): number {
  if (totalFields === 0) return 0;
  
  const filledFields = Object.keys(draft.moduleData).filter(
    key => draft.moduleData[key] !== undefined && draft.moduleData[key] !== null && draft.moduleData[key] !== ''
  ).length;
  
  return Math.round((filledFields / totalFields) * 100);
}

/**
 * Check if draft can be submitted
 * 
 * @param draft - RoA draft
 * @param requiredFields - Required field keys
 * @returns Whether draft can be submitted
 * 
 * @example
 * const canSubmit = canSubmitDraft(draft, requiredFields);
 */
export function canSubmitDraft(draft: RoADraft, requiredFields: string[]): boolean {
  // Must have at least one module selected
  if (draft.selectedModules.length === 0) {
    return false;
  }
  
  // Must have client ID or client data
  if (!draft.clientId && !draft.clientData) {
    return false;
  }
  
  // All required fields must be filled
  return requiredFields.every(
    key => draft.moduleData[key] !== undefined && 
           draft.moduleData[key] !== null && 
           draft.moduleData[key] !== ''
  );
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format date for display
 * 
 * @param date - Date to format
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date()); // "Jan 4, 2026"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date and time
 * 
 * @param date - Date to format
 * @returns Formatted date/time string
 * 
 * @example
 * formatDateTime(new Date()); // "Jan 4, 2026 at 2:30 PM"
 */
export function formatDateTime(date: Date): string {
  const dateStr = formatDate(date);
  const timeStr = formatTimestamp(date);
  return `${dateStr} at ${timeStr}`;
}

/**
 * Get relative time string
 * 
 * @param date - Date to format
 * @returns Relative time (e.g., "2 hours ago")
 * 
 * @example
 * getRelativeTime(new Date(Date.now() - 3600000)); // "1 hour ago"
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  return formatDate(date);
}

// ============================================================================
// Text Processing Utilities
// ============================================================================

/**
 * Highlight search term in text
 * 
 * @param text - Text to search in
 * @param searchTerm - Term to highlight
 * @returns Text with <mark> tags
 * 
 * @example
 * highlightText('John Smith', 'john'); // "<mark>John</mark> Smith"
 */
export function highlightText(text: string, searchTerm: string): string {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Extract keywords from text
 * 
 * @param text - Text to analyze
 * @param minLength - Minimum keyword length
 * @returns Array of keywords
 * 
 * @example
 * extractKeywords('Life insurance policy for retirement'); // ['life', 'insurance', 'policy', 'retirement']
 */
export function extractKeywords(text: string, minLength: number = 3): string[] {
  // Remove common words and extract unique keywords
  const commonWords = ['the', 'and', 'or', 'but', 'for', 'with', 'from', 'to', 'in', 'on', 'at'];
  const words = text.toLowerCase().split(/\s+/);
  const keywords = words.filter(
    word => word.length >= minLength && !commonWords.includes(word)
  );
  return Array.from(new Set(keywords));
}

// ============================================================================
// Copy to Clipboard Utility
// ============================================================================

/**
 * Copy text to clipboard
 * 
 * @param text - Text to copy
 * @returns Promise resolving to success boolean
 * 
 * @example
 * await copyToClipboard('Text to copy');
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message is from the user
 */
export function isUserMessage(message: Message): boolean {
  return message.role === 'user';
}

/**
 * Check if a message is from the assistant
 */
export function isAssistantMessage(message: Message): boolean {
  return message.role === 'assistant';
}

/**
 * Check if a message is a system message
 */
export function isSystemMessage(message: Message): boolean {
  return message.role === 'system';
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(status: ApiKeyStatus | null): boolean {
  return status?.configured === true;
}

/**
 * Check if RoA draft is complete
 */
export function isRoAComplete(draft: RoADraft): boolean {
  return draft.status === 'complete' || draft.status === 'submitted';
}
