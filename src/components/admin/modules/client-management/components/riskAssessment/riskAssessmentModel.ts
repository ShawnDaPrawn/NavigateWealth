/**
 * Model for the risk-assessment panel: the Honeycomb template/result shapes
 * and the formJson parsing that normalises whatever structure Honeycomb sends
 * into renderable FormField[]s. Pure — no React, no API calls.
 */
export interface AssessmentTemplate {
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

export interface AssessmentResult {
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

export interface BulkScreeningResponse {
  screeningOutcome: string;
  [key: string]: unknown;
}

/** Parsed form question / section from formJson */
export interface FormField {
  id: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'textarea'
    | 'section'
    | 'rating'
    | 'yesno';
  options?: { label: string; value: string; weight?: number }[];
  required?: boolean;
  description?: string;
  category?: string;
  defaultValue?: string;
}

// ─── View States ─────────────────────────────────────────────────────────────

/**
 * Attempt to parse the `formJson` string from a template into renderable fields.
 * Honeycomb's formJson can be a JSON array, a JSON object with sections,
 * or a stringified structure. We normalise it into our FormField[] shape.
 */
export function parseFormJson(raw: string): FormField[] {
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
    // Object with sections/questions/fields (parsed narrows to `object`; read loosely)
    const obj = parsed as Record<string, unknown>;
    if (obj.sections && Array.isArray(obj.sections)) {
      for (const section of obj.sections) {
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
    } else if (obj.questions && Array.isArray(obj.questions)) {
      for (const q of obj.questions) {
        fields.push(...normaliseFormItem(q));
      }
    } else if (obj.fields && Array.isArray(obj.fields)) {
      for (const q of obj.fields) {
        fields.push(...normaliseFormItem(q));
      }
    } else {
      // Single object — try to interpret as one question or a flat set of questions
      fields.push(...normaliseFormItem(obj));
    }
  }

  return fields;
}

/** Normalise a single form item from whatever shape Honeycomb sends */
export function normaliseFormItem(item: Record<string, unknown>): FormField[] {
  if (!item || typeof item !== 'object') return [];

  const id = String(
    item.id ||
      item.name ||
      item.key ||
      item.questionId ||
      `q_${Math.random().toString(36).substring(2, 8)}`,
  );
  const label = (item.label ||
    item.question ||
    item.text ||
    item.title ||
    item.name ||
    id) as string;
  const description = (item.description || item.hint || item.helpText || undefined) as
    | string
    | undefined;
  const required = (item.required ?? item.isRequired ?? false) as boolean;
  const category = (item.category || item.section || item.group || undefined) as string | undefined;

  // Detect type
  let type: FormField['type'] = 'text';
  let options: FormField['options'] | undefined;

  const rawType = (item.type || item.fieldType || item.inputType || '').toString().toLowerCase();

  if (rawType.includes('select') || rawType.includes('dropdown')) {
    type = 'select';
  } else if (
    rawType.includes('radio') ||
    rawType.includes('choice') ||
    rawType.includes('single')
  ) {
    type = 'radio';
  } else if (rawType.includes('check') || rawType.includes('multi')) {
    type = 'checkbox';
  } else if (rawType.includes('text') && (rawType.includes('area') || rawType.includes('long'))) {
    type = 'textarea';
  } else if (rawType.includes('number') || rawType.includes('numeric') || rawType.includes('int')) {
    type = 'number';
  } else if (rawType.includes('rating') || rawType.includes('scale') || rawType.includes('score')) {
    type = 'rating';
  } else if (
    rawType.includes('bool') ||
    rawType.includes('yesno') ||
    rawType.includes('yes_no') ||
    rawType.includes('toggle')
  ) {
    type = 'yesno';
  } else if (
    rawType.includes('section') ||
    rawType.includes('header') ||
    rawType.includes('heading')
  ) {
    return [{ id, label, type: 'section', description }];
  }

  // If item has options/choices/answers, force to select/radio
  const rawOptions =
    item.options || item.choices || item.answers || item.values || item.possibleValues;
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

  return [
    {
      id,
      label,
      type,
      options,
      required,
      description,
      category,
      defaultValue: item.defaultValue != null ? String(item.defaultValue) : undefined,
    },
  ];
}
