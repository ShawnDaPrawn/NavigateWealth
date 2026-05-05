import React from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Archive,
  CheckCircle,
  FileText,
  Filter,
  Layers,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Checkbox } from '../../../../ui/checkbox';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/select';
import { Separator } from '../../../../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/tabs';
import { Textarea } from '../../../../ui/textarea';
import { useAuth } from '../../../../auth/AuthContext';
import { useRoAModuleContracts } from '../hooks';
import { FALLBACK_ROA_MODULE_CONTRACTS } from '../roaModuleContractFallbacks';
import { renderRuntimeTemplate } from '../roaModuleRuntime';
import type {
  RoAContractFieldType,
  RoAContractSourceType,
  RoAModuleContract,
} from '../types';

type ContractSection = RoAModuleContract['formSchema']['sections'][number];
type ContractField = ContractSection['fields'][number];
type EvidenceRequirement = RoAModuleContract['evidence']['requirements'][number];
type DocumentSection = RoAModuleContract['documentSections'][number];

const EMPTY_CONTRACT: RoAModuleContract = {
  id: 'new_roa_module',
  title: 'New RoA Module',
  description: '',
  category: 'Risk Management',
  status: 'draft',
  version: 1,
  schemaVersion: '1.0',
  input: {
    sources: [
      {
        id: 'client_profile',
        label: 'Client profile and personal details',
        type: 'clientSnapshot',
        required: true,
        sourcePath: 'draft.clientSnapshot',
      },
      {
        id: 'adviser_profile',
        label: 'Adviser profile',
        type: 'adviserSnapshot',
        required: true,
        sourcePath: 'draft.adviserSnapshot',
      },
    ],
    gatheringMethods: ['clientProfile', 'typed'],
  },
  formSchema: {
    sections: [
      {
        id: 'details',
        title: 'Details',
        fields: [
          {
            key: 'rationale',
            label: 'Rationale',
            type: 'textarea',
            required: true,
            source: 'moduleInput',
          },
        ],
      },
    ],
  },
  output: {
    normalizedKey: 'newRoAModule',
    fields: [
      {
        key: 'rationale',
        label: 'Rationale',
        type: 'string',
        required: true,
      },
    ],
  },
  validation: {
    requiredFields: ['rationale'],
    rules: [
      {
        id: 'rationale_required',
        severity: 'blocking',
        message: 'A rationale is required before this module can be compiled.',
      },
    ],
  },
  evidence: {
    requirements: [],
  },
  documentSections: [
    {
      id: 'recommendation',
      title: 'Recommendation',
      purpose: 'Explain the recommendation and why it is suitable for the client.',
      order: 10,
      required: true,
      template: [
        '## Recommendation',
        'Client: {{client.displayName}}',
        '',
        '{{module.rationale}}',
        '',
        'Adviser: {{adviser.displayName}}',
      ].join('\n'),
    },
  ],
  disclosures: [],
  compileOrder: ['recommendation'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'system',
  updatedBy: 'system',
};

function cloneContract(contract: RoAModuleContract): RoAModuleContract {
  return JSON.parse(JSON.stringify(contract)) as RoAModuleContract;
}

function toId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]): string {
  return value.join('\n');
}

const TOKEN_EXAMPLES = [
  '{{client.displayName}}',
  '{{adviser.displayName}}',
  '{{module.rationale}}',
  '{{module.monthly_premium | currency}}',
  '{{evidence.provider_quote.fileName}}',
];

const TOKEN_FILTERS = ['currency', 'percentage', 'date'];
const TEMPLATE_ROOTS = ['client', 'adviser', 'module', 'evidence', 'draft'];
const EVIDENCE_TOKEN_PROPERTIES = ['fileName', 'label', 'type', 'source', 'sha256', 'uploadedAt'];

interface TemplateTokenOption {
  group: string;
  label: string;
  token: string;
  description: string;
}

function getRequiredFieldCount(contract: RoAModuleContract): number {
  return contract.formSchema.sections.reduce(
    (count, section) => count + section.fields.filter((field) => field.required).length,
    0,
  );
}

function getEvidenceCount(contract: RoAModuleContract): number {
  return contract.evidence.requirements.filter((item) => item.required).length;
}

function getStatusBadge(contract: RoAModuleContract) {
  if (contract.status === 'active') {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
  }
  if (contract.status === 'archived') {
    return <Badge variant="outline" className="bg-slate-100 text-slate-600">Archived</Badge>;
  }
  return <Badge variant="secondary">Draft</Badge>;
}

function isFlagshipContract(contract: RoAModuleContract): boolean {
  const flag = contract.metadata?.flagshipModule;
  return flag === true || flag === 'true';
}

function getContractFieldTokens(contract: RoAModuleContract): TemplateTokenOption[] {
  const fieldTokens = contract.formSchema.sections.flatMap((section) =>
    section.fields.map((field) => ({
      group: 'Module fields',
      label: field.label,
      token: `{{module.${field.key}${field.type === 'currency' ? ' | currency' : field.type === 'percentage' ? ' | percentage' : field.type === 'date' ? ' | date' : ''}}}`,
      description: `${section.title} field`,
    })),
  );

  const outputTokens = contract.output.fields.map((field) => ({
    group: 'Normalized output',
    label: field.label,
    token: `{{module.${field.key}}}`,
    description: 'Published output field',
  }));

  return [...fieldTokens, ...outputTokens];
}

function getTemplateTokenOptions(contract: RoAModuleContract): TemplateTokenOption[] {
  return [
    { group: 'Client', label: 'Client name', token: '{{client.displayName}}', description: 'Client display name from the RoA snapshot' },
    { group: 'Adviser', label: 'Adviser name', token: '{{adviser.displayName}}', description: 'Adviser display name from the RoA snapshot' },
    { group: 'Adviser', label: 'Adviser email', token: '{{adviser.email}}', description: 'Adviser email from the RoA snapshot' },
    ...getContractFieldTokens(contract),
    ...contract.evidence.requirements.map((requirement) => ({
      group: 'Evidence',
      label: `${requirement.label} file`,
      token: `{{evidence.${requirement.id}.fileName}}`,
      description: requirement.required ? 'Required evidence upload' : 'Optional evidence upload',
    })),
  ];
}

function extractTemplateTokens(template: string): Array<{ expression: string; path: string; filter?: string }> {
  const tokens: Array<{ expression: string; path: string; filter?: string }> = [];
  const tokenPattern = /{{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*([a-zA-Z]+))?\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(template)) !== null) {
    tokens.push({ expression: match[0], path: match[1], filter: match[2] });
  }
  return tokens;
}

function buildKnownModuleTokenPaths(contract: RoAModuleContract): Set<string> {
  return new Set([
    'module.rationale',
    ...contract.formSchema.sections.flatMap((section) => section.fields.map((field) => `module.${field.key}`)),
    ...contract.output.fields.map((field) => `module.${field.key}`),
  ]);
}

function getTemplateIssues(contract: RoAModuleContract): string[] {
  const issues: string[] = [];
  const modulePaths = buildKnownModuleTokenPaths(contract);
  const evidenceIds = new Set(contract.evidence.requirements.map((requirement) => requirement.id));
  const sectionIds = new Set(contract.documentSections.map((section) => section.id));

  contract.documentSections.forEach((section, index) => {
    if (!section.id.trim()) issues.push(`Document section ${index + 1} needs an ID.`);
    if (section.required && !section.template.trim()) {
      issues.push(`${section.title || `Section ${index + 1}`} needs an output template before publish.`);
    }

    extractTemplateTokens(section.template).forEach((token) => {
      const [root, evidenceId, property] = token.path.split('.');
      if (!TEMPLATE_ROOTS.includes(root)) {
        issues.push(`${section.title} uses unsupported token ${token.expression}.`);
      }
      if (token.filter && !TOKEN_FILTERS.includes(token.filter.toLowerCase())) {
        issues.push(`${section.title} uses unsupported filter ${token.filter}.`);
      }
      if (root === 'module' && !modulePaths.has(token.path)) {
        issues.push(`${section.title} uses unknown module token ${token.expression}.`);
      }
      if (root === 'evidence' && (!evidenceIds.has(evidenceId) || !EVIDENCE_TOKEN_PROPERTIES.includes(property))) {
        issues.push(`${section.title} uses unknown evidence token ${token.expression}.`);
      }
    });
  });

  contract.compileOrder.forEach((sectionId) => {
    if (sectionId !== 'disclosures' && !sectionIds.has(sectionId)) {
      issues.push(`Compile order references unknown section ${sectionId}.`);
    }
  });

  return Array.from(new Set(issues));
}

function getSampleTemplateContext(contract: RoAModuleContract): Record<string, unknown> {
  const module = Object.fromEntries(
    contract.formSchema.sections.flatMap((section) =>
      section.fields.map((field) => {
        if (field.default !== undefined) return [field.key, field.default];
        if (field.type === 'currency') return [field.key, 1250];
        if (field.type === 'percentage') return [field.key, 2.5];
        if (field.type === 'date') return [field.key, '2026-05-05'];
        if (field.type === 'number') return [field.key, 10];
        if (field.type === 'chips') return [field.key, ['Sample item']];
        if (field.type === 'checkbox') return [field.key, true];
        return [field.key, `Sample ${field.label.toLowerCase()}`];
      }),
    ),
  );

  return {
    client: {
      displayName: 'Jane Client',
      contactInformation: { email: 'jane.client@example.com' },
    },
    adviser: {
      displayName: 'Navigate Adviser',
      email: 'adviser@navigatewealth.co',
    },
    module,
    evidence: Object.fromEntries(contract.evidence.requirements.map((requirement) => [
      requirement.id,
      {
        fileName: `${requirement.id}.pdf`,
        label: requirement.label,
        type: requirement.type,
        source: 'adviser-upload',
        uploadedAt: '2026-05-05T08:00:00.000Z',
      },
    ])),
    draft: { id: 'sample-draft', createdAt: '2026-05-05T08:00:00.000Z' },
  };
}

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

  const [selectedId, setSelectedId] = React.useState<string>('');
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
        const haystack = `${contract.id} ${contract.title} ${contract.description} ${contract.output.normalizedKey} ${contract.category || ''}`.toLowerCase();
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
  }, [visibleContracts, selectedId]);

  React.useEffect(() => {
    const selected = visibleContracts.find((contract) => contract.id === selectedId);
    if (selected) {
      const nextDraft = cloneContract(selected);
      setDraft(nextDraft);
      setJsonDraft(JSON.stringify(nextDraft, null, 2));
    }
  }, [visibleContracts, selectedId]);

  const updateDraft = React.useCallback((updater: (current: RoAModuleContract) => RoAModuleContract) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(cloneContract(current));
      setJsonDraft(JSON.stringify(next, null, 2));
      return next;
    });
  }, []);

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
      toast.error(`Fix ${issues.length} contract issue${issues.length === 1 ? '' : 's'} before publishing`);
      return;
    }
    try {
      const saved = await saveContract({ ...draft, status: 'draft' });
      const published = await publishContract(saved.id);
      setSelectedId(published.id);
      toast.success('RoA module contract published');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish RoA module contract');
    }
  };

  const handleArchive = async () => {
    if (!draft) return;
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
      <Card>
        <CardContent className="py-10 text-center">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Super admin access required</p>
          <p className="text-sm text-muted-foreground">RoA module contracts are system-level configuration.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card><CardContent className="h-96 animate-pulse bg-muted/30" /></Card>
        <Card><CardContent className="h-96 animate-pulse bg-muted/30" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">RoA Module Contracts</h2>
          <p className="text-sm text-muted-foreground">
            Configure the module schemas advisers use when drafting Records of Advice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={!draft || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={handlePublish} disabled={!draft || isSaving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Contracts</div>
            <div className="text-2xl font-semibold">{visibleContracts.length}</div>
            {filtersActive && (
              <div className="mt-2 text-xs text-muted-foreground">
                Showing {filteredContracts.length} filtered
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Schema Version</div>
            <div className="text-2xl font-semibold">{schemaFormat?.schemaVersion || '1.0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Active modules</div>
            <div className="text-2xl font-semibold">{visibleContracts.filter((contract) => contract.status === 'active').length}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Flagship {flagshipCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader className="space-y-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Contracts
            </CardTitle>
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
                <Select value={listStatus} onValueChange={(value) => setListStatus(value as typeof listStatus)}>
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
                <Select value={listFlagship} onValueChange={(value) => setListFlagship(value as typeof listFlagship)}>
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
                The open contract (&quot;{draft.title}&quot;) is hidden by filters. Clear search or widen filters to see it in this list.
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
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{contract.id}</div>
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
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid grid-cols-3 lg:grid-cols-7">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="document">Document</TabsTrigger>
              <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <BasicEditor draft={draft} updateDraft={updateDraft} />
            </TabsContent>

            <TabsContent value="fields">
              <FieldsEditor draft={draft} updateDraft={updateDraft} schemaFormat={schemaFormat} />
            </TabsContent>

            <TabsContent value="evidence">
              <EvidenceEditor draft={draft} updateDraft={updateDraft} schemaFormat={schemaFormat} />
            </TabsContent>

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
                  <Button variant="outline" onClick={handleJsonApply}>Apply JSON</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview">
              <PreviewPanel draft={draft} />
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Select a contract to edit.</CardContent>
          </Card>
        )}
      </div>

      {draft && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleArchive} disabled={isSaving || draft.status === 'archived'}>
            <Archive className="h-4 w-4 mr-2" />
            Archive Contract
          </Button>
        </div>
      )}
    </div>
  );
}

function BasicEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contract-title">Title</Label>
          <Input
            id="contract-title"
            value={draft.title}
            onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-id">Module ID</Label>
          <Input
            id="contract-id"
            value={draft.id}
            onChange={(event) => updateDraft((current) => ({ ...current, id: toId(event.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-category">Category</Label>
          <Input
            id="contract-category"
            value={draft.category}
            onChange={(event) => updateDraft((current) => ({ ...current, category: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) => updateDraft((current) => ({ ...current, status: value as RoAModuleContract['status'] }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="contract-description">Description</Label>
          <Textarea
            id="contract-description"
            value={draft.description}
            onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
            className="min-h-[90px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-schema-version">Contract schema version</Label>
          <Input
            id="contract-schema-version"
            value={draft.schemaVersion}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                schemaVersion: event.target.value.trim() || '1.0',
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Checkbox
              id="contract-flagship"
              checked={draft.metadata?.flagshipModule === true}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                updateDraft((current) => ({
                  ...current,
                  metadata: { ...(current.metadata || {}), flagshipModule: checked === true },
                }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="contract-flagship" className="cursor-pointer font-medium leading-none">
                Flagship module
              </Label>
              <p className="text-xs text-muted-foreground">
                Surfaces first in the adviser RoA library with a flagship badge during module selection.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
            <Checkbox
              id="contract-replacement-compile"
              checked={draft.compilerHints?.includeReplacementAnalysis === true}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                updateDraft((current) => ({
                  ...current,
                  compilerHints: checked === true ? { includeReplacementAnalysis: true } : undefined,
                }))
              }
            />
            <div className="space-y-1">
              <Label htmlFor="contract-replacement-compile" className="cursor-pointer font-medium leading-none">
                Include replacement-analysis section when compiling
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds a heightened-care replacement narrative to the canonical RoA when this module participates in a compilation.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="normalized-key">Normalized Output Key</Label>
          <Input
            id="normalized-key"
            value={draft.output.normalizedKey}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              output: { ...current.output, normalizedKey: event.target.value },
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Gathering Methods</Label>
          <Input
            value={draft.input.gatheringMethods.join(', ')}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              input: {
                ...current.input,
                gatheringMethods: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) as RoAModuleContract['input']['gatheringMethods'],
              },
            }))}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FieldsEditor({
  draft,
  updateDraft,
  schemaFormat,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
  schemaFormat?: { allowedFieldTypes: RoAContractFieldType[]; allowedSourceTypes: RoAContractSourceType[] };
}) {
  const addSection = () => updateDraft((current) => ({
    ...current,
    formSchema: {
      sections: [
        ...current.formSchema.sections,
        { id: `section_${current.formSchema.sections.length + 1}`, title: 'New Section', fields: [] },
      ],
    },
  }));

  const addField = (sectionIndex: number) => updateDraft((current) => {
    const sections = [...current.formSchema.sections];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      fields: [
        ...sections[sectionIndex].fields,
        { key: `field_${sections[sectionIndex].fields.length + 1}`, label: 'New Field', type: 'text', source: 'moduleInput' },
      ],
    };
    return { ...current, formSchema: { sections } };
  });

  const updateSection = (sectionIndex: number, patch: Partial<ContractSection>) => updateDraft((current) => {
    const sections = [...current.formSchema.sections];
    sections[sectionIndex] = { ...sections[sectionIndex], ...patch };
    return { ...current, formSchema: { sections } };
  });

  const updateField = (sectionIndex: number, fieldIndex: number, patch: Partial<ContractField>) => updateDraft((current) => {
    const sections = [...current.formSchema.sections];
    const fields = [...sections[sectionIndex].fields];
    fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
    sections[sectionIndex] = { ...sections[sectionIndex], fields };
    const requiredFields = sections.flatMap((section) => section.fields.filter((field) => field.required).map((field) => field.key));
    return { ...current, formSchema: { sections }, validation: { ...current.validation, requiredFields } };
  });

  const removeField = (sectionIndex: number, fieldIndex: number) => updateDraft((current) => {
    const sections = [...current.formSchema.sections];
    const fields = sections[sectionIndex].fields.filter((_, index) => index !== fieldIndex);
    sections[sectionIndex] = { ...sections[sectionIndex], fields };
    return { ...current, formSchema: { sections } };
  });

  return (
    <div className="space-y-4">
      {draft.formSchema.sections.map((section, sectionIndex) => (
        <Card key={`${section.id}-${sectionIndex}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => addField(sectionIndex)}>
                <Plus className="h-4 w-4 mr-2" />
                Field
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={section.id} onChange={(event) => updateSection(sectionIndex, { id: toId(event.target.value) })} />
              <Input value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} />
            </div>
            <Separator />
            {section.fields.map((field, fieldIndex) => (
              <div key={`${field.key}-${fieldIndex}`} className="rounded-md border p-3">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Key</Label>
                    <Input value={field.key} onChange={(event) => updateField(sectionIndex, fieldIndex, { key: toId(event.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input value={field.label} onChange={(event) => updateField(sectionIndex, fieldIndex, { label: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={field.type} onValueChange={(value) => updateField(sectionIndex, fieldIndex, { type: value as RoAContractFieldType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(schemaFormat?.allowedFieldTypes || ['text']).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select value={field.source} onValueChange={(value) => updateField(sectionIndex, fieldIndex, { source: value as RoAContractSourceType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(schemaFormat?.allowedSourceTypes || ['moduleInput']).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    placeholder="Options, comma separated"
                    value={field.options?.join(', ') || ''}
                    onChange={(event) => updateField(sectionIndex, fieldIndex, {
                      options: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                    })}
                  />
                  <Input
                    placeholder="Placeholder"
                    value={field.placeholder || ''}
                    onChange={(event) => updateField(sectionIndex, fieldIndex, { placeholder: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant={field.required ? 'default' : 'outline'}
                    onClick={() => updateField(sectionIndex, fieldIndex, { required: !field.required })}
                  >
                    Required
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeField(sectionIndex, fieldIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addSection}>
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}

function EvidenceEditor({
  draft,
  updateDraft,
  schemaFormat,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
  schemaFormat?: { allowedEvidenceTypes: EvidenceRequirement['type'][] };
}) {
  const updateEvidence = (index: number, patch: Partial<EvidenceRequirement>) => updateDraft((current) => {
    const requirements = [...current.evidence.requirements];
    requirements[index] = { ...requirements[index], ...patch };
    return { ...current, evidence: { requirements } };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Evidence Requirements</CardTitle>
          <Button variant="outline" size="sm" onClick={() => updateDraft((current) => ({
            ...current,
            evidence: {
              requirements: [
                ...current.evidence.requirements,
                { id: `evidence_${current.evidence.requirements.length + 1}`, label: 'New Evidence', type: 'other', required: false },
              ],
            },
          }))}>
            <Plus className="h-4 w-4 mr-2" />
            Evidence
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.evidence.requirements.map((item, index) => (
          <div key={`${item.id}-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_160px_auto_auto]">
            <Input value={item.id} onChange={(event) => updateEvidence(index, { id: toId(event.target.value) })} />
            <Input value={item.label} onChange={(event) => updateEvidence(index, { label: event.target.value })} />
            <Select value={item.type} onValueChange={(value) => updateEvidence(index, { type: value as EvidenceRequirement['type'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(schemaFormat?.allowedEvidenceTypes || ['other']).map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant={item.required ? 'default' : 'outline'} onClick={() => updateEvidence(index, { required: !item.required })}>Required</Button>
            <Button variant="ghost" size="icon" onClick={() => updateDraft((current) => ({
              ...current,
              evidence: { requirements: current.evidence.requirements.filter((_, itemIndex) => itemIndex !== index) },
            }))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DocumentEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  const textareaRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>({});
  const tokenOptions = React.useMemo(() => getTemplateTokenOptions(draft), [draft]);
  const sampleContext = React.useMemo(() => getSampleTemplateContext(draft), [draft]);
  const templateIssues = React.useMemo(() => getTemplateIssues(draft), [draft]);

  const updateSection = (index: number, patch: Partial<DocumentSection>) => updateDraft((current) => {
    const documentSections = [...current.documentSections];
    documentSections[index] = { ...documentSections[index], ...patch };
    const compileOrder = [...documentSections]
      .sort((a, b) => a.order - b.order)
      .map((section) => section.id)
      .filter(Boolean);
    return {
      ...current,
      documentSections,
      compileOrder,
    };
  });

  const insertToken = (index: number, token: string) => {
    const textarea = textareaRefs.current[index];
    const current = draft.documentSections[index]?.template || '';
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    updateSection(index, { template: next });
    window.setTimeout(() => {
      textarea?.focus();
      const cursor = start + token.length;
      textarea?.setSelectionRange(cursor, cursor);
    }, 0);
  };

  return (
    <div className="space-y-4">
      {templateIssues.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Publish checks</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {templateIssues.slice(0, 6).map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Document Sections</CardTitle>
            <Button variant="outline" size="sm" onClick={() => updateDraft((current) => ({
              ...current,
              documentSections: [
                ...current.documentSections,
                {
                  id: `section_${current.documentSections.length + 1}`,
                  title: 'New Section',
                  purpose: '',
                  order: (current.documentSections.length + 1) * 10,
                  required: true,
                  template: '## New Section\n{{module.rationale}}',
                },
              ],
            }))}>
              <Plus className="h-4 w-4 mr-2" />
              Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-medium">Common tokens</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOKEN_EXAMPLES.map((token) => (
                <code key={token} className="rounded border bg-background px-2 py-1 text-xs">{token}</code>
              ))}
            </div>
          </div>
        {draft.documentSections.map((section, index) => (
          <div key={`${section.id}-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[120px_1fr_1fr_auto_auto]">
            <Input type="number" value={section.order} onChange={(event) => updateSection(index, { order: Number(event.target.value) })} />
            <Input value={section.id} onChange={(event) => updateSection(index, { id: toId(event.target.value) })} />
            <Input value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} />
            <Button variant={section.required ? 'default' : 'outline'} onClick={() => updateSection(index, { required: !section.required })}>Required</Button>
            <Button variant="ghost" size="icon" onClick={() => updateDraft((current) => ({
              ...current,
              documentSections: current.documentSections.filter((_, itemIndex) => itemIndex !== index),
            }))}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Textarea
              value={section.purpose}
              onChange={(event) => updateSection(index, { purpose: event.target.value })}
              className="md:col-span-5 min-h-[70px]"
            />
            <div className="space-y-2 md:col-span-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <Label>Output Template</Label>
                <TokenPicker tokens={tokenOptions} onInsert={(token) => insertToken(index, token)} />
              </div>
              <Textarea
                ref={(node) => { textareaRefs.current[index] = node; }}
                value={section.template}
                onChange={(event) => updateSection(index, { template: event.target.value })}
                className="min-h-[180px] font-mono text-xs"
                placeholder="Use safe tokens like {{client.displayName}} and {{module.rationale}}"
              />
            </div>
            <div className="space-y-2 md:col-span-5">
              <Label>Live Preview</Label>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">
                {renderRuntimeTemplate(section.template || section.purpose, sampleContext)}
              </pre>
            </div>
          </div>
        ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TokenPicker({
  tokens,
  onInsert,
}: {
  tokens: TemplateTokenOption[];
  onInsert: (token: string) => void;
}) {
  const [group, setGroup] = React.useState<string>('Client');
  const groups = React.useMemo(() => Array.from(new Set(tokens.map((token) => token.group))), [tokens]);
  const visibleTokens = tokens.filter((token) => token.group === group);

  React.useEffect(() => {
    if (!groups.includes(group) && groups.length > 0) setGroup(groups[0]);
  }, [group, groups]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={group} onValueChange={setGroup}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex max-w-full flex-wrap gap-1">
        {visibleTokens.slice(0, 8).map((option) => (
          <Button
            key={option.token}
            type="button"
            variant="outline"
            size="sm"
            title={option.description}
            onClick={() => onInsert(option.token)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DisclosuresEditor({
  draft,
  updateDraft,
}: {
  draft: RoAModuleContract;
  updateDraft: (updater: (current: RoAModuleContract) => RoAModuleContract) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Disclosures and Validation</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Disclosures</Label>
          <Textarea
            value={arrayToLines(draft.disclosures)}
            onChange={(event) => updateDraft((current) => ({ ...current, disclosures: linesToArray(event.target.value) }))}
            className="min-h-[240px]"
          />
        </div>
        <div className="space-y-2">
          <Label>Compile Order</Label>
          <Textarea
            value={arrayToLines(draft.compileOrder)}
            onChange={(event) => updateDraft((current) => ({ ...current, compileOrder: linesToArray(event.target.value) }))}
            className="min-h-[240px]"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Blocking and Warning Rules</Label>
          <Textarea
            value={draft.validation.rules.map((rule) => `${rule.id}|${rule.severity}|${rule.message}`).join('\n')}
            onChange={(event) => updateDraft((current) => ({
              ...current,
              validation: {
                ...current.validation,
                rules: linesToArray(event.target.value).map((line) => {
                  const [id, severity, ...messageParts] = line.split('|');
                  return {
                    id: toId(id || 'rule'),
                    severity: severity === 'blocking' ? 'blocking' : 'warning',
                    message: messageParts.join('|') || '',
                  };
                }),
              },
            }))}
            className="min-h-[180px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewPanel({ draft }: { draft: RoAModuleContract }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Adviser Module Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{draft.title}</h3>
            {getStatusBadge(draft)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>
        </div>
        {draft.formSchema.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <h4 className="font-medium">{section.title}</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{field.label}</span>
                    {field.required && <Badge variant="outline">Required</Badge>}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{field.type} from {field.source}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Separator />
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium">Required Fields</div>
            <div className="text-2xl font-semibold">{getRequiredFieldCount(draft)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Required Evidence</div>
            <div className="text-2xl font-semibold">{getEvidenceCount(draft)}</div>
          </div>
          <div>
            <div className="text-sm font-medium">Document Sections</div>
            <div className="text-2xl font-semibold">{draft.documentSections.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
