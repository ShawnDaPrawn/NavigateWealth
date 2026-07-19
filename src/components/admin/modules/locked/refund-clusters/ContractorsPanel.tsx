/**
 * Contractors section of the Locked module's Accounts area.
 *
 * Home for contractor profiles, invoice templates and agreement templates.
 * Placeholder for now — the tab and its shell exist so the feature can be built
 * out in place. Local to the module so it deletes with it.
 */

import { HardHat } from 'lucide-react';
import { SubPanelHeader } from './components/SubPanelHeader';

export function ContractorsPanel() {
  return (
    <div className="space-y-4">
      <SubPanelHeader
        icon={<HardHat />}
        title="Contractors"
        subtitle="Contractor profiles, invoice templates and agreement templates."
      />

      <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
        Nothing here yet. Contractor profiles, invoice templates and agreement templates will live
        on this tab.
      </div>
    </div>
  );
}
