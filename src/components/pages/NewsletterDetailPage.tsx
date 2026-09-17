import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, FileText, Loader2, Mail } from 'lucide-react';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { siteAbsoluteUrl } from '@/utils/siteOrigin';
import { formatIssueMonth, formatPdfSize } from './resources/newsletterArchive';
import { usePublishedNewsletter } from './resources/useNewsletters';

const ARCHIVE_PATH = '/resources?section=newsletters';

/**
 * One newsletter, on its own page.
 *
 * This is what "Read online" opens. It exists rather than linking straight at
 * the PDF so the issue has a real, indexable address: a title and description
 * in the page source, a canonical URL, and a link that shows something
 * meaningful when it is shared. The PDF itself is embedded from the public
 * bucket and is also offered as a download.
 */
export function NewsletterDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: newsletter, isLoading, error } = usePublishedNewsletter(slug);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading newsletter…
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-[60vh] bg-gray-50">
        <SEO
          title="Newsletter not found | Navigate Wealth"
          description="This newsletter is no longer available."
          robotsContent="noindex, follow"
        />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <Mail className="mx-auto h-10 w-10 text-gray-400" />
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Newsletter not found</h1>
          <p className="mt-2 text-gray-600">
            {error
              ? 'We could not load this newsletter. Please try again shortly.'
              : 'This newsletter may have been moved or withdrawn.'}
          </p>
          <Button asChild className="mt-6">
            <Link to={ARCHIVE_PATH}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all newsletters
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const issue = formatIssueMonth(newsletter.issueMonth);
  const size = formatPdfSize(newsletter.pdfSizeBytes);
  const canonical = siteAbsoluteUrl(`/resources/newsletter/${newsletter.slug}`);
  const seoTitle = `${newsletter.title} | Navigate Wealth Newsletter`;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f5f4_0%,#fafaf9_18%,#ffffff_100%)]">
      <SEO
        title={seoTitle}
        description={newsletter.description}
        canonicalUrl={canonical}
        structuredData={createWebPageSchema(seoTitle, newsletter.description, canonical)}
      />

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="border-stone-300 bg-white/90">
            <Link to={ARCHIVE_PATH}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All newsletters
            </Link>
          </Button>
          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">{issue}</Badge>
        </div>

        <Card className="overflow-hidden border-stone-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-stone-200 px-6 py-8 sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-sky-800">
                    <Mail className="h-4 w-4" />
                    Navigate Wealth newsletter
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
                    {newsletter.title}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                    {newsletter.description}
                  </p>
                </div>
                <Button asChild className="bg-sky-700 hover:bg-sky-800">
                  <a href={newsletter.pdfUrl} download={newsletter.pdfFileName}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </a>
                </Button>
              </div>
            </div>

            <div className="bg-stone-50 px-2 py-4 sm:px-6 sm:py-6">
              {/* A plain <object> rather than a scripted viewer: the browser's
                  own PDF renderer needs no bundle, and the fallback below is
                  what a browser without one shows. */}
              <object
                data={newsletter.pdfUrl}
                type="application/pdf"
                className="h-[70vh] min-h-[420px] w-full rounded-xl border border-stone-200 bg-white"
                aria-label={`${newsletter.title} (PDF)`}
              >
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <FileText className="h-8 w-8 text-stone-400" />
                  <p className="text-sm text-stone-600">
                    Your browser cannot display the PDF here.
                  </p>
                  <Button asChild variant="outline">
                    <a href={newsletter.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Open the PDF in a new tab
                    </a>
                  </Button>
                </div>
              </object>
              {size && (
                <p className="mt-3 text-center text-xs text-stone-500">
                  {newsletter.pdfFileName} · {size}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default NewsletterDetailPage;
