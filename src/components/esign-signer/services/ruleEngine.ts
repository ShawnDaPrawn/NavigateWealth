/**
 * P4.5 / P4.6 — Signer-side rule engine.
 *
 * Evaluates per-field visibility (conditional fields) and computed
 * values (calculated fields) given the signer's current answers. The
 * engine is intentionally tiny and dependency-free so it runs on every
 * keystroke without measurable jank.
 *
 * Conditional metadata shape (`metadata.conditional`):
 *   {
 *     rules: [{ sourceFieldId, operator, value? }, ...],   // AND semantics
 *     clearOnHide?: boolean,
 *   }
 *
 * Calculated metadata shape (`metadata.calculated`):
 *   {
 *     formula: string,        // tokens: numbers, +-* /, parentheses, {field:<id>}
 *     precision?: number,     // default 2
 *     prefix?: string,        // display-only
 *   }
 *
 * The engine does NOT mutate fields. It returns a `RuleState` map that
 * the signer UI consumes to render visibility, gate completion, and
 * stamp calculated values onto the submission payload.
 */

import type { SignerField } from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ConditionalRule {
  sourceFieldId: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'is_checked'
    | 'is_unchecked'
    | 'is_filled'
    | 'is_empty';
  value?: string;
}

export interface ConditionalMetadata {
  rules: ConditionalRule[];
  clearOnHide?: boolean;
}

export interface CalculatedMetadata {
  formula: string;
  precision?: number;
  prefix?: string;
}

export interface FieldRuleState {
  /** Whether the field is currently visible to the signer. Hidden fields
   *  are non-required regardless of the original `required` flag. */
  visible: boolean;
  /** Whether the field is effectively required — i.e. `field.required &&
   *  visible`. The signer-completion gate keys off this. */
  requiredEffective: boolean;
  /** When the field has a calculated formula, the derived value to
   *  display. `null` if the formula could not be evaluated. */
  calculatedValue: string | null;
}

export type RuleState = Record<string, FieldRuleState>;

// ---------------------------------------------------------------------------
// Helpers — metadata extraction
// ---------------------------------------------------------------------------

function getConditional(field: SignerField): ConditionalMetadata | null {
  const raw = (field.metadata as Record<string, unknown> | undefined)?.conditional;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ConditionalMetadata>;
  if (!Array.isArray(r.rules)) return null;
  return {
    rules: r.rules.filter(
      (rule): rule is ConditionalRule =>
        !!rule && typeof rule.sourceFieldId === 'string' && typeof rule.operator === 'string',
    ),
    clearOnHide: !!r.clearOnHide,
  };
}

function getCalculated(field: SignerField): CalculatedMetadata | null {
  const raw = (field.metadata as Record<string, unknown> | undefined)?.calculated;
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<CalculatedMetadata>;
  if (typeof r.formula !== 'string' || !r.formula.trim()) return null;
  return {
    formula: r.formula,
    precision: typeof r.precision === 'number' ? r.precision : 2,
    prefix: typeof r.prefix === 'string' ? r.prefix : undefined,
  };
}

// ---------------------------------------------------------------------------
// Conditional evaluation
// ---------------------------------------------------------------------------

function evaluateRule(
  rule: ConditionalRule,
  values: Record<string, string>,
  visibleSoFar: Record<string, boolean>,
): boolean {
  // A rule that points at a hidden source is treated as "not satisfied"
  // — otherwise hiding the source could leave a downstream field
  // unintentionally visible with stale data.
  if (visibleSoFar[rule.sourceFieldId] === false) return false;

  const raw = values[rule.sourceFieldId] ?? '';
  switch (rule.operator) {
    case 'equals':
      return raw === (rule.value ?? '');
    case 'not_equals':
      return raw !== (rule.value ?? '');
    case 'is_checked':
      return raw === 'true' || raw === '1';
    case 'is_unchecked':
      return raw === '' || raw === 'false' || raw === '0';
    case 'is_filled':
      return raw.trim().length > 0;
    case 'is_empty':
      return raw.trim().length === 0;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Formula evaluator (safe — no eval, no Function ctor)
// ---------------------------------------------------------------------------

/**
 * Tokeniser + recursive-descent parser for a tiny arithmetic grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := number | '(' expr ')' | '-' factor | identifier
 *   identifier := '{' 'field' ':' <id> '}'
 *
 * Identifiers resolve to numeric values from the value map. Anything
 * non-numeric resolves to 0 so a half-filled form does not crash.
 * Returns `null` on a parse error.
 */
function evaluateFormula(
  formula: string,
  values: Record<string, string>,
): number | null {
  // Substitute {field:<id>} tokens with their numeric value.
  const substituted = formula.replace(/\{field:([^}]+)\}/g, (_match, id: string) => {
    const raw = values[id.trim()] ?? '';
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? String(num) : '0';
  });

  let pos = 0;
  const src = substituted;

  const skipWs = () => {
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  };

  const parseNumber = (): number | null => {
    skipWs();
    const start = pos;
    while (pos < src.length && /[0-9.]/.test(src[pos])) pos++;
    if (start === pos) return null;
    const n = Number.parseFloat(src.slice(start, pos));
    return Number.isFinite(n) ? n : null;
  };

  const parseExpr = (): number | null => parseAddSub();

  const parseAddSub = (): number | null => {
    let left = parseMulDiv();
    if (left === null) return null;
    skipWs();
    while (pos < src.length && (src[pos] === '+' || src[pos] === '-')) {
      const op = src[pos++];
      const right = parseMulDiv();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
      skipWs();
    }
    return left;
  };

  const parseMulDiv = (): number | null => {
    let left = parseFactor();
    if (left === null) return null;
    skipWs();
    while (pos < src.length && (src[pos] === '*' || src[pos] === '/')) {
      const op = src[pos++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === '*') {
        left = left * right;
      } else {
        if (right === 0) return null; // division by zero
        left = left / right;
      }
      skipWs();
    }
    return left;
  };

  const parseFactor = (): number | null => {
    skipWs();
    if (pos >= src.length) return null;
    const ch = src[pos];
    if (ch === '(') {
      pos++;
      const v = parseExpr();
      skipWs();
      if (src[pos] !== ')') return null;
      pos++;
      return v;
    }
    if (ch === '-') {
      pos++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    return parseNumber();
  };

  const result = parseExpr();
  skipWs();
  if (pos !== src.length) return null;
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a `RuleState` snapshot for the supplied fields + signer answers.
 * Visibility is evaluated in two passes (cheap iteration cap) so a
 * conditional that points at another conditional resolves correctly.
 */
export function evaluateRuleState(
  fields: SignerField[],
  values: Record<string, string>,
): RuleState {
  const state: RuleState = {};
  const visibility: Record<string, boolean> = {};

  // Initialise every field as visible by default.
  for (const f of fields) visibility[f.id] = true;

  // Iterate up to fields.length passes (DAG depth bound). Stops early
  // when a pass produces no change.
  for (let pass = 0; pass < Math.max(1, fields.length); pass++) {
    let changed = false;
    for (const f of fields) {
      const cond = getConditional(f);
      if (!cond || cond.rules.length === 0) continue;
      const visible = cond.rules.every(rule => evaluateRule(rule, values, visibility));
      if (visibility[f.id] !== visible) {
        visibility[f.id] = visible;
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const f of fields) {
    const visible = visibility[f.id];
    const calc = getCalculated(f);
    let calculatedValue: string | null = null;
    if (calc && visible) {
      const num = evaluateFormula(calc.formula, values);
      if (num !== null) {
        const precision = calc.precision ?? 2;
        const formatted = num.toFixed(precision);
        calculatedValue = calc.prefix ? `${calc.prefix}${formatted}` : formatted;
      }
    }
    state[f.id] = {
      visible,
      requiredEffective: visible && f.required,
      calculatedValue,
    };
  }

  return state;
}

/**
 * Apply `clearOnHide` semantics — returns a copy of `values` with any
 * hidden fields' answers stripped. Use this immediately before
 * computing `evaluateRuleState` again to avoid stale data.
 */
export function pruneHiddenValues(
  fields: SignerField[],
  values: Record<string, string>,
  state: RuleState,
): Record<string, string> {
  let next = values;
  let mutated = false;
  for (const f of fields) {
    const cond = getConditional(f);
    if (!cond?.clearOnHide) continue;
    if (state[f.id]?.visible === false && next[f.id] != null && next[f.id] !== '') {
      if (!mutated) {
        next = { ...values };
        mutated = true;
      }
      delete next[f.id];
    }
  }
  return next;
}

// Convenience predicates the SigningWorkflow gate uses directly.
export function isFieldVisible(state: RuleState, fieldId: string): boolean {
  return state[fieldId]?.visible !== false;
}

export function isFieldRequired(state: RuleState, fieldId: string, fallback: boolean): boolean {
  return state[fieldId]?.requiredEffective ?? fallback;
}

export function getCalculatedDisplay(state: RuleState, fieldId: string): string | null {
  return state[fieldId]?.calculatedValue ?? null;
}
