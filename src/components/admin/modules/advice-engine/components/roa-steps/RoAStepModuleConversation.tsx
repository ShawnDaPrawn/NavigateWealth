import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Textarea } from '../../../../../ui/textarea';
import { MessageRenderer } from '../../../../../shared/MessageRenderer';
import { RoADraft, RoAModule } from '../DraftRoAInterface';
import { getFallbackRuntimeModule } from '../../roaModuleRuntime';
import { useRoAModuleChat } from '../../hooks/useRoAModuleChat';
import { RoAStepModuleDetails } from './RoAStepModuleDetails';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Upload,
  User,
} from 'lucide-react';
import type {
  RoAConvMessage,
  RoAConvUploadRef,
  RoAModuleConversationConfig,
  RoAModuleConversationStatus,
} from '../../types';

interface RoAStepModuleConversationProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
  modules?: RoAModule[];
  /** Called when every selected module is complete and the adviser proceeds. */
  onAllComplete?: () => void;
}

function resolveModule(modules: RoAModule[] | undefined, moduleId: string): RoAModule | undefined {
  return modules?.find((module) => module.id === moduleId) || getFallbackRuntimeModule(moduleId);
}

function isConversationModule(module: RoAModule | undefined): boolean {
  // Conversation is the default authoring mode; only explicit 'form' uses legacy.
  return (module?.authoringMode ?? 'conversation') !== 'form';
}

export function RoAStepModuleConversation({
  draft,
  onUpdate,
  modules,
  onAllComplete,
}: RoAStepModuleConversationProps) {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);

  if (!draft || !draft.selectedModules.length) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
        <p className="text-muted-foreground">
          No modules selected. Please go back and select modules first.
        </p>
      </div>
    );
  }

  const currentModuleId = draft.selectedModules[currentModuleIndex];
  const currentModule = resolveModule(modules, currentModuleId);

  if (!currentModule) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Module configuration not found</p>
      </div>
    );
  }

  const conversationStatus = draft.moduleConversationStatus || {};

  const moduleIsComplete = (moduleId: string): boolean => {
    return conversationStatus[moduleId] === 'complete';
  };

  const goToNextIncompleteModule = () => {
    const nextIncomplete = draft.selectedModules.findIndex(
      (moduleId, index) => index > currentModuleIndex && !moduleIsComplete(moduleId),
    );
    if (nextIncomplete >= 0) {
      setCurrentModuleIndex(nextIncomplete);
      return;
    }
    // No later incomplete module — check whether anything remains anywhere.
    const anyIncomplete = draft.selectedModules.findIndex(
      (moduleId) => !moduleIsComplete(moduleId),
    );
    if (anyIncomplete >= 0) {
      setCurrentModuleIndex(anyIncomplete);
      return;
    }
    // All complete — signal the wizard to move on.
    onAllComplete?.();
  };

  const useFormFallback = !isConversationModule(currentModule);

  return (
    <div className="space-y-6">
      {/* Module stepper (mirrors RoAStepModuleDetails) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                {currentModule.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Module {currentModuleIndex + 1} of {draft.selectedModules.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {moduleIsComplete(currentModuleId) && (
                <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentModuleIndex((index) => Math.max(0, index - 1))}
              disabled={currentModuleIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Module
            </Button>

            <div className="flex gap-2">
              {draft.selectedModules.map((moduleId, index) => {
                const isComplete = moduleIsComplete(moduleId);
                return (
                  <Button
                    key={moduleId}
                    variant={index === currentModuleIndex ? 'default' : 'outline'}
                    size="sm"
                    className="relative"
                    onClick={() => setCurrentModuleIndex(index)}
                  >
                    {index + 1}
                    {isComplete && (
                      <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-600" />
                    )}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentModuleIndex((index) =>
                  Math.min(draft.selectedModules.length - 1, index + 1),
                )
              }
              disabled={currentModuleIndex === draft.selectedModules.length - 1}
            >
              Next Module
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {useFormFallback ? (
        // Legacy form-mode module: reuse the existing form details UI for this module.
        <div className="space-y-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            This module is configured for form-based capture. Complete the form below.
          </div>
          <RoAStepModuleDetails
            draft={{ ...draft, selectedModules: [currentModuleId] }}
            onUpdate={onUpdate}
            modules={modules}
          />
        </div>
      ) : (
        <ModuleConversationPanel
          key={currentModuleId}
          draftId={draft.id}
          moduleId={currentModuleId}
          module={currentModule}
          onProceed={goToNextIncompleteModule}
          onStatusChange={(nextStatus) => {
            if (conversationStatus[currentModuleId] === nextStatus) return;
            onUpdate({
              moduleConversationStatus: {
                ...conversationStatus,
                [currentModuleId]: nextStatus,
              },
            });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Per-module conversation panel
// ============================================================================

interface ModuleConversationPanelProps {
  draftId: string;
  moduleId: string;
  module: RoAModule;
  onProceed: () => void;
  onStatusChange: (status: RoAModuleConversationStatus) => void;
}

function ModuleConversationPanel({
  draftId,
  moduleId,
  module,
  onProceed,
  onStatusChange,
}: ModuleConversationPanelProps) {
  const { messages, status, isComplete, isLoading, sendMessage, uploadFile, completeModule } =
    useRoAModuleChat({ draftId, moduleId });
  const [draftMessage, setDraftMessage] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Bubble status changes up so the wizard stepper / canProceed stay in sync.
  useEffect(() => {
    onStatusChange(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const conversationConfig: RoAModuleConversationConfig | undefined = module.conversation;
  const uploads = conversationConfig?.uploads || [];
  const completionMode = conversationConfig?.completion?.mode || 'ai-signal';
  const openingMessage = conversationConfig?.openingMessage;

  // The transcript: prepend the contract opening message when no assistant
  // message has been recorded yet.
  const transcript: RoAConvMessage[] = useMemo(() => {
    if (messages.length === 0 && openingMessage) {
      const opening: RoAConvMessage = {
        id: 'opening-message',
        role: 'assistant',
        content: openingMessage,
        createdAt: new Date().toISOString(),
      };
      return [opening];
    }
    return messages;
  }, [messages, openingMessage]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length, isLoading]);

  const handleSend = async () => {
    const text = draftMessage.trim();
    if (!text || isLoading) return;
    setDraftMessage('');
    try {
      await sendMessage(text);
    } catch {
      // useRoAModuleChat's onError already rolls back the optimistic message
      // and shows a toast; restore the draft so the user doesn't lose it,
      // and swallow here so the rejection doesn't reach window as an
      // unhandled promise rejection (it was an onClick={handleSend} handler,
      // so nothing else was awaiting this call).
      setDraftMessage(text);
    }
  };

  const handleUpload = async (uploadId: string, file: File | null) => {
    if (!file) return;
    setUploadingId(uploadId);
    try {
      await uploadFile(uploadId, file);
    } finally {
      setUploadingId(null);
    }
  };

  // Manual mode lets advisers complete at any time; ai-signal mode waits for
  // the assistant to flag completion (isComplete).
  const canComplete = completionMode === 'manual' || isComplete;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <p className="text-sm text-muted-foreground">{module.description}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {/* Transcript */}
          <div className="max-h-[460px] min-h-[280px] space-y-4 overflow-y-auto rounded-md border bg-muted/10 p-4">
            {transcript.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
                <Bot className="mb-3 h-8 w-8 opacity-50" />
                Start the conversation to complete this module.
              </div>
            )}
            {transcript.map((message) => (
              <ConversationBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Thinking...
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Composer */}
          <div className="space-y-2">
            <Textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type your message... (Cmd/Ctrl+Enter to send)"
              className="min-h-[88px]"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {completionMode === 'manual'
                  ? 'You can mark this module complete at any time.'
                  : isComplete
                    ? 'The assistant has gathered everything needed.'
                    : 'Keep chatting until the assistant has what it needs.'}
              </p>
              <Button onClick={handleSend} disabled={!draftMessage.trim() || isLoading}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>

          {/* Complete & continue */}
          <div className="flex items-center justify-end border-t pt-4">
            <Button
              variant="default"
              onClick={() => {
                void (async () => {
                  if (!isComplete && completionMode === 'manual') {
                    await completeModule();
                  }
                  onProceed();
                })();
              }}
              disabled={!canComplete || isLoading}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete & continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Uploads sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" />
              Supporting documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploads.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No documents are required for this module. You can attach files through the
                conversation if needed.
              </p>
            )}
            {uploads.map((upload) => (
              <div key={upload.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{upload.label}</span>
                  {upload.required && <Badge variant="outline">Required</Badge>}
                </div>
                {upload.guidance && (
                  <p className="mt-1 text-xs text-muted-foreground">{upload.guidance}</p>
                )}
                {upload.acceptedMimeTypes && upload.acceptedMimeTypes.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Accepted: {upload.acceptedMimeTypes.join(', ')}
                  </p>
                )}
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {uploadingId === upload.id ? 'Uploading...' : 'Attach file'}
                  <input
                    type="file"
                    className="hidden"
                    accept={upload.acceptedMimeTypes?.join(',')}
                    disabled={uploadingId === upload.id || isLoading}
                    onChange={(event) => handleUpload(upload.id, event.target.files?.[0] || null)}
                  />
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        <ModuleStatusCard status={status} />
      </div>
    </div>
  );
}

function ModuleStatusCard({ status }: { status: RoAModuleConversationStatus }) {
  const label =
    status === 'complete' ? 'Complete' : status === 'in_progress' ? 'In progress' : 'Not started';
  const badgeClass =
    status === 'complete'
      ? 'bg-green-100 text-green-700 border-green-200'
      : status === 'in_progress'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-muted bg-muted/30 text-muted-foreground';

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-sm font-medium">Module status</span>
        <Badge variant="outline" className={badgeClass}>
          {label}
        </Badge>
      </CardContent>
    </Card>
  );
}

function ConversationBubble({ message }: { message: RoAConvMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
            isUser
              ? 'rounded-br-none bg-violet-600 text-white'
              : 'rounded-bl-none border border-gray-100 bg-white text-gray-800'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          ) : (
            <div className="markdown-content leading-relaxed">
              <MessageRenderer content={message.content} />
            </div>
          )}
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.attachments.map((attachment: RoAConvUploadRef) => (
              <Badge key={attachment.id} variant="secondary" className="gap-1 text-[11px]">
                <FileText className="h-3 w-3" />
                {attachment.fileName}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100">
          <User className="h-4 w-4 text-violet-700" />
        </div>
      )}
    </div>
  );
}
