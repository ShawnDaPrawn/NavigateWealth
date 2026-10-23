import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';

import { Copy, CheckCircle, Eye, Code, ChevronDown, Shield, Layers } from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';
import { buildPatterns } from './patternsCatalog';

export function PatternsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const copyCode = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const patterns = buildPatterns();

  const categories = ['all', ...Array.from(new Set(patterns.map((p) => p.category)))];

  const filteredPatterns = patterns.filter(
    (p) => selectedCategory === 'all' || p.category === selectedCategory,
  );

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">UI Patterns</h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              Established UI patterns used throughout the Navigate Wealth platform. These are
              composed from Design System primitives and represent the standard way to build common
              interface elements. Use these patterns to maintain consistency across all modules.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {patterns.length} Patterns
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Production Proven
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Copy &amp; Paste
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {categories.map((cat) => {
          const count =
            cat === 'all' ? patterns.length : patterns.filter((p) => p.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? 'All' : cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Patterns List */}
      <div className="space-y-6 md:space-y-8">
        {filteredPatterns.map((pattern) => (
          <Card
            key={pattern.id}
            className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden"
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-lg md:text-xl text-black">{pattern.name}</CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {pattern.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base text-gray-600">
                    {pattern.description}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCode(pattern.code, pattern.id)}
                  className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                >
                  {copiedCode === pattern.id ? (
                    <div className="contents">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </div>
                  ) : (
                    <div className="contents">
                      <Copy className="h-4 w-4 mr-2" />
                      <span>Copy Code</span>
                    </div>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              {/* Preview */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-black">Preview</span>
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white rounded-lg border-2 border-gray-200 flex items-center justify-center">
                  {pattern.preview}
                </div>
              </div>

              {/* Code (Collapsible) */}
              <div>
                <button
                  onClick={() => setExpandedCode(expandedCode === pattern.id ? null : pattern.id)}
                  className="w-full flex items-center justify-between mb-3 group"
                >
                  <span className="text-sm font-semibold text-black flex items-center">
                    <Code className="h-4 w-4 mr-2 text-primary" />
                    Code
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      expandedCode === pattern.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedCode === pattern.id && (
                  <div className="relative group/code">
                    <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                      <code>{pattern.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyCode(pattern.code, `${pattern.id}-code`)}
                      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                    >
                      {copiedCode === `${pattern.id}-code` ? (
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

      {/* Best Practices */}
      <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Layers className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Survey Before Creating</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Before building a new UI pattern, check existing modules for established
            implementations. Match existing spacing, sizing, and interaction patterns.
          </AlertDescription>
        </Alert>

        <Alert className="border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Config-Driven UI</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Status indicators, badges, and labels should always be driven by typed configuration
            objects (constants.ts), never hard-coded inline in JSX.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
