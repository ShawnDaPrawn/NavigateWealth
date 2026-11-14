import { useState } from 'react';

import { toast } from 'sonner';
import { ConfirmDialog } from '../../publications';

// Custom Hooks
import { useAIChat, useClientSearch } from '../hooks';

// Components
import { ChatHistory, ChatInput, ClientSelector, ApiKeyWarning } from './';

// Utils
import { copyToClipboard } from '../utils';
import { DsButton, ErrorState } from '../../../layout/page';

/**
 * Ask Vasco Interface Component
 *
 * Main interface for AI-powered advisory assistance.
 * Uses modular hooks and components for clean architecture.
 *
 * @example
 * <AskAIInterface />
 */
export function AskAIInterface() {
  // Local state
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  // AI Chat hook
  const {
    messages,
    isLoading,
    error: chatError,
    sendMessage,
    clearChat,
    apiKeyStatus,
    isConfigured,
    loadError,
    retryLoad,
  } = useAIChat({
    autoLoadHistory: true,
    maxHistoryLength: 10,
  });

  // Client search hook
  const { searchTerm, setSearchTerm, results, isSearching, selectedClient, selectClient } =
    useClientSearch();

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle message submission
   */
  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    try {
      await sendMessage(input, selectedClient?.user_id);
      setInput(''); // Clear input on success
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  /**
   * Handle clear chat
   */
  const handleConfirmClearChat = async () => {
    try {
      setShowClearConfirm(false);
      await clearChat();
      toast.success('Chat history cleared');
    } catch (error) {
      console.error('Failed to clear chat:', error);
      toast.error('Failed to clear chat history');
    }
  };

  /**
   * Handle message copy
   */
  const handleCopy = async (content: string) => {
    const success = await copyToClipboard(content);
    if (success) {
      toast.success('Copied to clipboard');
    } else {
      toast.error('Failed to copy');
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  // A failed status or history load is the shared error — never the
  // "API key needs to be updated" warning, which is only for a key the server
  // reports as missing or invalid.
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load Ask Vasco"
        onRetry={retryLoad}
        details={loadError.message}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="ds-card flex h-[640px] flex-col overflow-hidden sm:h-[720px]">
        {/* AE-Vasco: client context and Clear chat in the card's header strip */}
        <div className="ds-card-h">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ClientSelector
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              results={results}
              isSearching={isSearching}
              selectedClient={selectedClient}
              onSelectClient={selectClient}
              placeholder="Client context: none"
            />
            <span className="ds-meta hidden lg:inline">
              Pick a client so Vasco answers with their profile, policies and FNAs
            </span>
          </div>
          <DsButton
            size="sm"
            variant="ghost"
            onClick={() => setShowClearConfirm(true)}
            disabled={isLoading}
          >
            Clear chat
          </DsButton>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fafafb]">
          {/* API Key Warning */}
          <div className="flex-none px-4 empty:hidden [&:has(>*)]:pt-2">
            <ApiKeyWarning status={apiKeyStatus} />
          </div>

          {/* Chat History Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative p-4">
            <ChatHistory
              messages={messages}
              isLoading={isLoading}
              error={chatError}
              onCopy={handleCopy}
              autoScroll={true}
            />
          </div>

          {/* Input Area */}
          <div className="flex-none border-t border-nw-line bg-white px-3.5 py-3">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={!isConfigured}
              placeholder={
                isConfigured ? 'Type your message...' : 'API key required to send messages'
              }
              maxLength={4000}
            />
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClearChat}
        title="Clear chat history?"
        description="This removes the conversation from this screen. It cannot be undone."
        confirmLabel="Clear history"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
