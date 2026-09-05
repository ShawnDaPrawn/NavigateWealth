/**
 * PromptStudio — the Prompts tab.
 *
 * One assistant at a time, one editable draft, one Publish button. The live
 * prompt is available for comparison and every published version can be
 * restored. Only assistants that actually read their prompt from here are
 * offered (see PROMPT_AGENTS).
 */

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Upload,
  RotateCcw,
  History,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../../ui/collapsible';
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
import { cn } from '../../../../ui/utils';
import type { PromptVersion } from '../types';
import {
  usePromptBundle,
  useSaveDraftPrompt,
  usePublishPrompt,
  useRollbackPrompt,
  useSeedPrompt,
} from '../hooks';
import { PROMPT_AGENTS } from '../constants';
import { getDefaultPrompt } from '../defaultPrompts';
import { formatDateTime } from '../format';

const PROMPT_BUNDLE_KEY = ['ai-management', 'prompt-bundle'] as const;

export function PromptStudio() {
  const queryClient = useQueryClient();
  const [agentId, setAgentId] = useState<string>(PROMPT_AGENTS[0].id);
  const agent = useMemo(
    () => PROMPT_AGENTS.find((a) => a.id === agentId) ?? PROMPT_AGENTS[0],
    [agentId],
  );
  const context = agent.context;

  const { data, isLoading } = usePromptBundle(agentId, context);
  const saveDraft = useSaveDraftPrompt();
  const publish = usePublishPrompt();
  const rollback = useRollbackPrompt();
  const seed = useSeedPrompt();

  const [localDraft, setLocalDraft] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<PromptVersion | null>(null);

  // Keep localDraft in sync with the loaded draft (but don't clobber typing)
  React.useEffect(() => {
    if (typeof data?.draft === 'string') setLocalDraft(data.draft);
    else if (typeof data?.active === 'string') setLocalDraft(data.active);
    else setLocalDraft('');
  }, [agentId, context, data?.draft, data?.active]);

  const versions: PromptVersion[] = data?.versions ?? [];
  const latest = versions[0];
  const savedDraft = data?.draft ?? data?.active ?? '';
  const dirty = savedDraft !== localDraft;
  const draftDiffersFromLive = !!data?.active && (data.draft ?? data.active) !== data.active;
  const nothingYet = !isLoading && !data?.active && !data?.draft;
  const defaultPrompt = useMemo(() => getDefaultPrompt(agentId, context), [agentId, context]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: PROMPT_BUNDLE_KEY });

  const handleSaveDraft = () =>
    saveDraft.mutate(
      { agentId, context, prompt: localDraft },
      {
        onSuccess: () => {
          refresh();
          toast.success('Draft saved. Vasco keeps using the live version until you publish.');
        },
        onError: () => toast.error('Could not save the draft'),
      },
    );

  const handlePublish = async () => {
    try {
      if (dirty) {
        await saveDraft.mutateAsync({ agentId, context, prompt: localDraft });
      }
      await publish.mutateAsync({ agentId, context });
      refresh();
      toast.success(`Published. ${agent.label} now uses these instructions.`);
    } catch {
      toast.error('Could not publish the prompt');
    }
  };

  const handleSeed = () => {
    if (!defaultPrompt) return;
    seed.mutate(
      { agentId, context, seedPrompt: defaultPrompt },
      {
        onSuccess: () => {
          refresh();
          toast.success('Started from the built-in default. Edit it, then publish.');
        },
        onError: () => toast.error('Could not load the default prompt'),
      },
    );
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    rollback.mutate(
      { agentId, context, versionId: restoreTarget.id },
      {
        onSuccess: () => {
          refresh();
          setRestoreTarget(null);
          toast.success('Version restored and live.');
        },
        onError: () => toast.error('Could not restore that version'),
      },
    );
  };

  const busy = saveDraft.isPending || publish.isPending || seed.isPending;

  return (
    <div className="space-y-6">
      {/* Which assistant */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1 min-w-0">
          <label
            htmlFor="prompt-agent"
            className="text-xs font-medium text-gray-500 uppercase tracking-wide"
          >
            Assistant
          </label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger
              id="prompt-agent"
              className="mt-1 w-full lg:w-[360px]"
              aria-label="Assistant"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMPT_AGENTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1.5">{agent.description}</p>
        </div>
        <div className="text-sm lg:text-right">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </span>
          ) : data?.active ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Custom prompt live
              </span>
              {latest && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Published {formatDateTime(latest.publishedAt)} by {latest.publishedBy}
                </p>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <Info className="h-4 w-4" /> Using the built-in default
            </span>
          )}
        </div>
      </section>

      <p className="text-xs text-gray-500 -mt-3 px-1">
        Other assistants (AI Intelligence, Will Planner, Tax Advisor) use instructions fixed in code
        and cannot be edited here yet.
      </p>

      {nothingYet ? (
        /* Empty state: one clear way in */
        <section className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Sparkles className="h-8 w-8 text-purple-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No custom instructions yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
            {agent.label} is answering with the built-in default. Start from that default, change
            what you like, and publish when you are happy.
          </p>
          <Button
            onClick={handleSeed}
            disabled={seed.isPending || !defaultPrompt}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {seed.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Start from the built-in default
          </Button>
        </section>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Editor */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Instructions</h3>
                <p className="text-xs text-gray-500">
                  Saving a draft changes nothing for Vasco. Publishing makes it live immediately.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dirty && (
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
                    Unsaved
                  </Badge>
                )}
                {!dirty && draftDiffersFromLive && (
                  <Badge className="bg-blue-100 text-blue-800 border border-blue-200">
                    Draft differs from live
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4">
              <Textarea
                value={localDraft}
                onChange={(e) => setLocalDraft(e.target.value)}
                className="min-h-[460px] font-mono text-xs"
                aria-label="Prompt instructions"
                disabled={isLoading}
              />
            </div>

            <div className="p-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={!dirty || busy}
                onClick={handleSaveDraft}
              >
                {saveDraft.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </Button>
              <Button
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                disabled={busy || !localDraft.trim() || (!dirty && !draftDiffersFromLive)}
                onClick={handlePublish}
              >
                {publish.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Publish
              </Button>
              {defaultPrompt && (
                <Button
                  variant="ghost"
                  className="gap-2 text-gray-600 ml-auto"
                  disabled={busy}
                  onClick={() => setLocalDraft(defaultPrompt)}
                >
                  <Sparkles className="h-4 w-4" />
                  Reset to built-in default
                </Button>
              )}
            </div>

            {data?.active && (
              <Collapsible open={compareOpen} onOpenChange={setCompareOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-4 py-3 border-t border-gray-100 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', compareOpen && 'rotate-180')}
                    />
                    {compareOpen ? 'Hide' : 'Show'} the version Vasco is using right now
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <Textarea
                      value={data.active}
                      readOnly
                      className="min-h-[300px] font-mono text-xs bg-white"
                      aria-label="Live prompt (read-only)"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </section>

          {/* Versions */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Published versions</h3>
            </div>
            <div className="p-3 space-y-2 max-h-[620px] overflow-auto">
              {versions.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">
                  Nothing published yet. Each time you publish, the previous version is kept here so
                  you can go back.
                </p>
              ) : (
                versions.map((v, idx) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-lg border border-gray-100 hover:border-gray-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800 truncate">
                          {formatDateTime(v.publishedAt)}
                          {idx === 0 && (
                            <Badge className="ml-2 bg-green-100 text-green-800 border border-green-200 text-[10px]">
                              Live
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">by {v.publishedBy}</div>
                      </div>
                      {idx !== 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={rollback.isPending}
                          onClick={() => setRestoreTarget(v)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              The version published {restoreTarget ? formatDateTime(restoreTarget.publishedAt) : ''}{' '}
              becomes live for {agent.label} immediately. The current live version stays in the
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {rollback.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
