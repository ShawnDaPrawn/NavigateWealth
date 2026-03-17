import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BarChart3,
  Users,
  UserCheck,
  Scale,
  Newspaper,
  Landmark,
  Ban,
  ShieldAlert,
  ShieldCheck,
  Play,
  ArrowLeft,
  FileText,
  Eye,
  Clock,
  Hash,
  CircleDot,
  ListChecks,
  Info,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskAssessmentPanelProps {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
}

interface AssessmentTemplate {
  id: number;
  version: string;
  formJson: string;
  matterType: string;
  weightingJson: string;
  assessmentName: string;
  assessmentDescription: string;
  created_at: string;
  updated_at: string;
}

interface AssessmentResult {
  id: string;
  assessmentId: number;
  assessmentName: string;
  submittedAt: string;
  matterId: string | null;
  naturalPersonId: string | null;
  screeningOutcome: string | null;
  bulkScreeningResponse: BulkScreeningResponse | null;
  rawResponse?: Record<string, unknown>;
}

interface BulkScreeningResponse {
  screeningOutcome: string;
  [key: string]: unknown;
}

/** Parsed form question / section from formJson */
interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'section' | 'rating' | 'yesno';
  options?: { label: string; value: string; weight?: number }[];
  required?: boolean;
  description?: string;
  category?: string;
  defaultValue?: string;
}

// ─── View States ─────────────────────────────────────────────────────────────

type PanelView = 'list' | 'form' | 'result';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

const authHeaders = () => ({
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
});

/**
 * Attempt to parse the `formJson` string from a template into renderable fields.
 * Honeycomb's formJson can be a JSON array, a JSON object with sections,
 * or a stringified structure. We normalise it into our FormField[] shape.
 */
function parseFormJson(raw: string): FormField[] {
  if (!raw || raw.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Might be double-encoded
    try {
      parsed = JSON.parse(JSON.parse(raw));
    } catch {
      console.warn('[RiskAssessmentPanel] Could not parse formJson:', raw.substring(0, 200));
      return [];
    }
  }

  const fields: FormField[] = [];

  // If it's an array, iterate
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      fields.push(...normaliseFormItem(item));
    }
  } else if (parsed && typeof parsed === 'object') {
    // Object with sections/questions/fields
    if (parsed.sections && Array.isArray(parsed.sections)) {
      for (const section of parsed.sections) {
        fields.push({
          id: `section_${section.name || section.title || section.id || Math.random()}`,
          label: section.name || section.title || 'Section',
          type: 'section',
          description: section.description,
        });
        const questions = section.questions || section.fields || section.items || [];
        for (const q of questions) {
          fields.push(...normaliseFormItem(q));
        }
      }
    } else if (parsed.questions && Array.isArray(parsed.questions)) {
      for (const q of parsed.questions) {
        fields.push(...normaliseFormItem(q));
      }
    } else if (parsed.fields && Array.isArray(parsed.fields)) {
      for (const q of parsed.fields) {
        fields.push(...normaliseFormItem(q));
      }
    } else {
      // Single object — try to interpret as one question or a flat set of questions
      fields.push(...normaliseFormItem(parsed));
    }
  }

  return fields;
}

/** Normalise a single form item from whatever shape Honeycomb sends */
function normaliseFormItem(item: Record<string, unknown>): FormField[] {
  if (!item || typeof item !== 'object') return [];

  const id = String(item.id || item.name || item.key || item.questionId || `q_${Math.random().toString(36).substring(2, 8)}`);
  const label = (item.label || item.question || item.text || item.title || item.name || id) as string;
  const description = (item.description || item.hint || item.helpText || undefined) as string | undefined;
  const required = (item.required ?? item.isRequired ?? false) as boolean;
  const category = (item.category || item.section || item.group || undefined) as string | undefined;

  // Detect type
  let type: FormField['type'] = 'text';
  let options: FormField['options'] | undefined;

  const rawType = (item.type || item.fieldType || item.inputType || '').toString().toLowerCase();

  if (rawType.includes('select') || rawType.includes('dropdown')) {
    type = 'select';
  } else if (rawType.includes('radio') || rawType.includes('choice') || rawType.includes('single')) {
    type = 'radio';
  } else if (rawType.includes('check') || rawType.includes('multi')) {
    type = 'checkbox';
  } else if (rawType.includes('text') && (rawType.includes('area') || rawType.includes('long'))) {
    type = 'textarea';
  } else if (rawType.includes('number') || rawType.includes('numeric') || rawType.includes('int')) {
    type = 'number';
  } else if (rawType.includes('rating') || rawType.includes('scale') || rawType.includes('score')) {
    type = 'rating';
  } else if (rawType.includes('bool') || rawType.includes('yesno') || rawType.includes('yes_no') || rawType.includes('toggle')) {
    type = 'yesno';
  } else if (rawType.includes('section') || rawType.includes('header') || rawType.includes('heading')) {
    return [{ id, label, type: 'section', description }];
  }

  // If item has options/choices/answers, force to select/radio
  const rawOptions = item.options || item.choices || item.answers || item.values || item.possibleValues;
  if (rawOptions && Array.isArray(rawOptions) && rawOptions.length > 0) {
    if (type === 'text' || type === 'number') {
      type = rawOptions.length <= 5 ? 'radio' : 'select';
    }
    options = rawOptions.map((opt: unknown, idx: number) => {
      if (typeof opt === 'string') return { label: opt, value: opt };
      const o = opt as Record<string, unknown>;
      return {
        label: String(o.label || o.text || o.name || o.value || `Option ${idx + 1}`),
        value: String(o.value ?? o.id ?? o.label ?? idx),
        weight: (o.weight ?? o.score ?? undefined) as number | undefined,
      };
    });
  }

  // If it looks like a yes/no question and has no options, create them
  if (type === 'yesno' && !options) {
    options = [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ];
    type = 'radio';
  }

  return [{
    id,
    label,
    type,
    options,
    required,
    description,
    category,
    defaultValue: item.defaultValue != null ? String(item.defaultValue) : undefined,
  }];
}

/** Parse weightingJson into a lookup of question-id → weights */
function parseWeightingJson(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object') return parsed;
    return {};
  } catch {
    return {};
  }
}

// ─── Screening result helpers ────────────────────────────────────────────────

const getScreeningCategoryInfo = (key: string) => {
  const map: Record<string, { label: string; icon: React.ReactNode; category: 'person' | 'company' }> = {
    possiblePepsNaturalPerson: { label: 'PEPs', icon: <Users className="h-4 w-4" />, category: 'person' },
    possibleRepsNaturalPerson: { label: 'REPs', icon: <UserCheck className="h-4 w-4" />, category: 'person' },
    possibleGazetteItemsNaturalPerson: { label: 'Gazette Items', icon: <Newspaper className="h-4 w-4" />, category: 'person' },
    possibleSanctionsNaturalPerson: { label: 'Sanctions', icon: <Ban className="h-4 w-4" />, category: 'person' },
    possibleAdverseMediaNaturalPerson: { label: 'Adverse Media', icon: <AlertTriangle className="h-4 w-4" />, category: 'person' },
    possibleLandClaimNaturalPerson: { label: 'Land Claims', icon: <Landmark className="h-4 w-4" />, category: 'person' },
    possibleAssetForfeitureNaturalPerson: { label: 'Asset Forfeiture', icon: <Scale className="h-4 w-4" />, category: 'person' },
    possiblePepsCompany: { label: 'PEPs', icon: <Users className="h-4 w-4" />, category: 'company' },
    possibleRepsCompany: { label: 'REPs', icon: <UserCheck className="h-4 w-4" />, category: 'company' },
    possibleGazetteItemsCompany: { label: 'Gazette Items', icon: <Newspaper className="h-4 w-4" />, category: 'company' },
    possibleSanctionsCompany: { label: 'Sanctions', icon: <Ban className="h-4 w-4" />, category: 'company' },
    possibleAdverseMediaCompany: { label: 'Adverse Media', icon: <AlertTriangle className="h-4 w-4" />, category: 'company' },
    possibleLandClaimCompany: { label: 'Land Claims', icon: <Landmark className="h-4 w-4" />, category: 'company' },
    possibleAssetForfeitureCompany: { label: 'Asset Forfeiture', icon: <Scale className="h-4 w-4" />, category: 'company' },
  };
  return map[key] || null;
};

const getOutcomeBadge = (outcome: string | null) => {
  if (!outcome) return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Pending</Badge>;
  const lower = outcome.toLowerCase();
  if (lower.includes('clear') || lower.includes('pass') || lower.includes('low')) {
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><ShieldCheck className="h-3 w-3 mr-1" />{outcome}</Badge>;
  }
  if (lower.includes('high') || lower.includes('fail') || lower.includes('reject')) {
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><ShieldAlert className="h-3 w-3 mr-1" />{outcome}</Badge>;
  }
  if (lower.includes('medium') || lower.includes('review') || lower.includes('warn')) {
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />{outcome}</Badge>;
  }
  return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><BarChart3 className="h-3 w-3 mr-1" />{outcome}</Badge>;
};

// ─── Component ───────────────────────────────────────────────────────────────

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
      const res = await fetch(`${API_BASE}/assessments/templates`, { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to load templates (${res.status})`);
      }
      const data = await res.json();
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
      const res = await fetch(`${API_BASE}/assessments/history/${clientId}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.assessments || []);
      }
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
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const submitAssessment = async () => {
    if (!activeTemplate) return;

    // Basic validation — check required fields
    const missingRequired = formFields
      .filter(f => f.required && f.type !== 'section')
      .filter(f => !formValues[f.id]?.trim());

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

      const res = await fetch(`${API_BASE}/assessments/run`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          clientId,
          assessmentId: activeTemplate.id,
          assessmentName: activeTemplate.assessmentName,
          firstName: clientFirstName,
          lastName: clientLastName,
          idNumber,
          passport,
          submission: submissionPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Assessment submission failed');
      }

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
    const fillable = formFields.filter(f => f.type !== 'section');
    if (fillable.length === 0) return 100;
    const filled = fillable.filter(f => formValues[f.id]?.trim()).length;
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
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${templatesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templatesLoading && templates.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <span className="ml-2 text-sm text-muted-foreground">Loading templates from Honeycomb...</span>
              </div>
            ) : templatesError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Failed to load assessment templates</p>
                  <p className="text-xs text-red-600 mt-1">{templatesError}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={fetchTemplates}>
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
                  const fieldCount = parseFormJson(tpl.formJson).filter(f => f.type !== 'section').length;
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
                          <p className="text-sm font-semibold text-gray-900">{tpl.assessmentName}</p>
                          {tpl.assessmentDescription && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.assessmentDescription}</p>
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
                  <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={historyLoading} className="h-8">
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
                      onClick={() => setExpandedResultId(expandedResultId === result.id ? null : result.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-purple-100 p-1.5 rounded-md flex-shrink-0">
                          <ClipboardList className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{result.assessmentName}</p>
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
                        {expandedResultId === result.id
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />
                        }
                      </div>
                    </button>

                    {expandedResultId === result.id && (
                      <ScreeningResultsDetail result={result} />
                    )}
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
            <h3 className="text-base font-semibold text-gray-900 truncate">{activeTemplate.assessmentName}</h3>
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
                  The assessment will be submitted directly with your client's information for bulk screening.
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
              {activeResult.assessmentName} — Submitted {new Date(activeResult.submittedAt).toLocaleString()}
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
                <span className="block mt-1">Matter ID: <code className="bg-green-100 px-1 rounded text-[10px] font-mono">{activeResult.matterId}</code></span>
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

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** Renders a single form field */
function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === 'section') {
    return (
      <div className="border-b border-gray-200 pb-1 pt-2">
        <h4 className="text-sm font-semibold text-gray-800">{field.label}</h4>
        {field.description && (
          <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id} className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-gray-400">{field.description}</p>
      )}

      {/* Text Input */}
      {field.type === 'text' && (
        <Input
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="h-9 text-sm"
        />
      )}

      {/* Number Input */}
      {field.type === 'number' && (
        <Input
          id={field.id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-9 text-sm max-w-[200px]"
        />
      )}

      {/* Textarea */}
      {field.type === 'textarea' && (
        <textarea
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          rows={3}
        />
      )}

      {/* Select */}
      {field.type === 'select' && field.options && (
        <select
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {/* Radio Buttons */}
      {field.type === 'radio' && field.options && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                value === opt.value
                  ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium ring-1 ring-purple-200'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Rating (1-5 or 1-10 scale) */}
      {field.type === 'rating' && (
        <div className="flex gap-1 pt-0.5">
          {(field.options || [
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
                value === opt.value
                  ? 'border-purple-500 bg-purple-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Checkbox (multi-select) */}
      {field.type === 'checkbox' && field.options && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {field.options.map((opt) => {
            const selected = value.split(',').includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const current = value ? value.split(',') : [];
                  const next = selected
                    ? current.filter(v => v !== opt.value)
                    : [...current, opt.value];
                  onChange(next.filter(Boolean).join(','));
                }}
                className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                  selected
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {selected && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Renders the expanded screening results for an assessment */
function ScreeningResultsDetail({
  result,
  expanded = false,
}: {
  result: AssessmentResult;
  expanded?: boolean;
}) {
  const screening = result.bulkScreeningResponse;

  if (!screening) {
    return (
      <div className={`${expanded ? '' : 'border-t'} bg-gray-50 px-4 py-4`}>
        <p className="text-sm text-gray-500 italic">
          No screening results available. The assessment may still be processing.
        </p>
      </div>
    );
  }

  const personEntries = Object.entries(screening)
    .filter(([key]) => {
      const info = getScreeningCategoryInfo(key);
      return info && info.category === 'person';
    });

  const companyEntries = Object.entries(screening)
    .filter(([key]) => {
      const info = getScreeningCategoryInfo(key);
      return info && info.category === 'company';
    });

  const totalHits = [...personEntries, ...companyEntries]
    .reduce((sum, [, val]) => sum + (Number(val) || 0), 0);

  return (
    <div className={`${expanded ? '' : 'border-t'} bg-gray-50 px-4 py-4 space-y-4`}>
      {/* Summary Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Screening Outcome:</span>
          {getOutcomeBadge(screening.screeningOutcome)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Total Possible Hits:</span>
          <span className={`text-sm font-bold ${totalHits > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalHits}
          </span>
        </div>
      </div>

      {/* Natural Person Screening */}
      {personEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Natural Person Screening
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {personEntries.map(([key, value]) => {
              const info = getScreeningCategoryInfo(key);
              if (!info) return null;
              const count = Number(value) || 0;
              const hasHits = count > 0;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    hasHits
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                >
                  {info.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{info.label}</p>
                  </div>
                  <span className={`text-sm font-bold ${hasHits ? 'text-red-600' : 'text-green-600'}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Company Screening */}
      {companyEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Company Screening
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {companyEntries.map(([key, value]) => {
              const info = getScreeningCategoryInfo(key);
              if (!info) return null;
              const count = Number(value) || 0;
              const hasHits = count > 0;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 border ${
                    hasHits
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                >
                  {info.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{info.label}</p>
                  </div>
                  <span className={`text-sm font-bold ${hasHits ? 'text-red-600' : 'text-green-600'}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {personEntries.length === 0 && companyEntries.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          Screening data not yet available. Results may take a few moments to process.
        </p>
      )}
    </div>
  );
}