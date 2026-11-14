import { ChevronLeft } from 'lucide-react';
import { Tabs, TabsContent } from '../../../../ui/tabs';
import { PageHeader, SegmentedList, SegmentedTrigger } from '../../../layout/page';
import { SingleClientForm } from './SingleClientForm';
import { BulkImportTab } from './BulkImportTab';

export type AddClientView = 'single' | 'bulk';

interface AddClientPageProps {
  view: AddClientView;
  onViewChange: (view: AddClientView) => void;
  /** Back to the client list. */
  onClose: () => void;
  onClientAdded: () => void;
}

/**
 * Add client as a full page (design: CM 3–4) — a long form and an import
 * flow are pages, not dialogs. The view (single client or bulk import) is in
 * the address (?add=single|bulk).
 */
export function AddClientPage({ view, onViewChange, onClose, onClientAdded }: AddClientPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Personal clients
      </button>
      <PageHeader
        title="Add client"
        description="Create one client profile, or import many from a spreadsheet. An application is created for review in Applications."
      />
      <Tabs
        value={view}
        onValueChange={(v) => onViewChange(v as AddClientView)}
        className="flex flex-col gap-5"
      >
        <SegmentedList aria-label="How to add">
          <SegmentedTrigger value="single">Single client</SegmentedTrigger>
          <SegmentedTrigger value="bulk">Bulk import</SegmentedTrigger>
        </SegmentedList>
        <TabsContent value="single" className="mt-0 max-w-[960px]">
          <SingleClientForm onSuccess={onClientAdded} onClose={onClose} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-0">
          <BulkImportTab onSuccess={onClientAdded} onClose={onClose} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
