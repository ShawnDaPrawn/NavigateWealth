/**
 * Advice Engine Module - Type Definitions
 *
 * Comprehensive type system for the AI-powered advice engine.
 * Covers:
 * - Message and conversation types
 * - Client search and selection
 * - AI chat interactions
 * - Record of Advice (RoA) drafting
 * - API requests and responses
 *
 * @module advice-engine/types
 */

// The barrel every consumer imports from — each slice lives under types/.
export * from './types/messaging';
export * from './types/clients';
export * from './types/conversation';
export * from './types/chat';
export * from './types/roa';
export * from './types/ui';
export * from './types/hooks';
