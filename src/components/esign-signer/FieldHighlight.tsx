/**
 * Field Highlight Component
 * Highlights signature/field areas on the document for signers.
 * Shows captured value preview (signature image, text, date, checkbox) when filled.
 * Supports locked state for sequential signing (not signer's turn).
 */

import React from 'react';
import { motion } from 'motion/react';
import { Pen, Type, Calendar, CheckSquare, Lock, Check, CalendarCheck, ChevronDown as ChevronDownIcon } from 'lucide-react';

interface FieldHighlightProps {
  field: {
    id: string;
    type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'auto_date' | 'dropdown';
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    required: boolean;
  };
  zoom: number;
  isFilled: boolean;
  locked?: boolean;
  /** The captured value (data URL for signature/initials, text string for text/date, 'true'/'false' for checkbox) */
  filledValue?: string;
  onClick: () => void;
}

export function FieldHighlight({ field, zoom, isFilled, locked = false, filledValue, onClick }: FieldHighlightProps) {
  const getFieldIcon = () => {
    if (locked) return <Lock className="h-3 w-3" />;
    if (isFilled && field.type === 'checkbox') return <Check className="h-4 w-4 text-green-700" />;
    switch (field.type) {
      case 'signature':
      case 'initials':
        return <Pen className="h-3 w-3" />;
      case 'text':
        return <Type className="h-3 w-3" />;
      case 'date':
        return <Calendar className="h-3 w-3" />;
      case 'checkbox':
        return <CheckSquare className="h-3 w-3" />;
      case 'auto_date':
        return <CalendarCheck className="h-3 w-3" />;
      case 'dropdown':
        return <ChevronDownIcon className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getFieldColor = () => {
    if (locked) {
      return 'border-gray-400/50 cursor-not-allowed';
    }
    if (isFilled) {
      return 'border-green-500 hover:border-green-600';
    }
    return field.required
      ? 'border-yellow-500 hover:border-yellow-600'
      : 'border-blue-500 hover:border-blue-600';
  };

  const getFieldBg = () => {
    if (locked) return 'bg-gray-300/20';
    if (isFilled) return 'bg-green-500/10';
    return field.required ? 'bg-yellow-400/15' : 'bg-blue-400/15';
  };

  const getFieldLabel = () => {
    if (locked) return 'Locked';
    if (isFilled) return 'Completed';
    switch (field.type) {
      case 'signature':
        return 'Sign Here';
      case 'initials':
        return 'Initial Here';
      case 'text':
        return 'Enter Text';
      case 'date':
        return 'Add Date';
      case 'checkbox':
        return 'Check Here';
      case 'auto_date':
        return 'Auto Date';
      case 'dropdown':
        return 'Select';
      default:
        return 'Click Here';
    }
  };

  // Convert field coordinates to percentage-based positioning
  const leftPercent = field.x;
  const topPercent = field.y;
  const widthPercent = (field.width / 595) * 100;
  const heightPercent = (field.height / 842) * 100;

  // Determine if we should show a preview image (signature/initials data URL)
  const isImagePreview = isFilled && filledValue && filledValue.startsWith('data:image') &&
    (field.type === 'signature' || field.type === 'initials');

  const isTextPreview = isFilled && filledValue && !filledValue.startsWith('data:image') &&
    (field.type === 'text' || field.type === 'date' || field.type === 'auto_date' || field.type === 'dropdown');

  const isCheckboxFilled = isFilled && field.type === 'checkbox';

  return (
    <motion.button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      initial={false}
      animate={
        !isFilled && !locked && field.required
          ? { boxShadow: ['0 0 0 0 rgba(234, 179, 8, 0)', '0 0 0 4px rgba(234, 179, 8, 0.3)', '0 0 0 0 rgba(234, 179, 8, 0)'] }
          : {}
      }
      transition={
        !isFilled && !locked && field.required
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : {}
      }
      className={`absolute border-2 rounded-md transition-all pointer-events-auto group z-10 ${
        locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${getFieldColor()} ${getFieldBg()}`}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: `${widthPercent}%`,
        height: `${heightPercent}%`,
      }}
    >
      {/* Filled State: Signature/Initials Image Preview */}
      {isImagePreview && (
        <div className="absolute inset-0.5 flex items-center justify-center overflow-hidden">
          <img
            src={filledValue}
            alt={`${field.type} preview`}
            className="max-h-full max-w-full object-contain"
          />
          {/* Small edit indicator */}
          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-md p-0.5">
            <Check className="h-2.5 w-2.5" />
          </div>
        </div>
      )}

      {/* Filled State: Text/Date Preview */}
      {isTextPreview && (
        <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
          <span className="text-xs text-gray-800 truncate font-medium">{filledValue}</span>
          <div className="absolute top-0 right-0 bg-green-500 text-white rounded-bl-md p-0.5">
            <Check className="h-2.5 w-2.5" />
          </div>
        </div>
      )}

      {/* Filled State: Checkbox */}
      {isCheckboxFilled && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-5 bg-green-500 rounded flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      )}

      {/* Empty/Unfilled State */}
      {!isFilled && !locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
            {getFieldIcon()}
            <span className="truncate">{getFieldLabel()}</span>
          </div>
          {field.required && (
            <span className="text-[9px] text-red-600 font-medium mt-0.5">Required</span>
          )}
        </div>
      )}

      {/* Locked State */}
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-1 overflow-hidden">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
            <Lock className="h-3 w-3" />
            <span className="truncate">Locked</span>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-20">
        {locked
          ? 'Locked — waiting for previous signer'
          : isFilled
            ? `Click to edit ${field.type}`
            : field.required
              ? `Required — Click to ${field.type === 'checkbox' ? 'check' : 'add'} ${field.type}`
              : `Click to add ${field.type}`
        }
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </motion.button>
  );
}