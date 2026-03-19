import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Brain, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from '../../publications/components/ConfirmDialog';

// Custom Hooks
import { useAIChat, useClientSearch } from '../hooks';

// Components
import {
  ChatHistory,
  ChatInput,
  ClientSelector,
  ApiKeyWarning,
} from './';

// Utils
import { copyToClipboard } from '../utils';

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
  } = useAIChat({
    autoLoadHistory: true,
    maxHistoryLength: 10,
  });

  // Client search hook
  const {
    searchTerm,
    setSearchTerm,
    results,
    isSearching,
    selectedClient,
    selectClient,
  } = useClientSearch();

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

  return (
    <div className="space-y-6">
      <Card className="flex flex-col h-[800px]">
        <CardHeader className="flex-none border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Header Title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center border border-violet-200">
                <Brain className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Ask Vasco</CardTitle>
                <p className="text-sm text-muted-foreground">AI-powered advisory assistant</p>
              </div>
            </div>

            {/* Client Selector (Header Action) */}
            <div className="flex items-center gap-2">
              <ClientSelector
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                results={results}
                isSearching={isSearching}
                selectedClient={selectedClient}
                onSelectClient={selectClient}
                placeholder="Search client context..."
              />

              <Button
                onClick={() => setShowClearConfirm(true)}
                variant="outline"
                size="sm"
                className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                disabled={isLoading}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Clear Chat
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0 p-0 bg-slate-50 relative overflow-hidden">
          {/* API Key Warning */}
          <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-2 pointer-events-none">
            <div className="pointer-events-auto">
              <ApiKeyWarning status={apiKeyStatus} />
            </div>
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
          <div className="flex-none p-4 bg-white border-t">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                disabled={!isConfigured}
                placeholder={
                  isConfigured
                    ? 'Type your message...'
                    : 'API key required to send messages'
                }
                maxLength={4000}
              />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClearChat}
        title="Clear chat history?"
        description="Are you sure you want to clear this Ask Vasco conversation? This cannot be undone."
        confirmLabel="Clear chat"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}