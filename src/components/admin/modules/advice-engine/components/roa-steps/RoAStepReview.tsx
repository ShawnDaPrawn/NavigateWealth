import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Textarea } from '../../../../../ui/textarea';
import { Label } from '../../../../../ui/label';
import { Separator } from '../../../../../ui/separator';
import { ScrollArea } from '../../../../../ui/scroll-area';
import { Checkbox } from '../../../../../ui/checkbox';
import { RoADraft } from '../DraftRoAInterface';
import { getModuleSchema } from '../../roaModuleSchemas';
import { useClient } from '../../hooks/useClient';
import { 
  FileText, 
  Download, 
  Edit, 
  CheckCircle, 
  AlertTriangle,
  User,
  Calendar,
  Shield,
  Printer
} from 'lucide-react';

interface RoAStepReviewProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
}

export function RoAStepReview({ draft, onUpdate }: RoAStepReviewProps) {
  const [editableContent, setEditableContent] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Fetch client details from backend when a clientId is set (Guidelines §6)
  const { data: fetchedClient } = useClient(draft?.clientId ?? undefined);

  if (!draft) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
        <p className="text-muted-foreground">No draft available</p>
      </div>
    );
  }

  // Get client information — prefer fetched server data, fall back to inline draft data
  const clientName = (() => {
    if (draft.clientId && fetchedClient) {
      return `${fetchedClient.first_name} ${fetchedClient.last_name}`;
    }
    if (draft.clientData) {
      return `${draft.clientData.firstName} ${draft.clientData.lastName}`;
    }
    return 'Unknown Client';
  })();

  // Check completion status
  const allModulesComplete = draft.selectedModules.every(moduleId => {
    const module = getModuleSchema(moduleId);
    if (!module) return false;
    
    const moduleData = draft.moduleData[moduleId] || {};
    const requiredFields = module.fields.filter(f => f.required);
    return requiredFields.every(f => 
      moduleData[f.key] && moduleData[f.key].toString().trim() !== ''
    );
  });

  const handleContentEdit = (section: string, content: string) => {
    setEditableContent(prev => ({
      ...prev,
      [section]: content
    }));
  };

  const generateDocuments = async (format: 'docx' | 'pdf' | 'both') => {
    setIsGenerating(true);
    
    // Mock generation process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock download trigger
    const fileName = `RoA_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}_v${draft.version}`;
    // logger.info(`Generating ${format} document: ${fileName}`);
    
    setIsGenerating(false);
    
    // Update draft status
    onUpdate({ status: 'complete' });
  };

  const renderModulePreview = (moduleId: string) => {
    const module = getModuleSchema(moduleId);
    const moduleData = draft.moduleData[moduleId] || {};
    
    if (!module) return null;

    return (
      <Card key={moduleId} className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{module.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Module content preview */}
          <div className="space-y-3">
            {module.fields.map(field => {
              const value = moduleData[field.key];
              if (!value) return null;

              return (
                <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Label className="font-medium text-sm">{field.label}:</Label>
                  <div className="md:col-span-2">
                    {field.type === 'textarea' ? (
                      <div className="relative">
                        <Textarea
                          value={editableContent[`${moduleId}_${field.key}`] || value}
                          onChange={(e) => handleContentEdit(`${moduleId}_${field.key}`, e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1"
                          onClick={() => {
                            const content = editableContent[`${moduleId}_${field.key}`] || value;
                            onUpdate({
                              moduleData: {
                                ...draft.moduleData,
                                [moduleId]: {
                                  ...draft.moduleData[moduleId],
                                  [field.key]: content
                                }
                              }
                            });
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm bg-muted/30 p-2 rounded">
                        {Array.isArray(value) ? value.join(', ') : value.toString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclosures */}
          {module.disclosures.length > 0 && (
            <div className="space-y-2">
              <Label className="font-medium">Regulatory Disclosures:</Label>
              <div className="bg-muted/30 p-3 rounded-lg space-y-1">
                {module.disclosures.map((disclosure, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    • {disclosure}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-2">Review & Compile</h2>
          <p className="text-muted-foreground">
            Review your Record of Advice and generate the final documents
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allModulesComplete ? (
            <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready to Generate
            </Badge>
          ) : (
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Incomplete Modules
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Card */}
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
              <p className="text-sm">{allModulesComplete ? 'Complete' : 'In Progress'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Preview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Review and edit content before final generation. Click the edit icon to modify text sections.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {/* Cover Page */}
              <div className="text-center space-y-2 pb-6 border-b">
                <h1 className="text-2xl font-bold">RECORD OF ADVICE</h1>
                <p className="text-lg">{clientName}</p>
                <p className="text-sm text-muted-foreground">
                  Prepared by Navigate Wealth | {new Date().toLocaleDateString()}
                </p>
              </div>

              {/* Executive Summary */}
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Executive Summary</h2>
                <div className="relative">
                  <Textarea
                    value={editableContent['executive_summary'] || `This Record of Advice outlines our recommendations for ${clientName} across ${draft.selectedModules.length} key areas of financial planning. Our analysis takes into account your current financial position, risk profile, and stated objectives to provide tailored advice that aligns with your financial goals.`}
                    onChange={(e) => handleContentEdit('executive_summary', e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Module Sections */}
              {draft.selectedModules.map(renderModulePreview)}

              {/* Implementation & Next Steps */}
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Implementation & Next Steps</h2>
                <div className="relative">
                  <Textarea
                    value={editableContent['next_steps'] || 'Implementation of these recommendations should proceed in the priority order outlined above. We will assist with all necessary paperwork and coordinate with product providers to ensure smooth implementation. Regular reviews will be scheduled to monitor progress and make adjustments as needed.'}
                    onChange={(e) => handleContentEdit('next_steps', e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Client Acknowledgment */}
              <div className="space-y-3 border-t pt-6">
                <h2 className="text-xl font-semibold">Client Acknowledgment</h2>
                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <p className="text-sm">
                    I acknowledge that I have read and understood this Record of Advice and the recommendations contained herein.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label>Client Signature:</Label>
                      <div className="border-b border-dashed border-muted-foreground mt-2 h-8"></div>
                    </div>
                    <div>
                      <Label>Date:</Label>
                      <div className="border-b border-dashed border-muted-foreground mt-2 h-8"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Generate Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Completion Check */}
          {!allModulesComplete && (
            <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
              <p className="text-sm text-orange-700">
                Please complete all selected modules before generating documents. Incomplete modules will not be included in the final RoA.
              </p>
            </div>
          )}

          {/* Terms Acceptance */}
          <div className="flex items-start space-x-2">
            <Checkbox
              checked={hasAcceptedTerms}
              onCheckedChange={setHasAcceptedTerms}
            />
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                I confirm that all information is accurate and complete
              </Label>
              <p className="text-xs text-muted-foreground">
                This RoA will be saved to the client file and comply with FAIS requirements. 
                Documents will be watermarked as "DRAFT" until marked as final.
              </p>
            </div>
          </div>

          {/* Generation Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => generateDocuments('docx')}
              disabled={!allModulesComplete || !hasAcceptedTerms || isGenerating}
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
              disabled={!allModulesComplete || !hasAcceptedTerms || isGenerating}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => generateDocuments('both')}
              disabled={!allModulesComplete || !hasAcceptedTerms || isGenerating}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Both Formats
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Documents will be saved to the client file and available for download. 
            Naming convention: RoA_{clientName.replace(/\s+/g, '_')}_{new Date().toISOString().split('T')[0]}_v{draft.version}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}