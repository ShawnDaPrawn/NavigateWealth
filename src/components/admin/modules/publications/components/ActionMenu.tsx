/**
 * Publications Feature - ActionMenu Component
 * 
 * Dropdown menu for article/category actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  className?: string;
}

export function ActionMenu({ items, className }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (item: ActionMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  return (
    <div ref={menuRef} className={`relative ${className || ''}`}>
      {/* Trigger Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical className="w-5 h-5 text-gray-600" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          {items.map((item, index) => {
            const variantClasses = {
              default: 'text-gray-700 hover:bg-gray-50',
              danger: 'text-red-600 hover:bg-red-50'
            };

            const variant = item.variant || 'default';
            const classes = variantClasses[variant];

            return (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(item);
                }}
                disabled={item.disabled}
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors first:rounded-t-lg last:rounded-b-lg ${classes} ${
                  item.disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
