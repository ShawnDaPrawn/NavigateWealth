import { describe, expect, it } from 'vitest';
import {
  evaluateRuleState,
  getCalculatedDisplay,
  isFieldRequired,
  isFieldVisible,
  pruneHiddenValues,
} from '../ruleEngine';
import type { SignerField } from '../../types';

function makeField(overrides: Partial<SignerField> & { id: string }): SignerField {
  return {
    type: 'text',
    page: 1,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    required: false,
    signer_id: 's1',
    ...overrides,
  };
}

function conditional(rules: unknown[], clearOnHide = false) {
  return { metadata: { conditional: { rules, clearOnHide } } };
}

function calculated(formula: string, extra: Record<string, unknown> = {}) {
  return { metadata: { calculated: { formula, ...extra } } };
}

describe('evaluateRuleState — visibility', () => {
  it('treats fields without conditional metadata as visible', () => {
    const fields = [makeField({ id: 'a', required: true })];
    const state = evaluateRuleState(fields, {});
    expect(state.a.visible).toBe(true);
    expect(state.a.requiredEffective).toBe(true);
  });

  it('a hidden field is never effectively required', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'dep',
        required: true,
        ...conditional([{ sourceFieldId: 'src', operator: 'equals', value: 'yes' }]),
      }),
    ];
    const visibleState = evaluateRuleState(fields, { src: 'yes' });
    expect(visibleState.dep.visible).toBe(true);
    expect(visibleState.dep.requiredEffective).toBe(true);

    const hiddenState = evaluateRuleState(fields, { src: 'no' });
    expect(hiddenState.dep.visible).toBe(false);
    expect(hiddenState.dep.requiredEffective).toBe(false);
  });

  it('supports every operator', () => {
    const field = (operator: string, value?: string) =>
      makeField({ id: 'dep', ...conditional([{ sourceFieldId: 'src', operator, value }]) });

    const visible = (operator: string, srcValue: string, value?: string) =>
      evaluateRuleState([makeField({ id: 'src' }), field(operator, value)], { src: srcValue }).dep
        .visible;

    expect(visible('equals', 'x', 'x')).toBe(true);
    expect(visible('equals', 'y', 'x')).toBe(false);
    expect(visible('not_equals', 'y', 'x')).toBe(true);
    expect(visible('is_checked', 'true')).toBe(true);
    expect(visible('is_checked', '1')).toBe(true);
    expect(visible('is_checked', '0')).toBe(false);
    expect(visible('is_unchecked', '')).toBe(true);
    expect(visible('is_unchecked', 'false')).toBe(true);
    expect(visible('is_filled', 'something')).toBe(true);
    expect(visible('is_filled', '   ')).toBe(false);
    expect(visible('is_empty', '')).toBe(true);
    expect(visible('is_empty', 'x')).toBe(false);
  });

  it('applies AND semantics across multiple rules', () => {
    const fields = [
      makeField({ id: 's1f' }),
      makeField({ id: 's2f' }),
      makeField({
        id: 'dep',
        ...conditional([
          { sourceFieldId: 's1f', operator: 'equals', value: 'a' },
          { sourceFieldId: 's2f', operator: 'equals', value: 'b' },
        ]),
      }),
    ];
    expect(evaluateRuleState(fields, { s1f: 'a', s2f: 'b' }).dep.visible).toBe(true);
    expect(evaluateRuleState(fields, { s1f: 'a', s2f: 'x' }).dep.visible).toBe(false);
  });

  it('resolves chained conditionals — a rule pointing at a hidden source is not satisfied', () => {
    const fields = [
      // 'a' is hidden because its own rule fails (toggle !== 'on')
      makeField({
        id: 'a',
        ...conditional([{ sourceFieldId: 'toggle', operator: 'equals', value: 'on' }]),
      }),
      // 'b' depends on 'a' — since 'a' is hidden, 'b' must hide too
      makeField({ id: 'b', ...conditional([{ sourceFieldId: 'a', operator: 'is_filled' }]) }),
    ];
    const state = evaluateRuleState(fields, { toggle: 'off', a: 'value' });
    expect(state.a.visible).toBe(false);
    expect(state.b.visible).toBe(false);
  });

  it('treats an unknown operator as satisfied (default branch)', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'dep',
        ...conditional([{ sourceFieldId: 'src', operator: 'totally_unknown' }]),
      }),
    ];
    expect(evaluateRuleState(fields, {}).dep.visible).toBe(true);
  });
});

describe('evaluateRuleState — calculated values', () => {
  it('evaluates a formula with field substitution at default precision 2', () => {
    const fields = [makeField({ id: 'c', ...calculated('{field:a} + {field:b}') })];
    expect(evaluateRuleState(fields, { a: '2', b: '3' }).c.calculatedValue).toBe('5.00');
  });

  it('honours precision and prefix', () => {
    const fields = [
      makeField({ id: 'c', ...calculated('{field:a} * {field:b}', { precision: 0, prefix: 'R' }) }),
    ];
    expect(evaluateRuleState(fields, { a: '4', b: '5' }).c.calculatedValue).toBe('R20');
  });

  it('respects arithmetic precedence, parentheses, and unary minus', () => {
    const fields = [
      makeField({ id: 'c1', ...calculated('2 + 3 * 4') }),
      makeField({ id: 'c2', ...calculated('(2 + 3) * 4') }),
      makeField({ id: 'c3', ...calculated('-5 + 10') }),
    ];
    const state = evaluateRuleState(fields, {});
    expect(state.c1.calculatedValue).toBe('14.00');
    expect(state.c2.calculatedValue).toBe('20.00');
    expect(state.c3.calculatedValue).toBe('5.00');
  });

  it('treats non-numeric fields as 0', () => {
    const fields = [makeField({ id: 'c', ...calculated('{field:x} + 5') })];
    expect(evaluateRuleState(fields, { x: 'not-a-number' }).c.calculatedValue).toBe('5.00');
  });

  it('returns null for division by zero and malformed formulas', () => {
    const state = evaluateRuleState(
      [
        makeField({ id: 'div0', ...calculated('2 / 0') }),
        makeField({ id: 'dangling', ...calculated('1 +') }),
        makeField({ id: 'unbalanced', ...calculated('(1 + 2') }),
        makeField({ id: 'trailing', ...calculated('1 2') }),
      ],
      {},
    );
    expect(state.div0.calculatedValue).toBeNull();
    expect(state.dangling.calculatedValue).toBeNull();
    expect(state.unbalanced.calculatedValue).toBeNull();
    expect(state.trailing.calculatedValue).toBeNull();
  });

  it('does not compute a value for a hidden calculated field', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'c',
        ...{
          metadata: {
            conditional: { rules: [{ sourceFieldId: 'src', operator: 'equals', value: 'show' }] },
            calculated: { formula: '1 + 1' },
          },
        },
      }),
    ];
    expect(evaluateRuleState(fields, { src: 'hide' }).c.calculatedValue).toBeNull();
    expect(evaluateRuleState(fields, { src: 'show' }).c.calculatedValue).toBe('2.00');
  });
});

describe('pruneHiddenValues', () => {
  it('strips values for hidden clearOnHide fields and returns a new object', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'dep',
        ...conditional([{ sourceFieldId: 'src', operator: 'equals', value: 'yes' }], true),
      }),
    ];
    const values = { src: 'no', dep: 'stale' };
    const state = evaluateRuleState(fields, values);
    const pruned = pruneHiddenValues(fields, values, state);

    expect(pruned).not.toBe(values); // copy was made
    expect(pruned.dep).toBeUndefined();
    expect(pruned.src).toBe('no');
  });

  it('keeps values when the field is visible', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'dep',
        ...conditional([{ sourceFieldId: 'src', operator: 'equals', value: 'yes' }], true),
      }),
    ];
    const values = { src: 'yes', dep: 'kept' };
    const pruned = pruneHiddenValues(fields, values, evaluateRuleState(fields, values));
    expect(pruned.dep).toBe('kept');
  });

  it('does not strip hidden fields without clearOnHide and returns the same reference', () => {
    const fields = [
      makeField({ id: 'src' }),
      makeField({
        id: 'dep',
        ...conditional([{ sourceFieldId: 'src', operator: 'equals', value: 'yes' }], false),
      }),
    ];
    const values = { src: 'no', dep: 'stale' };
    const pruned = pruneHiddenValues(fields, values, evaluateRuleState(fields, values));
    expect(pruned).toBe(values);
    expect(pruned.dep).toBe('stale');
  });
});

describe('convenience predicates', () => {
  const fields = [
    makeField({ id: 'visibleReq', required: true }),
    makeField({
      id: 'hidden',
      required: true,
      ...conditional([{ sourceFieldId: 'visibleReq', operator: 'equals', value: 'never' }]),
    }),
    makeField({ id: 'calc', ...calculated('3 + 4') }),
  ];
  const state = evaluateRuleState(fields, {});

  it('isFieldVisible defaults to visible for unknown fields', () => {
    expect(isFieldVisible(state, 'visibleReq')).toBe(true);
    expect(isFieldVisible(state, 'hidden')).toBe(false);
    expect(isFieldVisible(state, 'does-not-exist')).toBe(true);
  });

  it('isFieldRequired falls back when the field is unknown', () => {
    expect(isFieldRequired(state, 'visibleReq', false)).toBe(true);
    expect(isFieldRequired(state, 'hidden', true)).toBe(false);
    expect(isFieldRequired(state, 'unknown', true)).toBe(true);
  });

  it('getCalculatedDisplay returns the computed value or null', () => {
    expect(getCalculatedDisplay(state, 'calc')).toBe('7.00');
    expect(getCalculatedDisplay(state, 'visibleReq')).toBeNull();
  });
});
