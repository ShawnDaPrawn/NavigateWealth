/**
 * Suppliers — Invoice Template Spec (re-export)
 *
 * The spec type, defaults and normalizer live in the pure, dependency-free
 * shared module below, which the edge function also consumes — so the AI
 * analyzer, persistence-time validation and the client renderer/editor can
 * never drift apart.
 */

export {
  DEFAULT_TEMPLATE_SPEC,
  normalizeTemplateSpec,
} from '../../../../../shared/suppliers/invoice-template-spec';
export type {
  InvoiceTemplateSpec,
  TemplateAccentBar,
  TemplateBlockPosition,
  TemplateColumn,
  TemplateColumnAlign,
  TemplateColumnKey,
  TemplateCurrencyFormat,
  TemplateDateFormat,
  TemplateFontFamily,
  TemplateLogoPosition,
  TemplateMargins,
  TemplateMetaField,
  TemplateMetaFieldKey,
  TemplateTableHeaderStyle,
  TemplateTableStyle,
  TemplateTotalsPosition,
} from '../../../../../shared/suppliers/invoice-template-spec';
