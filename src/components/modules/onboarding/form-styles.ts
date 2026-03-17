/**
 * Shared form styling constants for onboarding step components.
 *
 * Centralises input, select, label, and section styling to ensure
 * visual consistency and clear field distinction across all steps.
 *
 * The base Design System input uses `border-input` (transparent) and
 * `bg-input-background` (#f8f9fa), which renders fields nearly invisible
 * on light section backgrounds. These overrides restore clear borders,
 * proper height, and focus states.
 *
 * Guidelines refs: §5.3 (centralised constants), §8.3 (form patterns)
 */

/** Standard text input — white bg, visible border, proper height */
export const INPUT_CLASS =
  'mt-1.5 h-11 bg-white border-gray-300 shadow-sm placeholder:text-gray-400 focus:border-[#6d28d9] focus:ring-2 focus:ring-[#6d28d9]/20';

/** Select trigger — matches input height and border visibility */
export const SELECT_TRIGGER_CLASS =
  'mt-1.5 h-11 bg-white border-gray-300 shadow-sm focus:border-[#6d28d9] focus:ring-2 focus:ring-[#6d28d9]/20';

/** Textarea — visible border, proper styling */
export const TEXTAREA_CLASS =
  'mt-1.5 bg-white border-gray-300 shadow-sm placeholder:text-gray-400 focus:border-[#6d28d9] focus:ring-2 focus:ring-[#6d28d9]/20';

/** Field label — high contrast, clear weight */
export const LABEL_CLASS = 'text-sm font-semibold text-gray-800';

/** Section container — white card with clear border and subtle shadow */
export const SECTION_CONTAINER_CLASS =
  'bg-white border border-gray-200 rounded-xl p-5 shadow-sm';

/** Section container with internal spacing */
export const SECTION_CONTAINER_SPACED_CLASS =
  'bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5';

/** Required field asterisk */
export const REQUIRED = ' *';
