import { Badge } from '../../../ui/badge';

/** Marks an action that is switched off until its feature is finished. */
export function SoonBadge() {
  return (
    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
      Soon
    </Badge>
  );
}
