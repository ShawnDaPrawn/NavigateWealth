import { Link } from 'react-router';
import { Download, FileText } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { formatIssueMonth, formatPdfSize, type PublicNewsletter } from './newsletterArchive';

/**
 * One newsletter in the archive: what it is, when it is from, and the two
 * ways to read it.
 *
 * "Read online" is an internal link to the newsletter's own page (indexable
 * and shareable); "Download PDF" is a plain anchor to the public object, so
 * the browser saves the file rather than navigating. `download` is a hint
 * only — it is honoured same-origin and, for cross-origin storage, the
 * Content-Disposition the bucket sets decides. Either way the reader gets
 * the file.
 */
export function NewsletterCard({ newsletter }: { newsletter: PublicNewsletter }) {
  const size = formatPdfSize(newsletter.pdfSizeBytes);
  return (
    <Card className="border-gray-200 transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {formatIssueMonth(newsletter.issueMonth)}
          </p>
          <h4 className="mt-1 text-lg font-semibold text-gray-900">{newsletter.title}</h4>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{newsletter.description}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          <Button asChild variant="default" className="w-full">
            <Link to={`/resources/newsletter/${newsletter.slug}`}>
              <FileText className="mr-2 h-4 w-4" />
              Read online
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href={newsletter.pdfUrl} download={newsletter.pdfFileName}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
          {size && <p className="text-center text-xs text-gray-500">PDF · {size}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default NewsletterCard;
