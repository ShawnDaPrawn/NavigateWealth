/**
 * Quick-add dialog of the Linktree tab: pick from the template roster,
 * filtered by category, skipping links already added. Pure view over props
 * from LinktreeTab.
 */
/**
 * Linktree Tab — Admin management UI for link-in-bio page
 *
 * CRUD for company links that render on a public /links page.
 * Persisted via KV store linktree:links / linktree:settings.
 *
 * Features:
 *   - Full CRUD for links with reordering
 *   - Quick Add templates for common Navigate Wealth links
 *   - Social profile management (icon row on public page)
 *   - Settings (title, bio, theme)
 *   - Click analytics per link
 *
 * @module social-media/LinktreeTab
 */

import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../../ui/dialog';
import { Link as Plus, Check, Loader2, Zap } from 'lucide-react';
import { BRAND } from '../constants';
import { CATEGORY_LABELS, type QuickAddTemplate } from './linktreeModel';

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickAddCategory: string;
  setQuickAddCategory: (category: string) => void;
  filteredTemplates: QuickAddTemplate[];
  isTemplateAdded: (template: QuickAddTemplate) => boolean;
  addingTemplateId: string | null;
  onQuickAdd: (template: QuickAddTemplate) => void;
}

export function QuickAddDialog({
  open,
  onOpenChange,
  quickAddCategory,
  setQuickAddCategory,
  filteredTemplates,
  isTemplateAdded,
  addingTemplateId,
  onQuickAdd,
}: QuickAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: BRAND.gold }} />
            Quick Add Links
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Pre-configured templates for common Navigate Wealth links. Click to add instantly.
        </p>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 py-1">
          {['all', 'website', 'social', 'contact', 'content'].map((cat) => (
            <Button
              key={cat}
              variant={quickAddCategory === cat ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-xs ${quickAddCategory === cat ? 'text-white' : ''}`}
              style={quickAddCategory === cat ? { backgroundColor: BRAND.navy } : undefined}
              onClick={() => setQuickAddCategory(cat)}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>

        {/* Templates grid */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filteredTemplates.map((template) => {
            const added = isTemplateAdded(template);
            const templateKey = `${template.title}-${template.url}`;
            const isAdding = addingTemplateId === templateKey;

            return (
              <div
                key={templateKey}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  added
                    ? 'bg-green-50/50 border-green-200/50'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0"
                  style={{ backgroundColor: added ? '#dcfce7' : BRAND.navyLight }}
                >
                  <span style={{ color: added ? '#16a34a' : BRAND.navy }}>
                    {added ? <Check className="h-4 w-4" /> : template.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{template.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                </div>
                {added ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-green-700 border-green-300 bg-green-50"
                  >
                    Added
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickAdd(template)}
                    disabled={isAdding}
                    className="h-7 text-xs gap-1"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
