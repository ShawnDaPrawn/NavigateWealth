/**
 * WillChatInterface — AI-Driven Last Will & Testament Interview
 *
 * Chat interface that guides the adviser through a structured will interview
 * conducted by the Navigate Wealth Will Builder Agent (OpenAI).
 *
 * Architecture (server-proxied):
 *   1. Frontend calls server to create a KV session → gets sessionId + profileContext
 *   2. Frontend sends messages to server via POST /sessions/:id/send
 *   3. Server calls OpenAI Responses API using OPENAI_API_KEY, persists exchange, returns reply
 *   4. Conversation chaining via previous_response_id is managed by the server
 *
 * The OPENAI_API_KEY never leaves the server.
 *
 * Follows the Advice Engine AskAIInterface pattern (per Guidelines S8.1).
 *
 * @module estate-planning-fna/components/WillChatInterface
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Alert, AlertDescription } from '../../../../ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  Scroll,
  Send,
  Loader2,
  Bot,
  Copy,
  Check,
  ArrowLeft,
  Download,
  Save,
  FileText,
  AlertTriangle,
  Shield,
  ClipboardList,
  CheckCircle2,
  X,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { MessageRenderer } from '../../../../shared/MessageRenderer';
import { api } from '../../../../../utils/api/client';

// ── Constants ──────────────────────────────────────────────────────

const ENDPOINTS = {
  STATUS: '/will-chat/status',
  CREATE_SESSION: '/will-chat/create-session',
  SESSIONS: '/will-chat/sessions',
  SESSION: (id: string) => `/will-chat/sessions/${id}`,
  SEND: (id: string) => `/will-chat/sessions/${id}/send`,
  SAVE: (id: string) => `/will-chat/sessions/${id}/save`,
  CLIENT_SESSIONS: (clientId: string) => `/will-chat/sessions/client/${clientId}`,
} as const;

const MAX_MESSAGE_LENGTH = 4000;

// ── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OutputPack {
  willDraft: string;
  issueRegister: string;
  executionChecklist: string;
  confirmationSummary: string;
}

interface SessionSummary {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  messageCount: number;
  willReady: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WillChatInterfaceProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  /** Callback after a will is saved to KV (so parent can refresh wills list) */
  onWillSaved?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Chat Card (extracted for clarity) ─────────────────────────────

function ChatCard({
  messages,
  isLoading,
  error,
  onDismissError,
  input,
  onInputChange,
  onSubmit,
  onKeyDown,
  onCopy,
  copied,
  isConfigured,
  willReady,
  clientName,
  chatContainerRef,
  textareaRef,
  agentConnected,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onDismissError: () => void;
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCopy: (content: string, index: number) => void;
  copied: number | null;
  isConfigured: boolean;
  willReady: boolean;
  clientName: string;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  agentConnected: boolean;
}) {
  return (
    <Card className="flex flex-col" style={{ height: '700px' }}>
      <CardHeader className="flex-none border-b bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                Navigate Wealth Will Builder
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                AI-guided SA Last Will &amp; Testament interview
              </p>
            </div>
          </div>
          {agentConnected && (
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-green-700 text-[10px]"
              title="Connected to Navigate Wealth Will Builder Agent. Secure server-side processing."
            >
              Agent Live
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0 bg-slate-50 relative overflow-hidden">
        {/* Error banner */}
        {error && (
          <div className="px-4 pt-2 pb-0 flex-none z-10">
            <Alert variant="destructive" className="shadow-sm">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="text-xs break-all">{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 flex-shrink-0"
                  onClick={onDismissError}
                >
                  <X className="h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Messages area */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <Scroll className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Will Interview Starting
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                The AI Will Builder is preparing the interview for {clientName}.
                The agent will guide you through identity confirmation, marriage
                regime, family details, executor appointment, and more.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={`msg-${index}-${msg.timestamp.getTime()}`}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="leading-relaxed markdown-content">
                      <MessageRenderer content={msg.content} role="assistant" />
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center gap-2 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => onCopy(msg.content, index)}
                      className="text-muted-foreground hover:text-purple-600 transition-colors p-1 rounded hover:bg-purple-50"
                      title="Copy message"
                    >
                      {copied === index ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                <Bot className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-none p-4 bg-white border-t">
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  willReady
                    ? 'Will is complete - you can still ask follow-up questions...'
                    : isConfigured
                    ? 'Type your response... (Shift+Enter for new line)'
                    : 'API key required to send messages'
                }
                disabled={!isConfigured || isLoading}
                className="min-h-[60px] max-h-[200px] resize-none pr-12"
                rows={1}
              />
              <Button
                onClick={onSubmit}
                disabled={!isConfigured || isLoading || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
                size="sm"
                className="absolute right-3 bottom-3 h-8 w-8 p-0 rounded-full"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>

              {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
                <div
                  className={`absolute bottom-3 right-14 text-[10px] mr-2 ${
                    input.length > MAX_MESSAGE_LENGTH ? 'text-red-600 font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">
                    Enter
                  </kbd>{' '}
                  to send
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 font-sans text-[10px]">
                    Shift + Enter
                  </kbd>{' '}
                  for new line
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export function WillChatInterface({
  clientId,
  clientName,
  onClose,
  onWillSaved,
}: WillChatInterfaceProps) {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Server-managed conversation chaining
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [agentConnected, setAgentConnected] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  // Will output state
  const [willReady, setWillReady] = useState(false);
  const [outputPack, setOutputPack] = useState<OutputPack | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [willSaved, setWillSaved] = useState(false);

  // Confirmations
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // ── Effects ────────────────────────────────────────────────────

  useEffect(() => {
    checkStatus();
    loadSessions();
  }, [clientId]);

  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // ── API Calls ──────────────────────────────────────────────────

  const checkStatus = async () => {
    try {
      const result = await api.get<{ configured: boolean }>(ENDPOINTS.STATUS);
      setIsConfigured(result.configured);
    } catch {
      setIsConfigured(false);
    }
  };

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const result = await api.get<{ success: boolean; data: SessionSummary[] }>(
        ENDPOINTS.CLIENT_SESSIONS(clientId),
      );
      if (result.success) {
        setSessions(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load will chat sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  /**
   * Send a message to the agent via our server.
   * Server calls OpenAI, persists the exchange, and returns the reply.
   *
   * This function only adds the ASSISTANT reply to the UI messages.
   * The caller is responsible for adding the user message to the UI if desired
   * (handleSubmit does this; createSession intentionally does not, so the
   * initial hidden prompt never appears in the chat).
   */
  const sendMessageViaServer = async (
    sid: string,
    messageText: string,
  ) => {
    const result = await api.post<{
      success: boolean;
      data: {
        assistantReply: string;
        responseId: string | null;
        strategy: string;
        status: string;
        willReady: boolean;
        outputPack: OutputPack | null;
      };
      error?: string;
    }>(ENDPOINTS.SEND(sid), {
      message: messageText,
      previousResponseId,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to get agent response');
    }

    const { assistantReply, responseId, strategy, willReady: isWillReady, outputPack: pack } = result.data;

    // Track the response ID for conversation chaining
    if (responseId) {
      setPreviousResponseId(responseId);
    }

    setAgentConnected(true);
    console.info(`[WillChat] Agent responded via ${strategy}`, {
      responseId,
      replyLen: assistantReply.length,
    });

    // Add ONLY the assistant reply to the UI
    setMessages((prev) => [
      ...prev,
      { role: 'assistant' as const, content: assistantReply, timestamp: new Date() },
    ]);

    // Check for will completion
    if (isWillReady) {
      setWillReady(true);
      setOutputPack(pack);
      toast.success('Will interview complete! The Last Will & Testament is ready for review.');
    }
  };

  /**
   * Create a new session:
   * 1. Server creates KV session with profile context
   * 2. Returns sessionId + profileContext
   * 3. Frontend sends a hidden initial message to the agent via server
   * 4. Only the agent's reply appears as the first visible message
   */
  const createSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create KV session (server loads profile context)
      const result = await api.post<{
        success: boolean;
        data: {
          sessionId: string;
          profileContext: string;
        };
        error?: string;
      }>(ENDPOINTS.CREATE_SESSION, { clientId, clientName });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create session');
      }

      const { sessionId: newSessionId, profileContext: ctx } = result.data;

      setSessionId(newSessionId);
      setMessages([]);
      setWillReady(false);
      setOutputPack(null);
      setWillSaved(false);
      setPreviousResponseId(null);

      // Build the hidden initial message: profile context + intro question
      // This is sent to the agent in the background — the user never sees it.
      // Only the agent's introduction reply appears as the first chat message.
      const initialMessage = ctx
        ? `${ctx}\n\nAre you ready to start helping me with my Last Will & Testament drafting? Please introduce yourself.`
        : `Are you ready to start helping me with my Last Will & Testament drafting? Please introduce yourself.`;

      // sendMessageViaServer only adds the assistant reply to the UI.
      // Since we don't call handleSubmit here, the initial user prompt
      // is never shown in the chat — the first visible message is the agent's introduction.
      await sendMessageViaServer(newSessionId, initialMessage);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create session';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const resumeSession = async (sid: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await api.get<{
        success: boolean;
        data: {
          id: string;
          messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
          status: string;
          willReady: boolean;
          outputPack: OutputPack | null;
        };
        error?: string;
      }>(ENDPOINTS.SESSION(sid));

      if (!result.success) {
        throw new Error(result.error || 'Failed to load session');
      }

      setSessionId(sid);

      // Filter out the hidden initial prompt when displaying messages.
      // The first user message contains the profile context + intro question
      // that was sent in the background — it should never be visible.
      const allMessages = result.data.messages;
      const visibleMessages = allMessages.length > 0 && allMessages[0].role === 'user'
        && allMessages[0].content.includes('Are you ready to start helping me with my Last Will & Testament drafting?')
        ? allMessages.slice(1)
        : allMessages;

      setMessages(
        visibleMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        })),
      );

      // Reset response ID — the server will re-send full conversation context
      // for resumed sessions since the previous_response_id is no longer valid
      setPreviousResponseId(null);

      setWillReady(result.data.willReady);
      setOutputPack(result.data.outputPack);

      // Mark as connected if session has messages (agent has responded before)
      if (allMessages.length > 0) {
        setAgentConnected(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resume session';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWill = async () => {
    if (!sessionId) return;
    try {
      setIsSaving(true);
      const result = await api.post<{
        success: boolean;
        data: { willId: string };
        error?: string;
      }>(ENDPOINTS.SAVE(sessionId));

      if (!result.success) throw new Error(result.error || 'Failed to save will');

      setWillSaved(true);
      toast.success('Will saved to client record successfully.');
      onWillSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save will');
    } finally {
      setIsSaving(false);
      setShowSaveConfirm(false);
    }
  };

  const deleteSessionHandler = async (sid: string) => {
    try {
      setIsDeleting(true);
      const result = await api.delete<{ success: boolean; error?: string }>(ENDPOINTS.SESSION(sid));
      if (!result.success) throw new Error(result.error || 'Failed to delete session');
      toast.success('Session deleted successfully.');
      loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      { role: 'user' as const, content: userMessage, timestamp: new Date() },
    ]);

    setIsLoading(true);
    try {
      await sendMessageViaServer(sessionId, userMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
      // Remove the optimistic user message
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, previousResponseId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(index);
      setTimeout(() => setCopied(null), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadPdf = () => {
    if (!outputPack) return;
    try {
      generateTextPdf(outputPack.willDraft, clientName);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF');
    }
  };

  // ── Render: Session List View ──────────────────────────────────

  if (!sessionId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
              <Scroll className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Will Builder</h2>
              <p className="text-sm text-muted-foreground">{clientName}</p>
            </div>
          </div>
        </div>

        {!isConfigured && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              OpenAI API key is not configured. Please add the OPENAI_API_KEY to continue.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-6 w-6 text-purple-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Start New Will Interview</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The AI Will Builder will guide {clientName} through a structured interview
                  covering identity, marriage regime, family, executor appointment, assets,
                  beneficiaries, and advanced modules — then generate a complete South African
                  Last Will &amp; Testament.
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  AI-powered interview — agent instructions are managed centrally and updates
                  propagate automatically with no code changes required.
                </p>
                <Button onClick={createSession} className="mt-4" disabled={!isConfigured || isLoading}>
                  {isLoading ? (
                    <div className="contents">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting to Agent...
                    </div>
                  ) : (
                    <div className="contents">
                      <Scroll className="h-4 w-4 mr-2" />
                      Begin Interview
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Previous Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Session {formatDate(s.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">{s.messageCount} messages</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={s.willReady ? 'default' : 'secondary'}
                        className={s.willReady ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                      >
                        {s.willReady ? 'Complete' : s.status === 'active' ? 'In Progress' : s.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => resumeSession(s.id)}>
                        {s.willReady ? 'View' : 'Resume'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(s)} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete the session from{' '}
                {deleteTarget ? formatDate(deleteTarget.createdAt) : ''}
                {deleteTarget?.willReady ? ' (completed will)' : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTarget && deleteSessionHandler(deleteTarget.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Deleting...
                  </div>
                ) : (
                  'Delete Session'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Render: Chat + Output View ─────────────────────────────────

  const chatCard = (
    <ChatCard
      messages={messages}
      isLoading={isLoading}
      error={error}
      onDismissError={() => setError(null)}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      copied={copied}
      isConfigured={isConfigured}
      willReady={willReady}
      clientName={clientName}
      chatContainerRef={chatContainerRef}
      textareaRef={textareaRef}
      agentConnected={agentConnected}
    />
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSessionId(null);
              setPreviousResponseId(null);
              setAgentConnected(false);
              loadSessions();
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Sessions
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Scroll className="h-4 w-4 text-purple-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {clientName} — Will Interview
              </h2>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {willReady && (
            <div className="contents">
              <Badge className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Will Ready
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!outputPack}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button size="sm" onClick={() => setShowSaveConfirm(true)} disabled={isSaving || willSaved}>
                {willSaved ? (
                  <div className="contents"><Check className="h-4 w-4 mr-1" />Saved</div>
                ) : isSaving ? (
                  <div className="contents"><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</div>
                ) : (
                  <div className="contents"><Save className="h-4 w-4 mr-1" />Save Will</div>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      {willReady && outputPack ? (
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat" className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />Chat
            </TabsTrigger>
            <TabsTrigger value="will" className="flex items-center gap-1.5">
              <Scroll className="h-3.5 w-3.5" />Will
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />Issues
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />Checklist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">{chatCard}</TabsContent>

          <TabsContent value="will">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scroll className="h-4 w-4 text-purple-600" />
                  {clientName} Last Will &amp; Testament
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none">
                  <MessageRenderer content={outputPack.willDraft} role="assistant" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues">
            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  Issue &amp; Risk Register
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {outputPack.issueRegister ? (
                  <div className="prose prose-sm max-w-none">
                    <MessageRenderer content={outputPack.issueRegister} role="assistant" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No issues or risks identified.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    Execution Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {outputPack.executionChecklist ? (
                    <div className="prose prose-sm max-w-none">
                      <MessageRenderer content={outputPack.executionChecklist} role="assistant" />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Execution checklist will be generated.</p>
                  )}
                </CardContent>
              </Card>
              {outputPack.confirmationSummary && (
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Client Confirmation Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none">
                      <MessageRenderer content={outputPack.confirmationSummary} role="assistant" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        chatCard
      )}

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Will to Client Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will save the generated Last Will &amp; Testament to {clientName}'s record.
              The will can still be edited and will need to be finalized separately once the
              signed original is collected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveWill}>
              {isSaving ? (
                <div className="contents"><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving...</div>
              ) : (
                'Save Will'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── PDF Generator (text-based) ─────────────────────────────────────

function generateTextPdf(willText: string, clientName: string): void {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_WIDTH = 210;
    const PAGE_HEIGHT = 297;
    const MARGIN_LEFT = 20;
    const MARGIN_RIGHT = 20;
    const MARGIN_TOP = 25;
    const MARGIN_BOTTOM = 25;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const LINE_HEIGHT = 5.5;

    let currentY = MARGIN_TOP;
    let pageNum = 1;
    const documentTitle = `${clientName} Last Will & Testament`;

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        addFooter(doc, pageNum, documentTitle);
        doc.addPage();
        pageNum++;
        currentY = MARGIN_TOP;
      }
    };

    // Header
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('NAVIGATE WEALTH', MARGIN_LEFT, 12);
    doc.text('CONFIDENTIAL', PAGE_WIDTH - MARGIN_RIGHT, 12, { align: 'right' });

    doc.setDrawColor(109, 40, 217);
    doc.setLineWidth(0.8);
    doc.line(MARGIN_LEFT, 16, PAGE_WIDTH - MARGIN_RIGHT, 16);

    // Title
    currentY = 24;
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle.toUpperCase(), PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += 12;

    // Body
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);

    const cleanText = stripMarkdown(willText);
    const lines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      checkPageBreak(LINE_HEIGHT);

      const isHeader = /^\d+\.\s+[A-Z]/.test(line.trim());
      if (isHeader) {
        checkPageBreak(LINE_HEIGHT * 2);
        currentY += LINE_HEIGHT * 0.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      doc.text(line, MARGIN_LEFT, currentY);
      currentY += LINE_HEIGHT;

      if (isHeader) {
        currentY += LINE_HEIGHT * 0.3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
    }

    addFooter(doc, pageNum, documentTitle);
    const safeName = clientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    doc.save(`${safeName}_Last_Will_and_Testament.pdf`);
  });
}

function addFooter(
  doc: { setFontSize: Function; setTextColor: Function; text: Function; setDrawColor: Function; setLineWidth: Function; line: Function },
  pageNum: number,
  title: string,
): void {
  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN_LEFT = 20;
  const MARGIN_RIGHT = 20;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 18);

  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text(title, MARGIN_LEFT, PAGE_HEIGHT - 13);
  doc.text(`Page ${pageNum}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 13, { align: 'right' });
  doc.text(
    'Prepared by Navigate Wealth. This document requires proper execution to be legally valid.',
    MARGIN_LEFT,
    PAGE_HEIGHT - 9,
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}