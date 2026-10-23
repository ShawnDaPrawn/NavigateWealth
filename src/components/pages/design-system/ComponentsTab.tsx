import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';

import { Component, Copy, CheckCircle, Info, Eye, ChevronDown, Code, Search } from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';
import { buildComponents } from './componentsCatalog';

export function ComponentsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const components = buildComponents();

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const componentCategories = ['all', ...Array.from(new Set(components.map((c) => c.category)))];

  const filteredComponents = components.filter(
    (c) =>
      (selectedCategory === 'all' || c.category === selectedCategory) &&
      (componentSearch === '' ||
        c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(componentSearch.toLowerCase())),
  );

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Component className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">
              UI Components Library
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              A comprehensive collection of React components built with shadcn/ui and styled for the
              Navigate Wealth platform. All components are fully responsive and follow accessibility
              best practices.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {components.length} Components
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                React + TypeScript
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">shadcn/ui</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search components..."
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {componentCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {componentCategories.map((cat) => {
            const count =
              cat === 'all'
                ? components.length
                : components.filter((c) => c.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {cat === 'all' ? 'All' : cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Components List */}
      <div className="space-y-6 md:space-y-8">
        {filteredComponents.map((component) => (
          <Card
            key={component.id}
            className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden"
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-lg md:text-xl text-black">
                      {component.name}
                    </CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {component.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base text-gray-600">
                    {component.description}
                  </CardDescription>
                  {component.variants && component.variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {component.variants.map((v) => (
                        <Badge
                          key={v}
                          variant="secondary"
                          className="text-xs bg-gray-100 text-gray-700"
                        >
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(component.code, component.id)}
                  className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                >
                  {copiedCode === component.id ? (
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
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-black">Preview</span>
                </div>
                <div className="p-6 md:p-8 bg-gradient-to-br from-gray-50 to-white rounded-lg border-2 border-gray-200 min-h-[100px] flex items-center justify-center">
                  {component.component}
                </div>
              </div>
              <div>
                <button
                  onClick={() =>
                    setExpandedCode(expandedCode === component.id ? null : component.id)
                  }
                  className="w-full flex items-center justify-between mb-3 group"
                >
                  <span className="text-sm font-semibold text-black flex items-center">
                    <Code className="h-4 w-4 mr-2 text-primary" />
                    Code
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${expandedCode === component.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedCode === component.id && (
                  <div className="relative group/code">
                    <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                      <code>{component.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(component.code, `${component.id}-code`)}
                      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                    >
                      {copiedCode === `${component.id}-code` ? (
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

      {filteredComponents.length === 0 && (
        <div className="text-center py-12 md:py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Component className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No components found</h3>
          <p className="text-sm text-gray-600 mb-4">Try adjusting your search or filter.</p>
          <Button
            variant="outline"
            onClick={() => {
              setComponentSearch('');
              setSelectedCategory('all');
            }}
            className="border-primary text-primary hover:bg-primary/10"
          >
            Clear Filters
          </Button>
        </div>
      )}

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-black">Component Usage</AlertTitle>
        <AlertDescription className="text-gray-600 text-sm">
          All components are built with shadcn/ui and can be imported directly into your project.
          Copy the code snippets and customise them to match your specific needs. Click the chevron
          to expand code blocks.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export const COMPONENTS_COUNT = 13;
