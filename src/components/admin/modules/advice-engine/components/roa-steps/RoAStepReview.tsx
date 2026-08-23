import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Label } from '../../../../../ui/label';
import { ScrollArea } from '../../../../../ui/scroll-area';
import { Checkbox } from '../../../../../ui/checkbox';
import { RoADraft, RoAModule } from '../DraftRoAInterface';
import { useClient } from '../../hooks/useClient';
import { roaApi } from '../../api';
import { getFallbackRuntimeModule, getModuleRuntimeStatus } from '../../roaModuleRuntime';
import type { RoAGeneratedDocument } from '../../types';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  Lock,
  Printer,
  Shield,
  User,
  GitBranch,
} from 'lucide-react';

import {
  displayText,
  renderAuditTrail,
  renderComplianceSnapshot,
  renderCompiledModule,
  renderCompiledSection,
  renderGeneratedDocuments,
  renderRecommendationSummary,
  isConversationModule,
} from './roaReviewRender';
import { ModuleNarrativesEditor } from './ModuleNarrativesEditor';

interface RoAStepReviewProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
  onDraftReplaced?: (draft: RoADraft) => void;
  modules?: RoAModule[];
}

export function RoAStepReview({ draft, onUpdate, onDraftReplaced, modules }: RoAStepReviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasConfirmedAccuracy, setHasConfirmedAccuracy] = useState(false);
  const [hasReviewedCompilation, setHasReviewedCompilation] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    setHasConfirmedAccuracy(false);
    setHasReviewedCompilation(false);
  }, [draft?.id]);

  const { data: fetchedClient } = useClient(draft?.clientId ?? undefined);

  if (!draft) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
        <p className="text-muted-foreground">No draft available</p>
      </div>
    );
  }

  const clientName = (() => {
    if (draft.clientSnapshot?.displayName) {
      return draft.clientSnapshot.displayName;
    }
    if (draft.clientId && fetchedClient) {
      return `${fetchedClient.first_name} ${fetchedClient.last_name}`;
    }
    if (draft.clientData) {
      return `${draft.clientData.firstName} ${draft.clientData.lastName}`;
    }
    return 'Unknown Client';
  })();

  const allModulesComplete = draft.selectedModules.every((moduleId) => {
    const module =
      modules?.find((item) => item.id === moduleId) || getFallbackRuntimeModule(moduleId);
    if (!module) return false;
    // Conversation modules are complete when the backend marks the conversation
    // complete (they carry no form moduleData to score).
    if (isConversationModule(module)) {
      return draft.moduleConversationStatus?.[moduleId] === 'complete';
    }
    return getModuleRuntimeStatus(
      module,
      draft.moduleData[moduleId] || {},
      draft.moduleEvidence?.[moduleId] || {},
    ).complete;
  });
  const hasCompiledOutput = Boolean(draft.compiledOutput);
  const isLocked = Boolean(draft.lockedAt);

  const downloadBase64 = (base64: string, contentType: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `data:${contentType};base64,${base64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateDocuments = async (format: 'docx' | 'pdf' | 'both') => {
    setIsGenerating(true);
    try {
      const formats: Array<'docx' | 'pdf'> = format === 'both' ? ['pdf', 'docx'] : [format];
      const result = await roaApi.generateDraftDocuments(draft.id, formats);
      result.documents?.forEach((document) => {
        if (document.downloadBase64) {
          downloadBase64(document.downloadBase64, document.contentType, document.fileName);
        }
      });
      onUpdate(result.draft);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDocument = async (document: RoAGeneratedDocument) => {
    const storedDocument = document.downloadBase64
      ? document
      : await roaApi.downloadGeneratedDocument(document.id);

    if (storedDocument.downloadBase64) {
      downloadBase64(
        storedDocument.downloadBase64,
        storedDocument.contentType,
        storedDocument.fileName,
      );
    }
  };

  const validateAndCompile = async () => {
    setIsGenerating(true);
    try {
      const validationResult = await roaApi.validateDraft(draft.id);
      onUpdate(validationResult.draft);
      if (validationResult.validation?.valid) {
        const compileResult = await roaApi.compileDraft(draft.id);
        onUpdate(compileResult.draft);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const finaliseDraft = async () => {
    setIsGenerating(true);
    try {
      const finalised = await roaApi.finaliseDraft(draft.id);
      finalised.documents?.forEach((document) => {
        if (document.downloadBase64) {
          downloadBase64(document.downloadBase64, document.contentType, document.fileName);
        }
      });
      onUpdate(finalised.draft);
    } finally {
      setIsGenerating(false);
    }
  };

  const cloneEditableVersion = async () => {
    if (!onDraftReplaced) return;
    setIsCloning(true);
    try {
      const { draft: nextDraft } = await roaApi.cloneDraftFromFinal(draft.id);
      onDraftReplaced(nextDraft);
      toast.success(`Opened editable RoA version v${nextDraft.version}`);
    } catch (error) {
      console.error('Failed to branch RoA draft:', error);
      toast.error('Could not create an editable version from this final RoA.');
    } finally {
      setIsCloning(false);
    }
  };

  const renderCanonicalPreview = () => {
    const compilation = draft.compiledOutput;
    if (!compilation) {
      return (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Canonical RoA not compiled yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run Validate & Compile to build the final RoA structure from the client snapshot,
            adviser snapshot, completed module outputs and active module contracts.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Compilation</p>
              <p className="truncate text-sm font-medium">{compilation.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Generated</p>
              <p className="text-sm font-medium">
                {new Date(compilation.generatedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm font-medium">{compilation.status}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hash</p>
              <p className="truncate text-sm font-medium">{displayText(compilation.hash)}</p>
            </div>
          </div>
        </div>

        {renderComplianceSnapshot(compilation)}

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Compiled RoA Sections</h3>
          <div className="grid gap-3">
            {compilation.documentSections.map(renderCompiledSection)}
          </div>
        </div>

        {renderRecommendationSummary(compilation.recommendationSummary)}

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Compiled Module Sections</h3>
          {compilation.modules.map(renderCompiledModule)}
        </div>
      </div>
    );
  };

  const renderStatusBadge = () => {
    if (allModulesComplete && hasCompiledOutput) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready to Generate
        </Badge>
      );
    }

    if (allModulesComplete) {
      return (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          <Shield className="h-3 w-3 mr-1" />
          Ready to Compile
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Incomplete Modules
      </Badge>
    );
  };

  const statusLabel = isLocked
    ? 'Finalised and locked'
    : hasCompiledOutput
      ? 'Compiled'
      : allModulesComplete
        ? 'Complete - compile required'
        : 'In Progress';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Review & Compile</h2>
          <p className="text-muted-foreground">
            Review your Record of Advice and generate the final documents
          </p>
        </div>
        <div className="flex items-center gap-2">{renderStatusBadge()}</div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            RoA Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="font-medium">Client:</Label>
              <p className="text-sm">{clientName}</p>
              {fetchedClient && 'email' in fetchedClient && (
                <p className="text-xs text-muted-foreground">{fetchedClient.email}</p>
              )}
            </div>
            <div>
              <Label className="font-medium">Date:</Label>
              <p className="text-sm">{new Date().toLocaleDateString()}</p>
              <p className="text-xs text-muted-foreground">Version {draft.version}</p>
            </div>
            <div>
              <Label className="font-medium">Modules:</Label>
              <p className="text-sm">{draft.selectedModules.length} selected</p>
            </div>
            <div>
              <Label className="font-medium">Status:</Label>
              <p className="text-sm">{statusLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Preview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Review the canonical Record of Advice generated from the client snapshot, adviser
            details, module contracts and completed module outputs.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              <div className="text-center space-y-2 pb-6 border-b">
                <h1 className="text-2xl font-bold">RECORD OF ADVICE</h1>
                <p className="text-lg">{clientName}</p>
                <p className="text-sm text-muted-foreground">
                  Prepared by Navigate Wealth | {new Date().toLocaleDateString()}
                </p>
              </div>

              {renderCanonicalPreview()}

              <div className="space-y-3 border-t pt-6">
                <h2 className="text-xl font-semibold">Client Acknowledgment</h2>
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <p className="text-sm">
                    I acknowledge that I have read and understood this Record of Advice and the
                    recommendations contained herein.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label>Client Signature:</Label>
                      <div className="border-b border-dashed border-muted-foreground mt-2 h-8" />
                    </div>
                    <div>
                      <Label>Date:</Label>
                      <div className="border-b border-dashed border-muted-foreground mt-2 h-8" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ModuleNarrativesEditor draft={draft} onUpdate={onUpdate} modules={modules} />

      {renderGeneratedDocuments(draft.generatedDocuments, downloadDocument)}

      {renderAuditTrail(draft.auditEvents)}

      {draft.validationResults &&
        (!draft.validationResults.valid || draft.validationResults.warnings.length > 0) && (
          <Card
            className={
              draft.validationResults.valid
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                Validation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {draft.validationResults.blocking.map((issue) => (
                <p key={issue.id} className="text-red-700">
                  {issue.message}
                </p>
              ))}
              {draft.validationResults.warnings.map((issue) => (
                <p key={issue.id} className="text-yellow-800">
                  {issue.message}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Generate Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLocked && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 text-green-700" />
                  <p className="text-sm text-green-700">
                    This RoA is finalised and locked. Download the stored final documents above, or
                    create a new editable version for future advice changes.
                  </p>
                </div>
              </div>
              {onDraftReplaced && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isCloning}
                  onClick={() => cloneEditableVersion()}
                  className="w-full sm:w-auto"
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  {isCloning
                    ? 'Creating editable version…'
                    : `Create editable v${draft.version + 1}`}
                </Button>
              )}
            </div>
          )}

          {!allModulesComplete && (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-700">
                Please complete all selected modules before generating documents. Incomplete modules
                will not be included in the final RoA.
              </p>
            </div>
          )}

          {allModulesComplete && !hasCompiledOutput && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                Run Validate & Compile before final export so the adviser can review the canonical
                RoA structure.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <Checkbox
                checked={hasConfirmedAccuracy}
                onCheckedChange={(checked) => setHasConfirmedAccuracy(checked === true)}
              />
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  I confirm that all information is accurate and complete
                </Label>
                <p className="text-xs text-muted-foreground">
                  This RoA will be saved to the client file and must comply with FAIS requirements.
                  Documents will be watermarked as &quot;DRAFT&quot; until marked as final.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                checked={hasReviewedCompilation}
                onCheckedChange={(checked) => setHasReviewedCompilation(checked === true)}
                disabled={!hasCompiledOutput}
              />
              <div className="space-y-1">
                <Label
                  className={`text-sm font-medium ${!hasCompiledOutput ? 'text-muted-foreground' : ''}`}
                >
                  I have reviewed the compiled Record of Advice, validation results, and the module
                  contract compliance snapshot
                </Label>
                <p className="text-xs text-muted-foreground">
                  Includes compiled sections, recommendation summary, supporting evidence filenames,
                  disclosures, and the contract versions table above after you run Validate &amp;
                  Compile.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={validateAndCompile}
              disabled={isGenerating || isLocked}
              className="flex-1"
            >
              <Shield className="h-4 w-4 mr-2" />
              Validate & Compile
            </Button>

            <Button
              onClick={() => generateDocuments('docx')}
              disabled={
                !allModulesComplete ||
                !hasCompiledOutput ||
                !hasConfirmedAccuracy ||
                !hasReviewedCompilation ||
                isGenerating ||
                isLocked
              }
              className="flex-1"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Generating...
                </div>
              ) : (
                <div className="contents">
                  <Download className="h-4 w-4 mr-2" />
                  Generate DOCX
                </div>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => generateDocuments('pdf')}
              disabled={
                !allModulesComplete ||
                !hasCompiledOutput ||
                !hasConfirmedAccuracy ||
                !hasReviewedCompilation ||
                isGenerating ||
                isLocked
              }
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>

            <Button
              variant="secondary"
              onClick={() => generateDocuments('both')}
              disabled={
                !allModulesComplete ||
                !hasCompiledOutput ||
                !hasConfirmedAccuracy ||
                !hasReviewedCompilation ||
                isGenerating ||
                isLocked
              }
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Both Formats
            </Button>

            <Button
              variant="default"
              onClick={finaliseDraft}
              disabled={
                !allModulesComplete ||
                !hasCompiledOutput ||
                !hasConfirmedAccuracy ||
                !hasReviewedCompilation ||
                isGenerating ||
                isLocked
              }
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalise
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Documents will be saved to the client file and available for download. Naming
            convention: RoA_{clientName.replace(/\s+/g, '_')}_
            {new Date().toISOString().split('T')[0]}_v{draft.version}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Conversation-module narrative editor
// ============================================================================
