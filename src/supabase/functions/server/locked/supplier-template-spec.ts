/**
 * Supplier Invoice Template Spec — server-side entry.
 *
 * The spec types, defaults and normalizer live in ONE pure, dependency-free
 * module in src/shared/suppliers/ (see the re-export below, mirroring how
 * shared/integrations/binding-utils.ts is consumed from both sides); the
 * frontend renderer/editor and this edge function share it verbatim, so the
 * AI analyzer, persistence-time normalization and the client can never drift
 * apart. The shared module belongs to the locked module and is deleted with
 * it (see ../../../../components/admin/modules/locked/README.md).
 *
 * The OpenAI Structured Outputs JSON schema mirrors that spec and is only
 * needed server-side, so it lives here.
 *
 * @module server/supplier-template-spec
 */

export {
  DEFAULT_TEMPLATE_SPEC,
  normalizeTemplateSpec,
} from '../../../../shared/suppliers/invoice-template-spec.ts';
export type {
  InvoiceTemplateSpec,
  TemplateColumn,
  TemplateMetaField,
} from '../../../../shared/suppliers/invoice-template-spec.ts';

// ============================================================================
// OpenAI Structured Outputs JSON schema
// ============================================================================

const hexSchema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };

/**
 * JSON schema for the analysis response (spec + confidence + notes), written
 * for OpenAI Structured Outputs strict mode: every property listed as
 * required, `additionalProperties: false` throughout. The normalizer remains
 * the real gatekeeper — the schema just steers the model.
 */
export const TEMPLATE_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['spec', 'confidence', 'notes'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    notes: { type: 'string' },
    spec: {
      type: 'object',
      additionalProperties: false,
      required: [
        'page',
        'palette',
        'typography',
        'logo',
        'header',
        'metaBox',
        'billedTo',
        'lineTable',
        'totals',
        'footer',
        'formats',
      ],
      properties: {
        page: {
          type: 'object',
          additionalProperties: false,
          required: ['size', 'margins'],
          properties: {
            size: { type: 'string', enum: ['A4'] },
            margins: { type: 'string', enum: ['compact', 'normal', 'wide'] },
          },
        },
        palette: {
          type: 'object',
          additionalProperties: false,
          required: [
            'primary',
            'accent',
            'headerText',
            'bodyText',
            'tableHeaderBg',
            'tableHeaderText',
          ],
          properties: {
            primary: hexSchema,
            accent: hexSchema,
            headerText: hexSchema,
            bodyText: hexSchema,
            tableHeaderBg: hexSchema,
            tableHeaderText: hexSchema,
          },
        },
        typography: {
          type: 'object',
          additionalProperties: false,
          required: ['fontFamily', 'baseSizePt', 'titleUppercase'],
          properties: {
            fontFamily: { type: 'string', enum: ['sans', 'serif', 'mono'] },
            baseSizePt: { type: 'number' },
            titleUppercase: { type: 'boolean' },
          },
        },
        logo: {
          type: 'object',
          additionalProperties: false,
          required: ['show', 'position', 'heightPx'],
          properties: {
            show: { type: 'boolean' },
            position: { type: 'string', enum: ['top-left', 'top-center', 'top-right'] },
            heightPx: { type: 'number' },
          },
        },
        header: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'titlePosition',
            'supplierBlockPosition',
            'showSupplierAddress',
            'showVatNumber',
            'showRegNumber',
            'accentBar',
          ],
          properties: {
            title: { type: 'string' },
            titlePosition: { type: 'string', enum: ['left', 'right'] },
            supplierBlockPosition: { type: 'string', enum: ['left', 'right'] },
            showSupplierAddress: { type: 'boolean' },
            showVatNumber: { type: 'boolean' },
            showRegNumber: { type: 'boolean' },
            accentBar: { type: 'string', enum: ['none', 'top', 'left', 'under-title'] },
          },
        },
        metaBox: {
          type: 'object',
          additionalProperties: false,
          required: ['position', 'fields'],
          properties: {
            position: { type: 'string', enum: ['left', 'right'] },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'label'],
                properties: {
                  key: {
                    type: 'string',
                    enum: ['invoiceNumber', 'invoiceDate', 'dueDate', 'reference'],
                  },
                  label: { type: 'string' },
                },
              },
            },
          },
        },
        billedTo: {
          type: 'object',
          additionalProperties: false,
          required: ['heading', 'showVatNumber', 'showAddress'],
          properties: {
            heading: { type: 'string' },
            showVatNumber: { type: 'boolean' },
            showAddress: { type: 'boolean' },
          },
        },
        lineTable: {
          type: 'object',
          additionalProperties: false,
          required: ['columns', 'style', 'headerStyle'],
          properties: {
            columns: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'label', 'align'],
                properties: {
                  key: {
                    type: 'string',
                    enum: ['description', 'quantity', 'unitPrice', 'vatAmount', 'lineTotal'],
                  },
                  label: { type: 'string' },
                  align: { type: 'string', enum: ['left', 'center', 'right'] },
                },
              },
            },
            style: { type: 'string', enum: ['lined', 'striped', 'boxed', 'minimal'] },
            headerStyle: { type: 'string', enum: ['filled', 'underline', 'plain'] },
          },
        },
        totals: {
          type: 'object',
          additionalProperties: false,
          required: ['position', 'subtotalLabel', 'vatLabel', 'totalLabel', 'emphasizeTotal'],
          properties: {
            position: { type: 'string', enum: ['right', 'full-width'] },
            subtotalLabel: { type: 'string' },
            vatLabel: { type: 'string' },
            totalLabel: { type: 'string' },
            emphasizeTotal: { type: 'boolean' },
          },
        },
        footer: {
          type: 'object',
          additionalProperties: false,
          required: ['bankingDetails', 'terms', 'thankYouLine'],
          properties: {
            bankingDetails: { type: 'string' },
            terms: { type: 'string' },
            thankYouLine: { type: 'string' },
          },
        },
        formats: {
          type: 'object',
          additionalProperties: false,
          required: ['currency', 'dateFormat'],
          properties: {
            currency: { type: 'string', enum: ['R1 234,56', 'R 1,234.56', 'ZAR 1 234.56'] },
            dateFormat: {
              type: 'string',
              enum: ['yyyy/MM/dd', 'dd MMM yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
            },
          },
        },
      },
    },
  },
};
