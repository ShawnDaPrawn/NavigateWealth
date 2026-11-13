import React from 'react';
import { toast } from 'sonner';
import { Archive, CheckCircle, Filter, Layers, Plus, Save, Search, Star } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { useSearchParams } from 'react-router';
import {
  SegmentedList,
  SegmentedTrigger,
  NoAccess,
  useConfirm,
  useUrlState,
} from '../../../layout/page';
import { Textarea } from '../../../../ui/textarea';
import { useAuth } from '../../../../auth/AuthContext';
import { useRoAModuleContracts } from '../hooks';
import { FALLBACK_ROA_MODULE_CONTRACTS } from '../roaModuleContractFallbacks';
import type { RoAModuleContract } from '../types';
import {
  cloneContract,
  EMPTY_CONTRACT,
  getEvidenceCount,
  getRequiredFieldCount,
  getTemplateIssues,
  isConversationContract,
  isFlagshipContract,
} from './roaContractHelpers';
import { getStatusBadge } from './roa-contract-editors/StatusBadge';
import { BasicEditor } from './roa-contract-editors/BasicEditor';
import { FieldsEditor } from './roa-contract-editors/FieldsEditor';
import { EvidenceEditor } from './roa-contract-editors/EvidenceEditor';
import { ConversationEditor } from './roa-contract-editors/ConversationEditor';
import { DocumentEditor } from './roa-contract-editors/DocumentEditor';
import { DisclosuresEditor } from './roa-contract-editors/DisclosuresEditor';
import { PreviewPanel } from './roa-contract-editors/PreviewPanel';

const CONTRACT_TABS = [
  'basic',
  'conversation',
  'fields',
  'evidence',
  'document',
  'disclosures',
  'json',
  'preview',
] as const;
type ContractTab = (typeof CONTRACT_TABS)[number];

export function RoAModuleContractManager() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'super-admin';
  const {
    contracts,
    schemaFormat,
    isLoading,
    saveContract,
    publishContract,
    archiveContract,
    isSaving,
  } = useRoAModuleContracts({ includeArchived: true });

  // The open contract and editor tab are in the address (?contract=<id>&contractTab=fields).
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('contract') ?? '';
  const setSelectedId = React.useCallback(
    (id: string) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (id) params.set('contract', id);
          else params.delete('contract');
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [editorTab, setEditorTab] = useUrlState<ContractTab>('contractTab', 'basic', CONTRACT_TABS);
  const { confirm, confirmDialog } = useConfirm();
  const [draft, setDraft] = React.useState<RoAModuleContract | null>(null);
  const [jsonDraft, setJsonDraft] = React.useState('');
  const [listSearch, setListSearch] = React.useState('');
  const [listStatus, setListStatus] = React.useState<'all' | RoAModuleContract['status']>('all');
  const [listCategory, setListCategory] = React.useState<string>('all');
  const [listFlagship, setListFlagship] = React.useState<'all' | 'flagship' | 'standard'>('all');
  const visibleContracts = contracts.length > 0 ? contracts : FALLBACK_ROA_MODULE_CONTRACTS;

  const contractCategories = React.useMemo(() => {
    const bucket = new Set<string>();
    visibleContracts.forEach((contract) => bucket.add(contract.category || 'Uncategorised'));
    return Array.from(bucket).sort((a, b) => a.localeCompare(b));
  }, [visibleContracts]);

  const filteredContracts = React.useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return visibleContracts
      .filter((contract) => (listStatus === 'all' ? true : contract.status === listStatus))
      .filter((contract) =>
        listCategory === 'all' ? true : (contract.category || 'Uncategorised') === listCategory,
      )
      .filter((contract) =>
        listFlagship === 'all'
          ? true
          : listFlagship === 'flagship'
            ? isFlagshipContract(contract)
            : !isFlagshipContract(contract),
      )
      .filter((contract) => {
        if (!q) return true;
        const haystack =
          `${contract.id} ${contract.title} ${contract.description} ${contract.output.normalizedKey} ${contract.category || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice()
      .sort((a, b) => {
        const flagshipA = isFlagshipContract(a) ? 0 : 1;
        const flagshipB = isFlagshipContract(b) ? 0 : 1;
        if (flagshipA !== flagshipB) return flagshipA - flagshipB;
        return a.title.localeCompare(b.title);
      });
  }, [visibleContracts, listSearch, listStatus, listCategory, listFlagship]);

  const filtersActive = Boolean(
    listSearch.trim() || listStatus !== 'all' || listCategory !== 'all' || listFlagship !== 'all',
  );
  const flagshipCount = React.useMemo(
    () => visibleContracts.filter((contract) => isFlagshipContract(contract)).length,
    [visibleContracts],
  );
  const selectedHiddenByFilters = Boolean(
    draft && filtersActive && !filteredContracts.some((contract) => contract.id === draft.id),
  );

  React.useEffect(() => {
    if (!selectedId && visibleContracts.length > 0) {
      setSelectedId(visibleContracts[0].id);
    }
  }, [visibleContracts, selectedId, setSelectedId]);

  React.useEffect(() => {
    const selected = visibleContracts.find((contract) => contract.id === selectedId);
    if (selected) {
      const nextDraft = cloneContract(selected);
      setDraft(nextDraft);
      setJsonDraft(JSON.stringify(nextDraft, null, 2));
    }
  }, [visibleContracts, selectedId]);

  const updateDraft = React.useCallback(
    (updater: (current: RoAModuleContract) => RoAModuleContract) => {
      setDraft((current) => {
        if (!current) return current;
        const next = updater(cloneContract(current));
        setJsonDraft(JSON.stringify(next, null, 2));
        return next;
      });
    },
    [],
  );

  const handleCreate = () => {
    const now = new Date().toISOString();
    const contract = {
      ...cloneContract(EMPTY_CONTRACT),
      id: `new_roa_module_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setSelectedId(contract.id);
    setDraft(contract);
    setJsonDraft(JSON.stringify(contract, null, 2));
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const saved = await saveContract({
        ...draft,
        // The UI treats a missing authoringMode as conversation; persist that
        // explicitly so the backend (which defaults missing → 'form') doesn't
        // silently downgrade a conversation module and break its chat endpoints.
        authoringMode: draft.authoringMode ?? 'conversation',
        status: draft.status === 'active' ? 'draft' : draft.status,
      });
      setSelectedId(saved.id);
      toast.success('RoA module contract saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save RoA module contract');
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    const issues = getTemplateIssues(draft);
    if (issues.length > 0) {
      toast.error(
        `Fix ${issues.length} contract issue${issues.length === 1 ? '' : 's'} before publishing`,
      );
      return;
    }
    try {
      const saved = await saveContract({
        ...draft,
        authoringMode: draft.authoringMode ?? 'conversation',
        status: 'draft',
      });
      const published = await publishContract(saved.id);
      setSelectedId(published.id);
      toast.success('RoA module contract published');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish RoA module contract');
    }
  };

  const handleArchive = async () => {
    if (!draft) return;
    const ok = await confirm({
      title: 'Archive contract?',
      description: `Archive “${draft.title}”? It stops appearing when advisers pick modules. Existing RoAs are not changed.`,
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;
    try {
      const archived = await archiveContract(draft.id);
      setSelectedId(archived.id);
      toast.success('RoA module contract archived');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive RoA module contract');
    }
  };

  const handleJsonApply = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as RoAModuleContract;
      setDraft(parsed);
      toast.success('JSON applied to draft');
    } catch {
      toast.error('JSON is not valid');
    }
  };

  if (!isSuperAdmin) {
    return (
      <NoAccess
        what="RoA contracts"
        howToGetAccess="RoA module contracts are system-level configuration, so only a super admin can change them."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="h-96 animate-pulse bg-muted/30" />
        </Card>
        <Card>
          <CardContent className="h-96 animate-pulse bg-muted/30" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" aria-hidden="true" />
                Contracts
                <span className="text-xs font-normal tabular-nums text-nw-text-3">
                  {filtersActive
                    ? `${filteredContracts.length} of ${visibleContracts.length}`
                    : visibleContracts.length}
                  {flagshipCount > 0 ? ` · ${flagshipCount} flagship` : ''}
                </span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={handleCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="contract-list-search"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Search title, ID, normalized key…"
                className="h-9 pl-9 text-sm"
                aria-label="Search contracts"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </div>
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={listStatus}
                  onValueChange={(value) => setListStatus(value as typeof listStatus)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={listCategory} onValueChange={setListCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {contractCategories.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Library</Label>
                <Select
                  value={listFlagship}
                  onValueChange={(value) => setListFlagship(value as typeof listFlagship)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    <SelectItem value="flagship">Flagship only</SelectItem>
                    <SelectItem value="standard">Standard only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filtersActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setListSearch('');
                    setListStatus('all');
                    setListCategory('all');
                    setListFlagship('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[min(560px,calc(100vh-240px))] overflow-y-auto pr-1">
            {selectedHiddenByFilters && draft && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                The open contract (&quot;{draft.title}&quot;) is hidden by filters. Clear search or
                widen filters to see it in this list.
              </div>
            )}
            {filteredContracts.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No contracts match filters.
              </p>
            )}
            {filteredContracts.map((contract) => (
              <button
                key={contract.id}
                type="button"
                onClick={() => setSelectedId(contract.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === contract.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium leading-tight">{contract.title}</span>
                      {isFlagshipContract(contract) && (
                        <Badge
                          variant="secondary"
                          className="gap-0.5 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-950"
                        >
                          <Star className="h-3 w-3" />
                          Flagship
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                      {contract.id}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{contract.category}</div>
                  </div>
                  {getStatusBadge(contract)}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{getRequiredFieldCount(contract)} required fields</span>
                  <span>{getEvidenceCount(contract)} evidence</span>
                  <span className="font-mono">
                    rev {contract.version} · {contract.schemaVersion}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {draft ? (
          <Tabs
            value={
              isConversationContract(draft)
                ? editorTab === 'fields' || editorTab === 'evidence'
                  ? 'basic'
                  : editorTab
                : editorTab === 'conversation'
                  ? 'basic'
                  : editorTab
            }
            onValueChange={(v) => setEditorTab(v as ContractTab)}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 rounded-xl border border-nw-line bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-nw-ink">
                  {draft.title || 'Untitled contract'}
                </h2>
                <p className="text-sm text-nw-text-3">
                  {[
                    draft.category || 'Uncategorised',
                    isConversationContract(draft) ? 'AI conversation' : 'Form',
                    `schema ${draft.schemaVersion}`,
                  ].join(' · ')}{' '}
                  <span className="ml-1 inline-block align-middle">{getStatusBadge(draft)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleArchive}
                  disabled={isSaving || draft.status === 'archived'}
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  Archive
                </Button>
                <Button variant="outline" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save draft
                </Button>
                <Button onClick={handlePublish} disabled={isSaving}>
                  <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  Publish
                </Button>
              </div>
            </div>
            <SegmentedList aria-label="Contract editor">
              <SegmentedTrigger value="basic">Basic</SegmentedTrigger>
              {isConversationContract(draft) ? (
                <SegmentedTrigger value="conversation">Conversation</SegmentedTrigger>
              ) : (
                <>
                  <SegmentedTrigger value="fields">Fields</SegmentedTrigger>
                  <SegmentedTrigger value="evidence">Evidence</SegmentedTrigger>
                </>
              )}
              <SegmentedTrigger value="document">Document</SegmentedTrigger>
              <SegmentedTrigger value="disclosures">Disclosures</SegmentedTrigger>
              <SegmentedTrigger value="json">JSON</SegmentedTrigger>
              <SegmentedTrigger value="preview">Preview</SegmentedTrigger>
            </SegmentedList>

            <TabsContent value="basic">
              <BasicEditor draft={draft} updateDraft={updateDraft} />
            </TabsContent>

            {isConversationContract(draft) ? (
              <TabsContent value="conversation">
                <ConversationEditor draft={draft} updateDraft={updateDraft} />
              </TabsContent>
            ) : (
              <>
                <TabsContent value="fields">
                  <FieldsEditor
                    draft={draft}
                    updateDraft={updateDraft}
                    schemaFormat={schemaFormat}
                  />
                </TabsContent>

                <TabsContent value="evidence">
                  <EvidenceEditor
                    draft={draft}
                    updateDraft={updateDraft}
                    schemaFormat={schemaFormat}
                  />
                </TabsContent>
              </>
            )}

            <TabsContent value="document">
              <DocumentEditor draft={draft} updateDraft={updateDraft} />
            </TabsContent>

            <TabsContent value="disclosures">
              <DisclosuresEditor draft={draft} updateDraft={updateDraft} />
            </TabsContent>

            <TabsContent value="json">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contract JSON</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={jsonDraft}
                    onChange={(event) => setJsonDraft(event.target.value)}
                    className="min-h-[520px] font-mono text-xs"
                    spellCheck={false}
                  />
                  <Button variant="outline" onClick={handleJsonApply}>
                    Apply JSON
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview">
              <PreviewPanel draft={draft} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a contract to edit.
            </CardContent>
          </Card>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
