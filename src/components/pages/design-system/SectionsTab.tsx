import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Layers, Copy, CheckCircle, Info, Eye, Code, ChevronDown, Search } from 'lucide-react';
import { copyToClipboard as copyToClipboardUtil } from '../../../utils/clipboard';

const sections = [
  {
    id: 'section-white',
    name: 'White Section',
    type: 'Background',
    description: 'Clean white background section (default) - perfect for main content areas',
    usage: ['Main content', 'Product pages', 'Information sections'],
    textColor: 'Dark',
    code: `<section className="section-white py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-black mb-6">Section Title</h2>
    <p className="text-gray-600">Section content goes here...</p>
  </div>
</section>`,
    className: 'section-white',
  },
  {
    id: 'section-dark-gray',
    name: 'Dark Navy Section (Standard Dark)',
    type: 'Background',
    description:
      'Dark navy (#313653) — the standard dark section used for all heroes and dark alternating sections across every page. Use this as the default choice for any dark background.',
    usage: ['Hero sections', 'Dark alternating sections', 'CTA blocks', 'Testimonial areas'],
    textColor: 'Light',
    code: `<section className="section-dark-gray py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
    <p className="text-gray-300">Section content goes here...</p>
  </div>
</section>`,
    className: 'section-dark-gray',
  },
  {
    id: 'section-black',
    name: 'Black Section',
    type: 'Background',
    description:
      'Pure black background for maximum contrast. Prefer section-dark-gray for standard dark sections.',
    usage: ['High-contrast specials', 'Rare emphasis areas'],
    textColor: 'Light',
    code: `<section className="section-black py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
    <p className="text-gray-300">Section content goes here...</p>
  </div>
</section>`,
    className: 'section-black',
  },
  {
    id: 'gradient-section',
    name: 'Gradient Section',
    type: 'Background',
    description: 'Hero gradient background for impactful sections using charcoal tones',
    usage: ['Hero sections', 'Landing pages', 'Call-to-action areas'],
    textColor: 'Light',
    code: `<section className="bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-white mb-6">Section Title</h2>
  </div>
</section>`,
    className: 'bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800',
  },
  {
    id: 'section-primary',
    name: 'Primary Purple Section',
    type: 'Background',
    description: 'Bold primary purple background for strong call-to-action sections',
    usage: ['CTA sections', 'Promotions', 'Highlights'],
    textColor: 'Light',
    code: `<section className="bg-primary py-20 px-4">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
    <h2 className="text-primary-foreground mb-6">Section Title</h2>
  </div>
</section>`,
    className: 'bg-primary',
  },
  {
    id: 'two-column-layout',
    name: 'Two Column Layout',
    type: 'Layout',
    description: 'Responsive two-column grid layout for content and imagery',
    usage: ['Service pages', 'About sections', 'Feature descriptions'],
    textColor: 'Flexible',
    code: `<div className="grid md:grid-cols-2 gap-12">
  <div>
    <h2 className="text-black mb-6">Column One</h2>
    <p className="text-gray-600">Content...</p>
  </div>
  <div>
    <h2 className="text-black mb-6">Column Two</h2>
    <p className="text-gray-600">Content...</p>
  </div>
</div>`,
    className: 'section-white',
  },
  {
    id: 'three-column-grid',
    name: 'Three Column Grid',
    type: 'Layout',
    description: 'Responsive three-column grid for features, services, or team members',
    usage: ['Features', 'Services grid', 'Team showcase'],
    textColor: 'Flexible',
    code: `<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
  <div className="p-6 bg-gray-50 rounded-lg">
    <h3 className="text-black mb-3">Item One</h3>
    <p className="text-gray-600 text-sm">Description...</p>
  </div>
</div>`,
    className: 'section-white',
  },
  {
    id: 'hero-centered',
    name: 'Centered Hero',
    type: 'Hero',
    description:
      'Centered hero section with title, description, and CTA buttons — section-dark-gray is the standard for all hero backgrounds',
    usage: ['Landing pages', 'Page headers', 'Service intros'],
    textColor: 'Light',
    code: `<section className="section-dark-gray py-24 px-4 text-center">
  <h1 className="text-white mb-6">
    Your Wealth <span className="text-primary">Journey</span>
  </h1>
  <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
    Expert financial guidance tailored to your unique goals
  </p>
  <div className="flex gap-4 justify-center">
    <Button className="bg-primary text-white">Get Started</Button>
    <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">Learn More</Button>
  </div>
</section>`,
    className: 'section-dark-gray',
  },
  {
    id: 'cta-section',
    name: 'Call to Action',
    type: 'CTA',
    description:
      'Focused call-to-action section — can use section-dark-gray for a standard dark CTA, or bg-primary for a high-emphasis purple CTA',
    usage: ['Contact prompts', 'Sign up areas', 'Conversion sections'],
    textColor: 'Light',
    code: `{/* Standard dark CTA */}
<section className="section-dark-gray py-16 px-4 text-center">
  <h2 className="text-white mb-4">Ready to Get Started?</h2>
  <p className="text-xl text-gray-300 mb-8">
    Take the first step towards financial success
  </p>
  <Button className="bg-primary text-white hover:bg-primary/90">
    Schedule Consultation
  </Button>
</section>

{/* High-emphasis purple CTA */}
<section className="bg-primary py-16 px-4 text-center">
  <h2 className="text-primary-foreground mb-4">Ready to Get Started?</h2>
  <Button className="bg-white text-primary hover:bg-gray-100">
    Contact Us Today
  </Button>
</section>`,
    className: 'section-dark-gray',
  },
];

export const SECTIONS_COUNT = sections.length;

export function SectionsTab() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState('');
  const [selectedSectionType, setSelectedSectionType] = useState('all');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await copyToClipboardUtil(code);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sectionTypes = ['all', ...Array.from(new Set(sections.map((s) => s.type)))];

  const filteredSections = sections.filter(
    (s) =>
      (selectedSectionType === 'all' || s.type === selectedSectionType) &&
      (sectionSearch === '' ||
        s.name.toLowerCase().includes(sectionSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(sectionSearch.toLowerCase())),
  );

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">
              Section Layouts
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              Pre-built section templates with consistent spacing, responsive containers, and colour
              schemes. These sections form the building blocks of your pages with standardised
              padding and max-width containers.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {sections.length} Section Types
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">Responsive</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                max-w-screen-2xl
              </Badge>
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
              placeholder="Search sections..."
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedSectionType} onValueChange={setSelectedSectionType}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {sectionTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === 'all' ? 'All Types' : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {sectionTypes.map((type) => {
            const count =
              type === 'all' ? sections.length : sections.filter((s) => s.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setSelectedSectionType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedSectionType === type ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {type === 'all' ? 'All' : type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-6 md:space-y-8">
        {filteredSections.map((section) => (
          <Card
            key={section.id}
            className="border-gray-200 hover:border-primary/30 transition-colors overflow-hidden"
          >
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <CardTitle className="text-lg md:text-xl text-black">{section.name}</CardTitle>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                      {section.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                      {section.textColor} Text
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base text-gray-600 mb-3">
                    {section.description}
                  </CardDescription>
                  {section.usage && section.usage.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                        Common Usage
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {section.usage.map((use) => (
                          <Badge
                            key={use}
                            variant="secondary"
                            className="text-xs bg-primary/10 text-primary"
                          >
                            {use}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(section.code, section.id)}
                  className="border-gray-300 hover:border-primary hover:bg-primary/5 self-start sm:self-auto"
                >
                  {copiedCode === section.id ? (
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
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className={`${section.className} p-6 md:p-10`}>
                    <h4
                      className={`text-xl md:text-2xl font-bold mb-2 ${section.textColor === 'Light' ? 'text-white' : 'text-black'}`}
                    >
                      Section Title
                    </h4>
                    <p
                      className={`text-sm md:text-base ${section.textColor === 'Light' ? 'text-gray-300' : 'text-gray-600'}`}
                    >
                      This is how content appears in this section type. Includes proper spacing and
                      responsive containers.
                    </p>
                    {section.type === 'CTA' && (
                      <div className="mt-6">
                        <Button
                          className={
                            section.className === 'bg-primary'
                              ? 'bg-primary-foreground text-primary hover:bg-gray-100'
                              : 'bg-primary hover:bg-primary/90 text-white'
                          }
                        >
                          Call to Action
                        </Button>
                      </div>
                    )}
                    {section.type === 'Hero' && (
                      <div className="flex flex-col sm:flex-row gap-3 mt-6">
                        <Button className="bg-primary hover:bg-primary/90 text-white">
                          Primary CTA
                        </Button>
                        <Button
                          variant="outline"
                          className={
                            section.textColor === 'Light'
                              ? 'border-white text-white hover:bg-white hover:text-black'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          }
                        >
                          Secondary CTA
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setExpandedCode(expandedCode === section.id ? null : section.id)}
                  className="w-full flex items-center justify-between mb-3 group"
                >
                  <span className="text-sm font-semibold text-black flex items-center">
                    <Code className="h-4 w-4 mr-2 text-primary" />
                    Code
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${expandedCode === section.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedCode === section.id && (
                  <div className="relative group/code">
                    <pre className="text-xs md:text-sm bg-gray-900 text-gray-100 p-4 md:p-6 rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                      <code>{section.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyToClipboard(section.code, `${section.id}-code`)}
                      className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                    >
                      {copiedCode === `${section.id}-code` ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
              <Alert className="border-gray-200 bg-gray-50">
                <Info className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-xs md:text-sm text-gray-600">
                  <strong>Container:</strong> max-w-screen-2xl with responsive padding (px-4 sm:px-6
                  lg:px-8 xl:px-12) &middot; <strong className="ml-2">Spacing:</strong> py-20 (80px)
                  vertical padding
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSections.length === 0 && (
        <div className="text-center py-12 md:py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-black mb-2">No sections found</h3>
          <p className="text-sm text-gray-600 mb-4">Try adjusting your search or filter.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSectionSearch('');
              setSelectedSectionType('all');
            }}
            className="border-primary text-primary hover:bg-primary/10"
          >
            Clear Filters
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
        <Alert className="border-primary/20 bg-primary/5">
          <Layers className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Section Structure</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            All sections use the max-w-screen-2xl container with consistent responsive padding for
            uniform layouts across the site.
          </AlertDescription>
        </Alert>
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-black">Colour Contrast</AlertTitle>
          <AlertDescription className="text-gray-600 text-sm">
            Dark sections use white/light text (text-white, text-gray-300). Light sections use dark
            text (text-black, text-gray-600).
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
