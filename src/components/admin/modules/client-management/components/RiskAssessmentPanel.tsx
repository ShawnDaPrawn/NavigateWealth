import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { RefreshCw, CheckCircle, Loader2, ArrowLeft, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../utils/api';

import {
  parseFormJson,
  type AssessmentTemplate,
  type AssessmentResult,
  type FormField,
} from './riskAssessment/riskAssessmentModel';
import { getOutcomeBadge } from './riskAssessment/riskAssessmentPresentation';
import { PanelCard, StatusPill } from './compliance/ComplianceShared';
import { outcomeTone } from './compliance/complianceTypes';
import { ErrorState, Notice } from '../../../layout/page';
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
    // The latest completed run of each template, for the templates table.
    const latestByTemplate = new Map<number, AssessmentResult>();
    for (const r of history) {
      const prev = latestByTemplate.get(r.assessmentId);
      if (!prev || new Date(r.submittedAt) > new Date(prev.submittedAt)) {
        latestByTemplate.set(r.assessmentId, r);
      }
    }
    const viewResult = (r: AssessmentResult) => {
      setActiveResult(r);
      setActiveTemplate(templates.find((t) => t.id === r.assessmentId) ?? null);
      setView('result');
    };
    const formatDay = (iso: string) =>
      new Date(iso).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

    return (
      <div className="space-y-4">
        {/* Design CM-K-Risk: the templates as a table with the last result of each. */}
        <PanelCard
          title="Assessment templates"
          aside={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchTemplates();
                void fetchHistory();
              }}
              disabled={templatesLoading || historyLoading}
            >
              Refresh
            </Button>
          }
        >
          {templatesLoading && templates.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-nw-text-3">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
              Loading templates…
            </div>
          ) : templatesError ? (
            <ErrorState
              title="Couldn't load the assessment templates"
              description="Something went wrong while loading. Nothing has changed."
              details={templatesError}
              onRetry={() => void fetchTemplates()}
            />
          ) : templates.length === 0 ? (
            <p className="py-2 text-sm text-nw-text-3">
              No assessment templates yet. Templates are configured in the Beeswax platform and
              pulled automatically.
            </p>
          ) : (
            <div className="space-y-3">
              {!hasIdentification && (
                <Notice kind="attention" title="No ID or passport number on file.">
                  Add one to the client&apos;s profile before running an assessment.
                </Notice>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                      <th scope="col" className="px-3 py-2.5">
                        Template
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Last completed
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Result
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => {
                      const latest = latestByTemplate.get(tpl.id);
                      return (
                        <tr key={tpl.id} className="border-t border-nw-line">
                          <td className="px-3 py-3">
                            <p className="text-nw-ink">{tpl.assessmentName}</p>
                            {tpl.assessmentDescription && (
                              <p className="mt-0.5 line-clamp-1 text-xs text-nw-text-3">
                                {tpl.assessmentDescription}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-nw-ink">
                            {latest ? formatDay(latest.submittedAt) : 'Never'}
                          </td>
                          <td className="px-3 py-3">
                            {latest ? (
                              <OutcomePill outcome={latest.screeningOutcome} />
                            ) : (
                              <span className="text-nw-text-3">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {latest && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewResult(latest)}
                                >
                                  View result
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!hasIdentification}
                                onClick={() => startAssessment(tpl)}
                              >
                                Start
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PanelCard>

        {history.length > 0 && (
          <PanelCard title="History">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                    <th scope="col" className="px-3 py-2.5">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Assessment
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Result
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} className="border-t border-nw-line">
                      <td className="px-3 py-3 whitespace-nowrap text-nw-ink">
                        {formatDay(r.submittedAt)}
                      </td>
                      <td className="px-3 py-3 text-nw-ink">{r.assessmentName}</td>
                      <td className="px-3 py-3">
                        <OutcomePill outcome={r.screeningOutcome} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => viewResult(r)}>
                          View result
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>
        )}
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
            <h3 className="text-base font-semibold text-gray-900 truncate">Assessment results</h3>
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

/** A screening outcome as a pill: "● Low". */
function OutcomePill({ outcome }: { outcome: string | null }) {
  return <StatusPill tone={outcomeTone(outcome)}>{outcome || 'Pending'}</StatusPill>;
}
