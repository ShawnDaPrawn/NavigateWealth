/**
 * The two shapes every quote vertical renders into.
 *
 * `QuoteProductDetails` is deliberately an index signature: the submitted
 * payload differs per vertical and is validated at the route boundary, not
 * here. Each vertical narrows what it reads itself, exactly as it did when all
 * six lived in one handler.
 */
export type QuoteProductDetails = Record<string, unknown>;

export interface QuotePdfField {
  label: string;
  value: string;
}
