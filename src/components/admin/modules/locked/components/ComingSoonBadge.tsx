/**
 * "Soon" pill shown inside a disabled tab whose content is not built yet
 * (the Locked module's Trading top tab and the Disbursement Clusters subtab).
 * Local to the module so it deletes with it.
 */

import { Badge } from '../../../../ui/badge';

export function ComingSoonBadge() {
  return (
    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] font-normal">
      Soon
    </Badge>
  );
}
