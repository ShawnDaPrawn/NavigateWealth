/**
 * Empty State Component
 * Displays unique initial states for each profile tab
 */

import React from 'react';
import { Button } from '../../ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  iconColor?: string;
  iconBgColor?: string;
  buttonColor?: string;
  buttonHoverColor?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  iconColor = 'text-[#6d28d9]',
  iconBgColor = 'bg-[#6d28d9]/10',
  buttonColor = 'bg-[#6d28d9]',
  buttonHoverColor = 'hover:bg-[#5b21b6]',
  secondaryAction,
}) => {
  return (
    <div className="text-center py-16 px-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-300">
      <div className={`mx-auto h-20 w-20 rounded-full ${iconBgColor} flex items-center justify-center mb-6`}>
        <Icon className={`h-10 w-10 ${iconColor}`} />
      </div>
      
      <h3 className="text-xl text-gray-900 mb-3">
        {title}
      </h3>
      
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
        {description}
      </p>
      
      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={onAction}
          className={`${buttonColor} text-white ${buttonHoverColor} px-6`}
        >
          {actionLabel}
        </Button>
        
        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};
