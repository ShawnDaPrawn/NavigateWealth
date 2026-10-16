/**
 * FounderNote — the About page's "A Note From Our Founder" section.
 *
 * The note text and the founder's details come from src/config/companyFacts.ts
 * so the About and Team pages cannot drift apart. `id="founder"` is the target
 * of the hero's "Meet Our Founder" button and of links from the Team page.
 */
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { ResponsiveImage } from '../../shared/ResponsiveImage';
import { COMPANY, FOUNDER } from '@/config/companyFacts';

interface FounderNoteProps {
  onBookConsultation: () => void;
}

export function FounderNote({ onBookConsultation }: FounderNoteProps) {
  return (
    <section
      id="founder"
      className="py-20 section-white scroll-mt-20"
      aria-labelledby="founder-note-heading"
    >
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-10 lg:gap-16 items-start">
          <figure className="mx-auto w-full max-w-sm lg:sticky lg:top-28">
            <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-200 bg-gray-100 aspect-square">
              <ResponsiveImage
                imageKey={FOUNDER.imageKey}
                alt={`${FOUNDER.name}, ${FOUNDER.title} of ${COMPANY.tradingName}`}
                className="w-full h-full object-cover"
                sizes="(min-width: 1024px) 384px, (min-width: 640px) 384px, 90vw"
                width={1254}
                height={1254}
              />
            </div>
            <figcaption className="mt-4 text-center">
              <span className="block text-lg font-semibold text-gray-900">{FOUNDER.name}</span>
              <span className="block text-sm text-gray-600">
                {FOUNDER.title}, {COMPANY.tradingName}
              </span>
            </figcaption>
          </figure>

          <div>
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-6">
              Founder-led practice
            </Badge>
            <h2
              id="founder-note-heading"
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-8"
            >
              A Note From Our Founder
            </h2>

            <div className="space-y-5 text-lg text-gray-700 leading-relaxed">
              {FOUNDER.note.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xl font-semibold text-gray-900">{FOUNDER.name}</p>
              <p className="text-gray-600">
                {FOUNDER.title}, {COMPANY.tradingName}
              </p>
            </div>

            <Button
              onClick={onBookConsultation}
              size="lg"
              className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 px-8 h-12 shadow-lg"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Book a Consultation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FounderNote;
