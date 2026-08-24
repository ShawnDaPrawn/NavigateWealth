/**
 * Pure render helpers for the RoA review step: compiled sections/modules,
 * recommendation summaries, the compliance snapshot, generated documents,
 * and the audit trail. Bodies moved verbatim from RoAStepReview.tsx
 * (component-scope closures became module exports; renderGeneratedDocuments
 * takes its download handler as a parameter).
 */
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Clock, Download, FileCheck, Shield } from 'lucide-react';
import type { RoAModule } from '../DraftRoAInterface';
import type {
  RoAAuditEvent,
  RoACompiledModule,
  RoACompiledSection,
  RoADraft,
  RoAGeneratedDocument,
  RoARecommendationSummary,
} from '../../types';

export const displayText = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.map(displayText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export const renderContentLines = (content: string) => (
  <div className="space-y-2">
    {content
      .split('\n')
      .filter(Boolean)
      .map((line, index) => {
        const cleaned = line.replace(/^[-#]\s*/, '').trim();
        if (!cleaned) return null;
        return (
          <p key={`${cleaned}-${index}`} className="text-sm leading-relaxed text-muted-foreground">
            {cleaned}
          </p>
        );
      })}
  </div>
);

export const renderCompiledSection = (section: RoACompiledSection, index: number) => (
  <div key={section.id} className="rounded-lg border p-4">
    <div className="mb-3 flex items-center gap-2">
      <Badge variant="outline">{String(index + 1).padStart(2, '0')}</Badge>
      <h3 className="font-semibold">{section.title}</h3>
    </div>
    {renderContentLines(section.content)}
  </div>
);

export const renderRecommendationSummary = (recommendations: RoARecommendationSummary[]) => {
  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-700" />
        <h3 className="font-semibold">Recommendation Summary</h3>
      </div>
      <div className="space-y-3">
        {recommendations.map((recommendation) => (
          <div key={recommendation.moduleId} className="rounded-md bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{recommendation.title}</p>
              <Badge variant="secondary">{recommendation.category}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{recommendation.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const renderCompiledModule = (module: RoACompiledModule) => (
  <div key={module.moduleId} className="rounded-lg border p-4">
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="font-semibold">{module.title}</h3>
        <p className="text-xs text-muted-foreground">
          {module.category} | Contract v{module.contractVersion} |{' '}
          {module.normalizedKey || module.moduleId}
        </p>
      </div>
      <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
        Compiled
      </Badge>
    </div>

    <p className="mb-4 text-sm text-muted-foreground">{module.summary}</p>

    {module.outputValues.length > 0 && (
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        {module.outputValues.map((item) => (
          <div key={`${module.moduleId}-${item.label}`} className="rounded-md bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    )}

    <div className="space-y-3">
      {module.sections.map((section, index) => (
        <div
          key={`${module.moduleId}-${section.id}`}
          className="rounded-md border bg-background p-3"
        >
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{index + 1}</Badge>
            <p className="font-medium">{section.title}</p>
          </div>
          {renderContentLines(section.content)}
        </div>
      ))}
    </div>

    {module.evidence.length > 0 && (
      <div className="mt-4 rounded-md bg-muted/20 p-3">
        <p className="text-sm font-medium">Evidence</p>
        <div className="mt-2 space-y-1">
          {module.evidence.map((item) => (
            <div
              key={`${module.moduleId}-${item.fileName}`}
              className="text-xs text-muted-foreground"
            >
              <p>
                {item.label}: {item.fileName}
              </p>
              <p>
                {item.source || 'source not recorded'}
                {item.sha256 ? ` | SHA-256 ${item.sha256.slice(0, 12)}...` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export const renderComplianceSnapshot = (compilation: NonNullable<RoADraft['compiledOutput']>) => {
  const ctrl = compilation.documentControl;
  if (!ctrl || typeof ctrl !== 'object') return null;
  const contractVersions = (ctrl as Record<string, unknown>).moduleContractVersions;
  const schemaVersions = (ctrl as Record<string, unknown>).moduleContractSchemaVersions;
  if (!contractVersions || typeof contractVersions !== 'object') return null;

  const titleById = new Map(compilation.modules.map((m) => [m.moduleId, m.title]));
  const schemaMap =
    schemaVersions && typeof schemaVersions === 'object'
      ? (schemaVersions as Record<string, unknown>)
      : {};

  const rows = Object.entries(contractVersions as Record<string, unknown>);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-muted bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Compliance snapshot (module contracts)</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Contract revision and schema version captured at compile time for traceability. This mirrors
        document control embedded in the canonical RoA.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              <th className="px-3 py-2 font-medium">Contract ID</th>
              <th className="px-3 py-2 font-medium">Version</th>
              <th className="px-3 py-2 font-medium">Schema</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([moduleId, version]) => (
              <tr key={moduleId} className="border-t">
                <td className="px-3 py-2">{titleById.get(moduleId) || moduleId}</td>
                <td className="px-3 py-2 font-mono text-xs">{moduleId}</td>
                <td className="px-3 py-2">{String(version)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {String(schemaMap[moduleId] ?? '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const renderGeneratedDocuments = (
  documents: RoAGeneratedDocument[] = [],
  onDownload: (document: RoAGeneratedDocument) => Promise<void> = async () => {},
) => {
  if (documents.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Generated Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents
          .slice()
          .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
          .map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{document.fileName}</p>
                  <Badge variant={document.documentStatus === 'final' ? 'default' : 'secondary'}>
                    {document.documentStatus === 'final' ? 'Final' : 'Draft'}
                  </Badge>
                  <Badge variant="outline">{document.format.toUpperCase()}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generated {new Date(document.generatedAt).toLocaleString()} | SHA-256{' '}
                  {document.sha256.slice(0, 12)}...
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onDownload(document)}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
};

export const renderAuditTrail = (events: RoAAuditEvent[] = []) => {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          RoA Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {events
          .slice(-16)
          .reverse()
          .map((event) => (
            <div key={event.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{event.summary}</p>
                <Badge variant="outline">{event.action.replace(/_/g, ' ')}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()} | User {event.createdBy}
              </p>
              {event.details && Object.keys(event.details).length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Event details
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
};

export function isConversationModule(module: RoAModule | undefined): boolean {
  return (module?.authoringMode ?? 'conversation') !== 'form';
}
