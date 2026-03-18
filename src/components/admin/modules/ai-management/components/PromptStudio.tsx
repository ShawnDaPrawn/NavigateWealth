import React, { useMemo, useState } from 'react';
import { Bot, Loader2, Save, Upload, RotateCcw, History, Sprout } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Textarea } from '../../../../ui/textarea';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import type { AIAgentConfig, PromptContext, PromptVersion } from '../types';
import { useAgents, usePromptBundle, useSaveDraftPrompt, usePublishPrompt, useRollbackPrompt, useSeedPrompt } from '../hooks';
import { getDefaultPrompt } from '../defaultPrompts';

const CONTEXTS: Array<{ id: PromptContext; label: string }> = [
  { id: 'public', label: 'Public' },
  { id: 'authenticated', label: 'Authenticated' },
  { id: 'admin', label: 'Admin' },
];

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function PromptStudio() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const [agentId, setAgentId] = useState<string>('vasco-public');
  const [context, setContext] = useState<PromptContext>('public');

  const agent: AIAgentConfig | undefined = useMemo(
    () => agents?.find((a) => a.id === agentId),
    [agents, agentId],
  );

  const { data, isLoading } = usePromptBundle(agentId, context);
  const saveDraft = useSaveDraftPrompt();
  const publish = usePublishPrompt();
  const rollback = useRollbackPrompt();
  const seed = useSeedPrompt();

  const [localDraft, setLocalDraft] = useState('');

  // Keep localDraft in sync with loaded draft (but don't clobber typing)
  React.useEffect(() => {
    if (typeof data?.draft === 'string') {
      setLocalDraft(data.draft);
    } else if (typeof data?.active === 'string') {
      setLocalDraft(data.active);
    } else {
      setLocalDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, context, data?.draft, data?.active]);

  const versions: PromptVersion[] = data?.versions ?? [];

  const dirty = (data?.draft ?? data?.active ?? '') !== localDraft;
  const needsSeed = !data?.active && !data?.draft;
  const defaultPrompt = useMemo(() => getDefaultPrompt(agentId, context), [agentId, context]);

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50">
            <Bot className="h-4 w-4 text-purple-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Prompt Studio</div>
            <div className="text-xs text-gray-500">Edit and publish prompts without redeploying</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              {(agents ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={context} onValueChange={(v) => setContext(v as PromptContext)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Context" />
            </SelectTrigger>
            <SelectContent>
              {CONTEXTS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            className="gap-2"
            disabled={!dirty || saveDraft.isPending}
            onClick={() => saveDraft.mutate({ agentId, context, prompt: localDraft })}
          >
            {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>

          <Button
            variant="outline"
            className="gap-2"
            disabled={seed.isPending || !localDraft.trim()}
            onClick={() => seed.mutate({ agentId, context, seedPrompt: localDraft })}
          >
            {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
            Seed (if empty)
          </Button>

          {needsSeed && defaultPrompt && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={seed.isPending}
              onClick={() => seed.mutate({ agentId, context, seedPrompt: defaultPrompt })}
            >
              {seed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
              Seed from default
            </Button>
          )}

          <Button
            className="gap-2 bg-purple-600 hover:bg-purple-700"
            disabled={publish.isPending || !localDraft.trim()}
            onClick={() => publish.mutate({ agentId, context })}
          >
            {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Editors */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-gray-900">
                {agent?.name ?? agentId} — {context}
              </div>
              <div className="text-xs text-gray-500">
                Left is live (read-only). Right is your draft (editable).
              </div>
            </div>
            {dirty && (
              <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Unsaved</Badge>
            )}
            {needsSeed && (
              <Badge className="bg-blue-100 text-blue-800 border border-blue-200">Not seeded</Badge>
            )}
          </div>

          <div className="grid md:grid-cols-2">
            <div className="p-4 border-r border-gray-100">
              <div className="text-xs font-semibold text-gray-700 mb-2">Live prompt</div>
              <Textarea
                value={data?.active ?? ''}
                readOnly
                className="min-h-[520px] font-mono text-xs bg-gray-50"
              />
            </div>
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-700 mb-2">Draft prompt</div>
              <Textarea
                value={localDraft}
                onChange={(e) => setLocalDraft(e.target.value)}
                className="min-h-[520px] font-mono text-xs"
              />
            </div>
          </div>

          {(isLoading || publish.isPending) && (
            <div className="p-4 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
        </div>

        {/* Versions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-600" />
              <div className="text-sm font-semibold text-gray-900">Version history</div>
            </div>
          </div>

          <div className="p-3 space-y-2 max-h-[620px] overflow-auto">
            {versions.length === 0 ? (
              <div className="text-sm text-gray-500 p-3">
                No published versions yet. Publish once to create history.
              </div>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className={cn('p-3 rounded-lg border border-gray-100 hover:border-gray-200')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{formatWhen(v.publishedAt)}</div>
                      <div className="text-[11px] text-gray-500 truncate">by {v.publishedBy}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={rollback.isPending}
                      onClick={() => rollback.mutate({ agentId, context, versionId: v.id })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rollback
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

