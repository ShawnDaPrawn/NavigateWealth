import { Link } from 'react-router';
import { Button } from '../../../ui/button';
import { PageHeader, SoonBadge } from '../../layout/page';

/**
 * Compliance module — cleared for a rebuild from scratch.
 *
 * The previous module (overview, CDD, practice registers and reports) was
 * removed in full. Until the new one is built the page says so and points to
 * where compliance work lives today: each client's record (consents, FICA,
 * documents) and Personnel (fit & proper status).
 */
export function ComplianceModule() {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Compliance"
        description={
          <span className="inline-flex items-center gap-2">
            Practice-wide compliance.
            <SoonBadge />
          </span>
        }
      />

      <section className="flex flex-col items-center gap-3 rounded-xl border border-nw-line bg-white px-6 py-14 text-center">
        <h2 className="text-base font-semibold text-nw-ink">Compliance tools are coming soon</h2>
        <p className="max-w-lg text-sm text-nw-text-3">
          Until then, client consents, FICA and compliance documents are on each client’s record,
          and staff fit &amp; proper status is in Personnel.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button asChild variant="outline">
            <Link to="/admin?module=clients">Open Client Management</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin?module=personnel">Open Personnel</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
