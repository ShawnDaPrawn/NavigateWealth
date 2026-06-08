import { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Palette, Shield, Copy, CheckCircle, AlertCircle, X } from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

const colorPalette = [
  {
    name: 'Primary Purple',
    value: '#6d28d9',
    tailwind: 'bg-primary text-primary border-primary',
    category: 'Brand',
    description: 'Main brand purple for buttons, accents, and primary actions',
    usage: ['Buttons', 'Links', 'Active states', 'Icons'],
  },
  {
    name: 'White',
    value: '#ffffff',
    tailwind: 'bg-white text-white border-white',
    category: 'Backgrounds',
    description: 'Primary background color for clean sections',
    usage: ['Page backgrounds', 'Cards', 'Modals', 'Content areas'],
  },
  {
    name: 'Black',
    value: '#000000',
    tailwind: 'bg-black text-black border-black',
    category: 'Text',
    description: 'Primary text color and dark sections',
    usage: ['Headings', 'Body text', 'Hero sections', 'Dark backgrounds'],
  },
  {
    name: 'Dark Navy',
    value: '#313653',
    tailwind: 'bg-[#313653] text-[#313653] border-[#313653]',
    category: 'Backgrounds',
    description:
      'Primary dark section background — used for all hero areas and dark alternating sections via the section-dark-gray utility class',
    usage: ['Hero sections', 'Dark alternating sections', 'CTA blocks', 'Footer areas'],
  },
  {
    name: 'Light Gray',
    value: '#f8f9fa',
    tailwind: 'bg-gray-50 text-gray-50 border-gray-50',
    category: 'Backgrounds',
    description: 'Subtle light gray for input backgrounds, skeleton loaders, and card interiors',
    usage: ['Input backgrounds', 'Skeleton loaders', 'Subtle card fills'],
  },
  {
    name: 'Muted Gray',
    value: '#64748b',
    tailwind: 'bg-gray-500 text-gray-600 border-gray-500',
    category: 'Text',
    description: 'Muted text color for secondary content',
    usage: ['Secondary text', 'Captions', 'Descriptions', 'Placeholders'],
  },
  {
    name: 'Border Gray',
    value: 'rgba(0, 0, 0, 0.1)',
    tailwind: 'border-gray-200',
    category: 'Borders',
    description: 'Light borders and dividers',
    usage: ['Card borders', 'Dividers', 'Input borders', 'Separators'],
  },
  {
    name: 'Success Green',
    value: '#22c55e',
    tailwind: 'bg-green-500 text-green-500 border-green-500',
    category: 'Status',
    description: 'Success states and positive actions',
    usage: ['Success messages', 'Checkmarks', 'Positive indicators'],
  },
  {
    name: 'Warning Yellow',
    value: '#eab308',
    tailwind: 'bg-yellow-500 text-yellow-500 border-yellow-500',
    category: 'Status',
    description: 'Warning states and attention indicators',
    usage: ['Warning messages', 'Pending states', 'Caution indicators'],
  },
  {
    name: 'Error Red',
    value: '#ef4444',
    tailwind: 'bg-red-500 text-red-500 border-red-500',
    category: 'Status',
    description: 'Error states and destructive actions',
    usage: ['Error messages', 'Delete actions', 'Critical alerts'],
  },
];

export function ColorsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Palette className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">Colour System</h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              A professional colour palette for wealth management interfaces. Primary purple
              (#6d28d9) provides brand identity. Dark navy (#313653) is the standard dark section
              background, applied via the{' '}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                section-dark-gray
              </code>{' '}
              utility class. White is the default content background.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Core Colour Tokens
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">WCAG Compliant</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                section-dark-gray Standard
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Colour Categories */}
      {['Brand', 'Backgrounds', 'Text', 'Borders', 'Status'].map((category) => {
        const categoryColors = colorPalette.filter((c) => c.category === category);
        if (categoryColors.length === 0) return null;
        return (
          <div key={category}>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-bold text-black">{category} Colours</h3>
              <Badge variant="outline" className="border-gray-300 text-gray-600">
                {categoryColors.length} {categoryColors.length === 1 ? 'Colour' : 'Colours'}
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {categoryColors.map((color) => (
                <Card
                  key={color.name}
                  className="border-gray-200 hover:border-primary/50 transition-all duration-200 group overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div
                      className="w-full h-28 md:h-24 relative cursor-pointer transition-all duration-300 group-hover:h-32 md:group-hover:h-28"
                      style={{ backgroundColor: color.value }}
                      onClick={() => copyToClipboard(color.value, color.name)}
                    >
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                            {copiedCode === color.name ? (
                              <div className="flex items-center space-x-2 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Copied!</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-gray-700">
                                <Copy className="h-4 w-4" />
                                <span className="text-sm font-medium">Copy hex</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 md:p-5 space-y-3">
                      <div>
                        <h4 className="text-base font-semibold text-black mb-1">{color.name}</h4>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                          {color.description}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">HEX</span>
                          <button
                            onClick={() => copyToClipboard(color.value, `${color.name}-hex`)}
                            className="group/btn flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                          >
                            <code className="text-xs font-mono text-black">{color.value}</code>
                            {copiedCode === `${color.name}-hex` ? (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400 group-hover/btn:text-gray-600" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                            Tailwind
                          </span>
                          <button
                            onClick={() => copyToClipboard(color.tailwind, `${color.name}-tw`)}
                            className="group/btn flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors max-w-[60%]"
                          >
                            <code className="text-xs font-mono text-black truncate">
                              {color.tailwind.split(' ')[0]}
                            </code>
                            {copiedCode === `${color.name}-tw` ? (
                              <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-400 group-hover/btn:text-gray-600 flex-shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
                          Common Usage
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {color.usage.map((use) => (
                            <Badge
                              key={use}
                              variant="secondary"
                              className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              {use}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Colour Combinations */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-4 md:mb-6">
          Colour Combinations
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
          <Card className="border-gray-200">
            <CardContent className="p-5 md:p-6">
              <h4 className="text-sm md:text-base font-semibold text-black mb-3">Primary Button</h4>
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg mb-3">
                <button className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium">
                  Get Started
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Background:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-black">#6d28d9</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Text:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-black">#ffffff</code>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-5 md:p-6">
              <h4 className="text-sm md:text-base font-semibold text-black mb-3">
                Status Indicators
              </h4>
              <div className="p-6 bg-gray-50 rounded-lg space-y-2 mb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700">Success</span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-700">Warning</span>
                </div>
                <div className="flex items-center space-x-2">
                  <X className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-gray-700">Error</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Success:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-black">#22c55e</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Warning:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-black">#eab308</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Error:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-black">#ef4444</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertTitle className="text-black">Accessibility Compliance</AlertTitle>
        <AlertDescription className="text-gray-600 text-sm">
          All colour combinations meet WCAG 2.1 Level AA standards for contrast ratios. Primary
          purple on white provides 4.5:1 contrast, and all text colours ensure readability.
        </AlertDescription>
      </Alert>
    </div>
  );
}
