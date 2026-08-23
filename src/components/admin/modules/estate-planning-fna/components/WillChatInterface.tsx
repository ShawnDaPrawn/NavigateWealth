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
  Loader2,
  Bot,
  Check,
  ArrowLeft,
  Download,
  Save,
  FileText,
  AlertTriangle,
  Shield,
  ClipboardList,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { MessageRenderer } from '../../../../shared/MessageRenderer';
import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';

import { ChatCard } from './willChat/WillChatCard';
import { ENDPOINTS, formatDate } from './willChat/willChatModel';
import type { ChatMessage, OutputPack, SessionSummary } from './willChat/willChatModel';
import { generateTextPdf } from './willChat/willTextPdf';

interface WillChatInterfaceProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  /** Callback after a will is saved to KV (so parent can refresh wills list) */
  onWillSaved?: () => void;
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

  // ── API Calls ──────────────────────────────────────────────────

  const checkStatus = async () => {
    try {
      const result = await api.get<{ configured: boolean }>(ENDPOINTS.STATUS);
      setIsConfigured(result.configured);
    } catch {
      setIsConfigured(false);
    }
  };

  const loadSessions = useCallback(async () => {
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
  }, [clientId]);

  // ── Effects ────────────────────────────────────────────────────

  useEffect(() => {
    checkStatus();
    loadSessions();
  }, [clientId, loadSessions]);

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

  /**
   * Send a message to the agent via our server.
   * Server calls OpenAI, persists the exchange, and returns the reply.
   *
   * This function only adds the ASSISTANT reply to the UI messages.
   * The caller is responsible for adding the user message to the UI if desired
   * (handleSubmit does this; createSession intentionally does not, so the
   * initial hidden prompt never appears in the chat).
   */
  const sendMessageViaServer = useCallback(
    async (sid: string, messageText: string) => {
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

      const {
        assistantReply,
        responseId,
        strategy,
        willReady: isWillReady,
        outputPack: pack,
      } = result.data;

      // Track the response ID for conversation chaining
      if (responseId) {
        setPreviousResponseId(responseId);
      }

      setAgentConnected(true);
      logger.info(`[WillChat] Agent responded via ${strategy}`, {
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
    },
    [previousResponseId],
  );

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
      const visibleMessages =
        allMessages.length > 0 &&
        allMessages[0].role === 'user' &&
        allMessages[0].content.includes(
          'Are you ready to start helping me with my Last Will & Testament drafting?',
        )
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
  }, [input, isLoading, sessionId, sendMessageViaServer]);

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
                  beneficiaries, and advanced modules — then generate a complete South African Last
                  Will &amp; Testament.
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  AI-powered interview — agent instructions are managed centrally and updates
                  propagate automatically with no code changes required.
                </p>
                <Button
                  onClick={createSession}
                  className="mt-4"
                  disabled={!isConfigured || isLoading}
                >
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
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          Session {formatDate(s.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.messageCount} messages</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={s.willReady ? 'default' : 'secondary'}
                        className={s.willReady ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                      >
                        {s.willReady
                          ? 'Complete'
                          : s.status === 'active'
                            ? 'In Progress'
                            : s.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => resumeSession(s.id)}>
                        {s.willReady ? 'View' : 'Resume'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={!outputPack}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSaveConfirm(true)}
                disabled={isSaving || willSaved}
              >
                {willSaved ? (
                  <div className="contents">
                    <Check className="h-4 w-4 mr-1" />
                    Saved
                  </div>
                ) : isSaving ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </div>
                ) : (
                  <div className="contents">
                    <Save className="h-4 w-4 mr-1" />
                    Save Will
                  </div>
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
              <Bot className="h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="will" className="flex items-center gap-1.5">
              <Scroll className="h-3.5 w-3.5" />
              Will
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Issues
            </TabsTrigger>
            <TabsTrigger value="checklist" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Checklist
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
                    <p className="text-sm text-muted-foreground">
                      Execution checklist will be generated.
                    </p>
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
              This will save the generated Last Will &amp; Testament to {clientName}'s record. The
              will can still be edited and will need to be finalized separately once the signed
              original is collected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveWill}>
              {isSaving ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </div>
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
