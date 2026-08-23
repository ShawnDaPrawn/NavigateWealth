/**
 * UI component props.
 *
 * One slice of what used to be the single 1,287-line advice-engine `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type ApiKeyStatus } from './chat';
import { type Client } from './clients';
import { type ClientSearchResult } from './conversation';
import { type Message } from './messaging';

// UI Component Props Types
// ============================================================================

/**
 * Chat message component props
 */
export interface ChatMessageProps {
  /** Message to display */
  message: Message;

  /** Optional onCopy callback */
  onCopy?: (content: string) => void;

  /** Loading state */
  isLoading?: boolean;
}

/**
 * Chat input component props
 */
export interface ChatInputProps {
  /** Input value */
  value: string;

  /** On value change */
  onChange: (value: string) => void;

  /** On submit/send */
  onSubmit: () => void;

  /** Loading/sending state */
  isLoading?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Maximum character count */
  maxLength?: number;
}

/**
 * Chat history component props
 */
export interface ChatHistoryProps {
  /** Messages to display */
  messages: Message[];

  /** Loading state */
  isLoading?: boolean;

  /** Error message */
  error?: string | null;

  /** On message copy */
  onCopy?: (content: string) => void;

  /** Auto-scroll behavior */
  autoScroll?: boolean;
}

/**
 * Client selector component props
 */
export interface ClientSelectorProps {
  /** Search term */
  searchTerm: string;

  /** On search term change */
  onSearchChange: (term: string) => void;

  /** Search results */
  results: ClientSearchResult[];

  /** Searching state */
  isSearching?: boolean;

  /** Selected client */
  selectedClient: Client | null;

  /** On client select */
  onSelectClient: (client: Client | null) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Minimal mode for header embedding */
  minimal?: boolean;
}

/**
 * API key warning component props
 */
export interface ApiKeyWarningProps {
  /** API key status */
  status: ApiKeyStatus | null;

  /** On dismiss callback */
  onDismiss?: () => void;
}

/**
 * Welcome message feature item
 */
export type WelcomeFeature =
  | string
  | {
      icon: string | React.ReactNode;
      title: string;
      items: string[];
    };

/**
 * Welcome message component props
 */
export interface WelcomeMessageProps {
  /** Custom content (optional) */
  content?: string;

  /** Features list (optional) */
  features?: WelcomeFeature[];
}

// ============================================================================
