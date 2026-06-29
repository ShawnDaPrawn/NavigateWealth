/**
 * SubPanelHeader — the standard header used across the Locked module's panels:
 * a tinted icon chip, a title, an optional subtitle, and an optional
 * right-aligned actions slot (e.g. a "Create" button or a filter Select).
 *
 * Replaces the icon-chip + title + subtitle block that was hand-rolled in
 * RefundManagerPanel, RefundClustersPanel and ClusterDetailView. Local to the
 * module so it deletes with it.
 */

import type { ReactNode } from 'react';

interface SubPanelHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function SubPanelHeader({ icon, title, subtitle, actions }: SubPanelHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
