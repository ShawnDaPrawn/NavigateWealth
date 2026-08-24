/**
 * The design-system section catalogue.
 *
 * Pure data, split out of SectionsTab.tsx so that file exports its component
 * only — a module mixing component and non-component exports defeats React
 * Fast Refresh (react-refresh/only-export-components). PartnershipSection
 * reads SECTIONS_COUNT from here to show the template count.
 */
export const sections = [
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
