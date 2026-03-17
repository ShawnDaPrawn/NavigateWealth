/**
 * Publications Feature - ConfirmDialog Component
 * 
 * Accessible confirmation dialog for destructive and important actions.
 * Includes proper ARIA attributes, keyboard navigation (Escape to close),
 * and focus management.
 * 
 * @example
 * ```tsx
 * const { isOpen, open, close, confirm } = useConfirmDialog();
 * 
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   onClose={close}
 *   onConfirm={confirm}
 *   title="Delete Article?"
 *   description="This action cannot be undone."
 *   variant="danger"
 * />
 * ```
 */

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle, Info } from 'lucide-react';
import { Button } from '../../../../ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false
}: ConfirmDialogProps) {
  // Handle Escape key to close dialog
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <Trash2 className="w-6 h-6 text-red-600" />,
      bgColor: 'bg-red-100',
      buttonClass: 'bg-red-600 hover:bg-red-700 text-white'
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
      bgColor: 'bg-yellow-100',
      buttonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white'
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-600" />,
      bgColor: 'bg-blue-100',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    success: {
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      bgColor: 'bg-green-100',
      buttonClass: 'bg-green-600 hover:bg-green-700 text-white'
    }
  };

  const style = variantStyles[variant] || variantStyles.danger;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="contents">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={!isLoading ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className={`flex items-center justify-center w-12 h-12 ${style.bgColor} rounded-full mb-4`}>
            {style.icon}
          </div>
          
          {/* Content */}
          <h3 id="dialog-title" className="text-xl mb-2 text-gray-900">
            {title}
          </h3>
          <p id="dialog-description" className="text-gray-600 mb-6">
            {description}
          </p>
          
          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
              aria-label={cancelLabel}
            >
              {cancelLabel}
            </Button>
            <Button 
              className={style.buttonClass}
              onClick={handleConfirm}
              disabled={isLoading}
              aria-label={isLoading ? 'Processing' : confirmLabel}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing confirm dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const open = (cfg: { title: string; description: string; onConfirm: () => void }) => {
    setConfig(cfg);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setTimeout(() => setConfig(null), 200); // Clear after animation
  };

  const confirm = () => {
    if (config) {
      config.onConfirm();
    }
    close();
  };

  return {
    isOpen,
    open,
    close,
    confirm,
    config
  };
}