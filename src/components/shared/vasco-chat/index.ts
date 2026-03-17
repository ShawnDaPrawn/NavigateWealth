/**
 * Vasco Chat — Shared Component Library
 *
 * Barrel export for all shared Vasco chat primitives.
 * Used by both the public AskVascoPage and the logged-in AIAdvisorPage.
 *
 * @module shared/vasco-chat
 */

export { VascoAvatar } from './VascoAvatar';
export { VascoChatMessage } from './VascoChatMessage';
export type { VascoChatMessageProps } from './VascoChatMessage';
export { VascoTypingIndicator } from './VascoTypingIndicator';
export { VascoStreamingBubble } from './VascoStreamingBubble';
export type { VascoStreamingBubbleProps } from './VascoStreamingBubble';
export { VascoChatInput } from './VascoChatInput';
export type { VascoChatInputProps } from './VascoChatInput';
export { useVascoStream } from './useVascoStream';
export type {
  UseVascoStreamOptions,
  UseVascoStreamReturn,
  StreamResult,
} from './useVascoStream';
export type { VascoChatMessage as VascoChatMessageType, VascoCitation, VascoStreamEvent } from './types';
