/**
 * Will Drafting Wizard — Reusable UI Micro-Components
 *
 * These are defined OUTSIDE the main WillDraftingWizard component so React
 * receives stable function references across renders. Defining them inside
 * causes unmount/remount on every state change, destroying input focus and
 * cursor position.
 *
 * Extracted from WillDraftingWizard.tsx (Guidelines S4.1, S8.2)
 */

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Label } from '../../../../ui/label';
import { Card, CardContent } from '../../../../ui/card';

/** Section header inside each step */
export const StepSectionHeader = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 mb-6">
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/** Numbered item card with accent border */
export const ItemCard = ({ index, title, badge, onRemove, accentColor, children }: {
  index: number;
  title: string;
  badge?: React.ReactNode;
  onRemove: () => void;
  accentColor?: string;
  children: React.ReactNode;
}) => (
  <Card className={`border-l-4 overflow-hidden ${accentColor || 'border-l-[#6d28d9]'}`}>
    <div className="flex items-center justify-between px-5 py-3 bg-gray-50/70 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-[#6d28d9] text-white text-xs font-semibold">
          {index}
        </span>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {badge}
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    <CardContent className="p-5">
      {children}
    </CardContent>
  </Card>
);

/** Empty state */
export const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
    <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <Icon className="h-7 w-7 text-gray-400" />
    </div>
    <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
    <p className="text-xs text-gray-500 text-center max-w-xs">{description}</p>
  </div>
);

/** Review section card */
export const ReviewSection = ({ icon: Icon, title, iconColor, children }: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
      <Icon className={`h-4 w-4 ${iconColor}`} />
      <span className="text-sm font-semibold text-gray-800">{title}</span>
    </div>
    <CardContent className="p-5 text-sm">
      {children}
    </CardContent>
  </Card>
);

/** Review data row */
export const ReviewRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-1.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-gray-900 text-right">{value || <span className="text-gray-400 italic">Not provided</span>}</span>
  </div>
);

/** Form field pair wrapper (for 2-column grids) */
export const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
);

/** Form field */
export const FormField = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-gray-700">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
  </div>
);
