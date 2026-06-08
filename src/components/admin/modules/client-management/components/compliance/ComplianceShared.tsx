import React from 'react';
import { Card, CardContent } from '../../../../../ui/card';

export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="bg-gray-50 p-2 rounded-lg">{icon}</div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickActionCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-lg border transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}
