/**
 * CategoryLegend — Sidebar card showing all category icons and labels.
 * Config-driven from constants (§5.3).
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { ALL_CATEGORIES, CATEGORY_CONFIG } from '../constants';

export function CategoryLegend() {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ALL_CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          return (
            <div key={cat} className="flex items-center gap-2 text-sm text-gray-600">
              <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
