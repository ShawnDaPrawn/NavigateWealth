import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Play,
  ArrowLeft,
  FileText,
  Clock,
  ListChecks,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../utils/api';

import {
  parseFormJson,
  type AssessmentTemplate,
  type AssessmentResult,
  type FormField,
} from './riskAssessment/riskAssessmentModel';
import { getOutcomeBadge } from './riskAssessment/riskAssessmentPresentation';
import { FormFieldRenderer } from './riskAssessment/FormFieldRenderer';
import { ScreeningResultsDetail } from './riskAssessment/ScreeningResultsDetail';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskAssessmentPanelProps {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
}

type PanelView = 'list' | 'form' | 'result';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function RiskAssessmentPanel({
  clientId,
  clientFirstName,
  clientLastName,
  idNumber,
  passport,
  hasIdentification,
}: RiskAssessmentPanelProps) {
  // View management
  const [view, setView] = useState<PanelView>('list');

  // Templates
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Active form
  const [activeTemplate, setActiveTemplate] = useState<AssessmentTemplate | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // History
  const [history, setHistory] = useState<AssessmentResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // Active result after submission
  const [activeResult, setActiveResult] = useState<AssessmentResult | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const data = await api.get<{ templates?: AssessmentTemplate[] }>(
        '/integrations/honeycomb/assessments/templates',
      );
      setTemplates(data.templates || []);
    } catch (e: unknown) {
      console.error('[RiskAssessmentPanel] Template fetch error:', e);
      setTemplatesError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<{ assessments?: AssessmentResult[] }>(
        `/integrations/honeycomb/assessments/history/${clientId}`,
      );
      setHistory(data.assessments || []);
    } catch (e) {
      console.error('[RiskAssessmentPanel] History fetch error:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchTemplates();
    fetchHistory();
  }, [fetchTemplates, fetchHistory]);

  // ─── Form Actions ────────────────────────────────────────────────────────

  const startAssessment = (template: AssessmentTemplate) => {
    const fields = parseFormJson(template.formJson);
    setActiveTemplate(template);
    setFormFields(fields);

    // Initialise values with defaults
    const defaults: Record<string, string> = {};
    for (const f of fields) {
      if (f.defaultValue) defaults[f.id] = f.defaultValue;
    }
    setFormValues(defaults);
    setView('form');
  };

  const updateField = (fieldId: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const submitAssessment = async () => {
    if (!activeTemplate) return;

    // Basic validation — check required fields
    const missingRequired = formFields
      .filter((f) => f.required && f.type !== 'section')
      .filter((f) => !formValues[f.id]?.trim());

    if (missingRequired.length > 0) {
      toast.error(`Please complete all required fields (${missingRequired.length} remaining)`);
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(`Running ${activeTemplate.assessmentName}...`);

    try {
      // Build the submission string — the answers collected from the form
      const submissionPayload = JSON.stringify({
        answers: formValues,
        completedAt: new Date().toISOString(),
        templateId: activeTemplate.id,
        templateVersion: activeTemplate.version,
      });

      const data = await api.post<{ data?: AssessmentResult }>(
        '/integrations/honeycomb/assessments/run',
        {
          clientId,
          assessmentId: activeTemplate.id,
          assessmentName: activeTemplate.assessmentName,
          firstName: clientFirstName,
          lastName: clientLastName,
          idNumber,
          passport,
          submission: submissionPayload,
        },
      );

      toast.success('Assessment completed successfully!', { id: toastId });

      // Switch to result view
      if (data.data) {
        setActiveResult(data.data);
        setView('result');
      }

      // Refresh history in background
      fetchHistory();
    } catch (e: unknown) {
      console.error('[RiskAssessmentPanel] Submit error:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to submit assessment', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setView('list');
    setActiveTemplate(null);
    setActiveResult(null);
    setFormFields([]);
    setFormValues({});
  };

  // ─── Computed ────────────────────────────────────────────────────────────

  const completionPercent = useMemo(() => {
    const fillable = formFields.filter((f) => f.type !== 'section');
    if (fillable.length === 0) return 100;
    const filled = fillable.filter((f) => formValues[f.id]?.trim()).length;
    return Math.round((filled / fillable.length) * 100);
  }, [formFields, formValues]);

  // ─── Render: Template List ───────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Templates Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1.5 rounded-md">
                  <ClipboardList className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Risk Assessments</CardTitle>
                  <CardDescription className="text-xs">
                    Select a due diligence assessment to run against this client
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTemplates}
                disabled={templatesLoading}
                className="h-8"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 mr-1 ${templatesLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templatesLoading && templates.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading templates from Honeycomb...
                </span>
              </div>
            ) : templatesError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Failed to load assessment templates
                  </p>
                  <p className="text-xs text-red-600 mt-1">{templatesError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={fetchTemplates}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-lg">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-muted-foreground">
                  No assessment templates available from Honeycomb.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Templates are configured in the Beeswax platform and pulled automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((tpl) => {
                  const fieldCount = parseFormJson(tpl.formJson).filter(
                    (f) => f.type !== 'section',
                  ).length;
                  return (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all group"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0 mt-0.5">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {tpl.assessmentName}
                          </p>
                          {tpl.assessmentDescription && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {tpl.assessmentDescription}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50">
                              {tpl.matterType}
                            </Badge>
                            {tpl.version && (
                              <span className="text-[10px] text-gray-400">v{tpl.version}</span>
                            )}
                            {fieldCount > 0 && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <ListChecks className="h-3 w-3" />
                                {fieldCount} questions
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(tpl.updated_at || tpl.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 ml-3 flex-shrink-0"
                        disabled={!hasIdentification}
                        onClick={() => startAssessment(tpl)}
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Start
                      </Button>
                    </div>
                  );
                })}
                {!hasIdentification && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    Client must have a valid SA ID number or passport to run assessments.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                Assessment History
                {history.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {history.length}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHistory}
                disabled={historyLoading}
                className="h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${historyLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading && history.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-muted-foreground">
                  No assessments have been completed for this client yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((result) => (
                  <div key={result.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setExpandedResultId(expandedResultId === result.id ? null : result.id)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-purple-100 p-1.5 rounded-md flex-shrink-0">
                          <ClipboardList className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {result.assessmentName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(result.submittedAt).toLocaleString()}
                            {result.matterId && (
                              <span className="ml-2 font-mono text-[10px] bg-gray-100 px-1 rounded">
                                Matter: {result.matterId.substring(0, 8)}...
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getOutcomeBadge(result.screeningOutcome)}
                        {expandedResultId === result.id ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {expandedResultId === result.id && <ScreeningResultsDetail result={result} />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Assessment Form ─────────────────────────────────────────────

  if (view === 'form' && activeTemplate) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {activeTemplate.assessmentName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Complete the assessment below, then submit for screening.
            </p>
          </div>
          <Badge variant="outline" className="flex-shrink-0">
            {completionPercent}% Complete
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        {/* Form Fields */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {formFields.length === 0 ? (
              <div className="text-center py-8">
                <Info className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-muted-foreground">
                  This assessment template has no structured form fields.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The assessment will be submitted directly with your client's information for bulk
                  screening.
                </p>
              </div>
            ) : (
              formFields.map((field) => (
                <FormFieldRenderer
                  key={field.id}
                  field={field}
                  value={formValues[field.id] || ''}
                  onChange={(v) => updateField(field.id, v)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={goBack} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={submitAssessment}
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {submitting ? (
              <div className="contents">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </div>
            ) : (
              <div className="contents">
                <CheckCircle className="mr-2 h-4 w-4" />
                Submit Assessment
              </div>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: Result View ─────────────────────────────────────────────────

  if (view === 'result' && activeResult) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">Assessment Results</h3>
            <p className="text-xs text-muted-foreground">
              {activeResult.assessmentName} — Submitted{' '}
              {new Date(activeResult.submittedAt).toLocaleString()}
            </p>
          </div>
          {getOutcomeBadge(activeResult.screeningOutcome)}
        </div>

        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Assessment Completed Successfully</p>
            <p className="text-xs text-green-700 mt-0.5">
              The assessment has been submitted and screening results are below.
              {activeResult.matterId && (
                <span className="block mt-1">
                  Matter ID:{' '}
                  <code className="bg-green-100 px-1 rounded text-[10px] font-mono">
                    {activeResult.matterId}
                  </code>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Screening Results */}
        <ScreeningResultsDetail result={activeResult} expanded />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assessments
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (activeTemplate) startAssessment(activeTemplate);
            }}
            disabled={!activeTemplate}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Run Again
          </Button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
