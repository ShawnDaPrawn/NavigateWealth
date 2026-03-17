import React, { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import {
  Type,
  Copy,
  CheckCircle,
  Info,
  Eye,
  Code,
  ChevronDown,
} from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

interface TypographyEntry {
  id: string;
  element: string;
  name: string;
  size: string;
  weight: string;
  lineHeight: string;
  cssVar?: string;
  tailwind: string;
  usage: string;
  preview: React.ReactNode;
  code: string;
}

export function TypographyTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const typeScale: TypographyEntry[] = [
    {
      id: 'h1',
      element: 'h1',
      name: 'Hero Heading',
      size: '3rem (48px)',
      weight: '500 (Medium)',
      lineHeight: '1.2',
      tailwind: 'text-[48px] font-medium leading-[1.2]',
      usage: 'Main page titles, hero sections, landing page headlines',
      preview: (
        <h1 className="text-[48px] font-medium leading-[1.2] text-black">
          Your Wealth <span className="text-primary">Journey</span>
        </h1>
      ),
      code: `<h1 className="text-black">
  Your Wealth <span className="text-primary">Journey</span>
</h1>

/* Base style from globals.css: */
/* font-size: 3rem (48px), font-weight: 500, line-height: 1.2 */`,
    },
    {
      id: 'h2',
      element: 'h2',
      name: 'Section Heading',
      size: '2rem (32px)',
      weight: '500 (Medium)',
      lineHeight: '1.3',
      tailwind: 'text-[32px] font-medium leading-[1.3]',
      usage: 'Major content section titles, page sub-sections',
      preview: (
        <h2 className="text-[32px] font-medium leading-[1.3] text-black">
          Investment <span className="text-primary">Management</span>
        </h2>
      ),
      code: `<h2 className="text-black mb-6">
  Investment <span className="text-primary">Management</span>
</h2>

/* Base style from globals.css: */
/* font-size: 2rem (32px), font-weight: 500, line-height: 1.3 */`,
    },
    {
      id: 'h3',
      element: 'h3',
      name: 'Subsection Heading',
      size: '1.25rem (20px)',
      weight: '600 (Semi-bold)',
      lineHeight: '1.3',
      tailwind: 'text-[20px] font-semibold leading-[1.3]',
      usage: 'Card titles, subsection headers, feature names. Enforced globally via globals.css with !important',
      preview: (
        <h3 className="text-[20px] font-semibold leading-[1.3] text-black">
          Financial Planning Services
        </h3>
      ),
      code: `<h3 className="text-black mb-3">Financial Planning Services</h3>

/* Base style from globals.css: */
/* font-size: 1.25rem (20px), font-weight: 600, line-height: 1.3 */
/* Color is enforced by section context: */
/* .section-white h3 -> #000000, .section-black h3 -> #ffffff */`,
    },
    {
      id: 'h4',
      element: 'h4',
      name: 'Content Heading',
      size: '1.25rem (20px)',
      weight: '500 (Medium)',
      lineHeight: '1.4',
      tailwind: 'text-[20px] font-medium leading-[1.4]',
      usage: 'Content block titles, list section headers',
      preview: (
        <h4 className="text-[20px] font-medium leading-[1.4] text-black">
          Risk Assessment Overview
        </h4>
      ),
      code: `<h4 className="font-medium text-black">Risk Assessment Overview</h4>

/* Base style from globals.css: */
/* font-size: 1.25rem (20px), font-weight: 500, line-height: 1.4 */`,
    },
    {
      id: 'body-large',
      element: 'p',
      name: 'Body Large (Default)',
      size: '1.125rem (18px)',
      weight: '400 (Normal)',
      lineHeight: '1.6',
      tailwind: 'text-[18px] font-normal leading-[1.6]',
      usage: 'Primary body text on public/marketing pages. This is the default <p> size.',
      preview: (
        <p className="text-[18px] font-normal leading-[1.6] text-gray-600 max-w-xl">
          Navigate Wealth provides independent financial advisory services designed
          to help you build, protect, and grow your wealth.
        </p>
      ),
      code: `<p className="text-gray-600">
  Navigate Wealth provides independent financial advisory services
  designed to help you build, protect, and grow your wealth.
</p>

/* Base style from globals.css: */
/* font-size: 1.125rem (18px), font-weight: 400, line-height: 1.6 */`,
    },
    {
      id: 'body-base',
      element: 'p',
      name: 'Body Base',
      size: '0.875rem / 1rem (14-16px)',
      weight: '400 (Normal)',
      lineHeight: '1.5',
      tailwind: 'text-sm / text-base',
      usage: 'Admin panel text, form labels, dashboard content. Override default <p> size with Tailwind text-sm or text-base.',
      preview: (
        <div className="space-y-2">
          <p className="text-base font-normal text-gray-700">
            Base text (16px) - used for general content in the admin panel
          </p>
          <p className="text-sm font-normal text-gray-600">
            Small text (14px) - used for descriptions, captions, and secondary content
          </p>
        </div>
      ),
      code: `{/* Base size for admin/dashboard content */}
<p className="text-base text-gray-700">Base text (16px)</p>

{/* Small size for descriptions and secondary content */}
<p className="text-sm text-gray-600">Small text (14px)</p>`,
    },
    {
      id: 'body-xs',
      element: 'span',
      name: 'Caption / Extra Small',
      size: '0.75rem (12px)',
      weight: '400-500',
      lineHeight: '1.5',
      tailwind: 'text-xs',
      usage: 'Captions, timestamps, helper text, badge labels, fine print',
      preview: (
        <div className="space-y-2">
          <span className="text-xs text-gray-500 block">Last updated: 15 Feb 2026 at 14:30</span>
          <span className="text-xs font-medium text-primary uppercase tracking-wide block">
            FSP No. 12345
          </span>
        </div>
      ),
      code: `<span className="text-xs text-gray-500">Last updated: 15 Feb 2026 at 14:30</span>

<span className="text-xs font-medium text-primary uppercase tracking-wide">
  FSP No. 12345
</span>`,
    },
  ];

  const fontWeights = [
    { name: 'Normal', value: '400', css: 'var(--font-weight-normal)', tailwind: 'font-normal', usage: 'Body text, descriptions' },
    { name: 'Medium', value: '500', css: 'var(--font-weight-medium)', tailwind: 'font-medium', usage: 'Headings (h1, h2, h4), labels, buttons' },
    { name: 'Semi-bold', value: '600', css: '600', tailwind: 'font-semibold', usage: 'h3 headings, card titles, emphasis' },
    { name: 'Bold', value: '700', css: '700', tailwind: 'font-bold', usage: 'Hero numbers, stat values, strong emphasis' },
  ];

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Type className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Typography System</h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              A scalable type system using the system font stack, optimised for financial content readability.
              Base font size is 14px (<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">--font-size</code>).
              Heading styles are defined globally in <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">globals.css</code> and
              enforced across all sections. The <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">h3</code> element
              uses <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-primary">!important</code> to
              guarantee consistency across the entire admin panel.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">System Font Stack</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">14px Base</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">7 Scale Steps</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">WCAG AA</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Type Scale */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg md:text-xl font-bold text-black">Type Scale</h3>
          <Badge variant="outline" className="border-gray-300 text-gray-600">
            {typeScale.length} Levels
          </Badge>
        </div>

        <div className="space-y-6">
          {typeScale.map((entry) => (
            <Card key={entry.id} className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden">
              <CardContent className="p-0">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    <code className="text-sm font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-md font-semibold">
                      &lt;{entry.element}&gt;
                    </code>
                    <span className="text-base font-semibold text-black">{entry.name}</span>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">{entry.size}</Badge>
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">{entry.weight}</Badge>
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">LH: {entry.lineHeight}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyCode(entry.code, entry.id)}
                    className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                  >
                    {copiedCode === entry.id ? (
                      <div className="contents">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        <span className="text-green-600">Copied!</span>
                      </div>
                    ) : (
                      <div className="contents">
                        <Copy className="h-4 w-4 mr-2" />
                        <span>Copy</span>
                      </div>
                    )}
                  </Button>
                </div>

                {/* Preview */}
                <div className="p-5 md:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-black">Preview</span>
                  </div>
                  <div className="p-4 md:p-6 bg-white rounded-lg border border-gray-200">
                    {entry.preview}
                  </div>
                </div>

                {/* Usage */}
                <div className="px-5 md:px-6 pb-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-black">Usage:</span> {entry.usage}
                  </p>
                </div>

                {/* Code (Collapsible) */}
                <div className="px-5 md:px-6 pb-5 md:pb-6">
                  <button
                    onClick={() => setExpandedCode(expandedCode === entry.id ? null : entry.id)}
                    className="w-full flex items-center justify-between mb-3 group"
                  >
                    <span className="text-sm font-semibold text-black flex items-center">
                      <Code className="h-4 w-4 mr-2 text-primary" />
                      Code
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${
                        expandedCode === entry.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedCode === entry.id && (
                    <div className="relative group/code">
                      <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-5 rounded-lg overflow-x-auto">
                        <code>{entry.code}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyCode(entry.code, `${entry.id}-code`)}
                        className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                      >
                        {copiedCode === `${entry.id}-code` ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Font Weights */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg md:text-xl font-bold text-black">Font Weights</h3>
          <Badge variant="outline" className="border-gray-300 text-gray-600">
            {fontWeights.length} Weights
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
          {fontWeights.map((fw) => (
            <Card key={fw.name} className="border-gray-200 hover:border-primary/30 transition-colors">
              <CardContent className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-base font-semibold text-black">{fw.name}</h4>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">{fw.value}</Badge>
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">{fw.tailwind}</Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => copyCode(fw.tailwind, `fw-${fw.name}`)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {copiedCode === `fw-${fw.name}` ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg mb-3">
                  <p className="text-lg text-black" style={{ fontWeight: Number(fw.value) }}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                </div>
                <p className="text-sm text-gray-600">{fw.usage}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Text Color Patterns */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-6">Text Colour Patterns</h3>
        <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
          {/* Light backgrounds */}
          <Card className="border-gray-200">
            <CardContent className="p-5 md:p-6">
              <h4 className="text-base font-semibold text-black mb-4">On Light Backgrounds</h4>
              <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-black font-medium">Primary text</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">text-black</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Secondary text</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">text-gray-600</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Muted text</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">text-gray-500</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-medium">Brand accent</span>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">text-primary</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dark backgrounds */}
          <Card className="border-gray-200">
            <CardContent className="p-5 md:p-6">
              <h4 className="text-base font-semibold text-black mb-4">On Dark Backgrounds</h4>
              <div className="space-y-3 p-4 bg-black rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Primary text</span>
                  <code className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">text-white</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Secondary text</span>
                  <code className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">text-gray-300</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Muted text</span>
                  <code className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">text-gray-400</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary font-medium">Brand accent</span>
                  <code className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">text-primary</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSS Variables Reference */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-6">CSS Variables Reference</h3>
        <Card className="border-gray-200">
          <CardContent className="p-0">
            <div className="relative group/code">
              <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto">
                <code>{`:root {
  --font-size: 14px;           /* Base font size */
  --font-weight-normal: 400;   /* Body text */
  --font-weight-medium: 500;   /* Headings, labels, buttons */
}

/* Section context enforces h3 colour: */
.section-white h3 { color: #000000 !important; }
.section-black h3 { color: #ffffff !important; }

/* Base heading styles (from globals.css): */
h1 { font-size: 3rem;    font-weight: 500; line-height: 1.2; }
h2 { font-size: 2rem;    font-weight: 500; line-height: 1.3; }
h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
h4 { font-size: 1.25rem; font-weight: 500; line-height: 1.4; }
p  { font-size: 1.125rem; font-weight: 400; line-height: 1.6; }`}</code>
              </pre>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  copyCode(
                    `:root {\n  --font-size: 14px;\n  --font-weight-normal: 400;\n  --font-weight-medium: 500;\n}`,
                    'css-vars',
                  )
                }
                className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
              >
                {copiedCode === 'css-vars' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Practices */}
      <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Type className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Override Default &lt;p&gt; Size</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            The default &lt;p&gt; is 18px (marketing pages). In the admin panel, always add <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">text-sm</code> or <code className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">text-base</code> to override.
          </AlertDescription>
        </Alert>

        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Section Context Matters</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            The &lt;h3&gt; element has globally enforced colours based on its parent section class. This cannot be overridden with utility classes - it is intentional for consistency.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
