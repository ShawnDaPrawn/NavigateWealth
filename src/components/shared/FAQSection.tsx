/**
 * FAQSection — visible FAQ accordion for public marketing pages.
 *
 * Renders the same FAQ content that pages emit as FAQPage JSON-LD, satisfying
 * Google's structured-data requirement that marked-up content be visible on
 * the page. Answers are kept mounted in the DOM when collapsed (forceMount)
 * so search engines index the full FAQ text in the rendered document.
 */
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Accordion, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import type { FAQEntry } from '../seo/seo-config';

interface FAQSectionProps {
  faqs: FAQEntry[];
  subtitle?: string;
  className?: string;
}

export function FAQSection({ faqs, subtitle, className }: FAQSectionProps) {
  if (!faqs.length) return null;

  return (
    <section className={cn('py-20 bg-gray-50', className)} aria-label="Frequently asked questions">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-3 font-medium text-[11px] tracking-widest uppercase">
            FAQ
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Frequently Asked Questions
          </h2>
          {subtitle && <p className="text-base text-gray-500 max-w-xl mx-auto">{subtitle}</p>}
        </div>

        <Accordion
          type="multiple"
          defaultValue={['faq-0']}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6"
        >
          {faqs.map((faq, i) => (
            <AccordionItem key={faq.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-base font-semibold text-gray-900">
                {faq.question}
              </AccordionTrigger>
              {/* Bypasses the shared AccordionContent: forceMount keeps collapsed
                  answers in the DOM (hidden via CSS) so crawlers see them. */}
              <AccordionPrimitive.Content
                forceMount
                className="overflow-hidden text-sm data-[state=closed]:hidden"
              >
                <div className="pt-0 pb-4 text-gray-600 leading-relaxed">{faq.answer}</div>
              </AccordionPrimitive.Content>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
