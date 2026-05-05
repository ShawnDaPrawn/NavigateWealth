/**
 * Advice Engine Hooks - Index
 * 
 * Centralized exports for all advice engine hooks.
 * 
 * @module advice-engine/hooks
 */

export { useAIChat } from './useAIChat';
export { useClientSearch } from './useClientSearch';
export { useChatHistory } from './useChatHistory';
export { useRoADraft } from './useRoADraft';
export { useRoAClientContext } from './useRoAClientContext';
export { useRoAModuleContracts } from './useRoAModuleContracts';

// Re-export types for convenience
export type {
  UseAIChatOptions,
  UseAIChatReturn,
  UseClientSearchReturn,
  UseChatHistoryReturn,
  UseRoADraftOptions,
  UseRoADraftReturn,
} from '../types';
