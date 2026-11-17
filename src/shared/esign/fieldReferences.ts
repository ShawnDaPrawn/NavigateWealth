/**
 * Fields can name OTHER fields: a conditional rule's source
 * (`metadata.conditional.rules[].sourceFieldId`) and `{field:<id>}` tokens in
 * a calculated formula (`metadata.calculated.formula`) — the shapes
 * `esign-signer/services/ruleEngine.ts` reads.
 *
 * Whenever fields are copied under new ids — sending an envelope, or applying
 * a saved template to a new one — those references must be rewritten too, or
 * a field shown "when the box is ticked" stays hidden whatever happens.
 *
 * Shared by the Edge Function (send path) and the SPA (template apply). No
 * imports: this file is loaded by both Vite and Deno.
 */

/** Rewrite field references through `idMap` (old id → new id). Unknown ids are kept. */
export function remapFieldReferences(
  metadata: Record<string, unknown>,
  idMap: ReadonlyMap<string, string>,
): Record<string, unknown> {
  if (idMap.size === 0) return metadata;
  let next = metadata;
  const conditional = metadata.conditional as { rules?: unknown } | undefined;
  if (conditional && Array.isArray(conditional.rules)) {
    next = {
      ...next,
      conditional: {
        ...conditional,
        rules: conditional.rules.map((r) => {
          const rule = r as { sourceFieldId?: unknown };
          return typeof rule?.sourceFieldId === 'string' && idMap.has(rule.sourceFieldId)
            ? { ...rule, sourceFieldId: idMap.get(rule.sourceFieldId) }
            : r;
        }),
      },
    };
  }
  const calculated = metadata.calculated as { formula?: unknown } | undefined;
  if (calculated && typeof calculated.formula === 'string') {
    next = {
      ...next,
      calculated: {
        ...calculated,
        formula: calculated.formula.replace(/\{field:([^}]+)\}/g, (whole, id: string) =>
          idMap.has(id) ? `{field:${idMap.get(id)}}` : whole,
        ),
      },
    };
  }
  return next;
}
