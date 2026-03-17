import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { 
  Users, 
  FilePlus, 
  Search, 
  MessageSquare, 
  FileText, 
  Calendar,
  Settings,
  Shield,
  Plus,
  ClipboardCheck
} from 'lucide-react';
import type { QuickActionsCardProps, QuickAction } from '../types';

export function QuickActionsCard({ onModuleChange, customActions }: QuickActionsCardProps) {
  
  const defaultActions: QuickAction[] = [
    {
      id: 'new-client',
      label: 'New Client',
      icon: Users,
      module: 'clients',
      variant: 'default',
    },
    {
      id: 'new-application',
      label: 'New Application',
      icon: FilePlus,
      module: 'applications',
      variant: 'outline',
    },
    {
      id: 'new-advice',
      label: 'New Advice Record',
      icon: ClipboardCheck,
      module: 'advice-engine',
      variant: 'outline',
    },
    {
      id: 'compliance',
      label: 'Compliance Check',
      icon: Shield,
      module: 'compliance',
      variant: 'outline',
    },
    {
      id: 'search-client',
      label: 'Find Client',
      icon: Search,
      module: 'clients',
      variant: 'outline',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      module: 'communication',
      variant: 'outline',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      module: 'calendar',
      variant: 'outline',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      module: 'reporting',
      variant: 'outline',
    }
  ];

  const actions = customActions || defaultActions;

  const handleAction = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick();
    } else if (action.module && onModuleChange) {
      onModuleChange(action.module);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <Settings className="h-5 w-5 mr-2 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>
          Frequently used admin tools
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                className="h-auto py-4 justify-start space-x-3"
                onClick={() => handleAction(action)}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{action.label}</span>
                {action.badgeCount ? (
                  <span className="ml-auto bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                    {action.badgeCount}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
