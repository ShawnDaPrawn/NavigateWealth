import React from 'react';
import { Users, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { ClientGroup } from '../../types';

interface GroupListProps {
  groups: ClientGroup[];
  onEdit: (group: ClientGroup) => void;
  onDelete: (id: string) => void;
  onSelectGroup?: (group: ClientGroup) => void;
}

export function GroupList({ groups, onEdit, onDelete, onSelectGroup }: GroupListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map(group => (
        <Card key={group.id} className="relative hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <Badge variant="outline">Custom</Badge>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(group)} aria-label="Edit group">
                  <Edit2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(group.id)} aria-label="Delete group">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
            <CardTitle className="mt-2">{group.name}</CardTitle>
            <CardDescription className="line-clamp-2 h-10">{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {group.clientCount} members
                </div>
                {group.externalContacts && group.externalContacts.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200">
                    {group.externalContacts.length} external
                  </Badge>
                )}
              </div>
              <span>
                {new Date(group.updatedAt || group.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-4">
                {group.filterConfig?.productFilters && group.filterConfig.productFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Product Rules</Badge>
                )}
                {group.filterConfig?.netWorthFilters && group.filterConfig.netWorthFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Net Worth Rules</Badge>
                )}
                {group.filterConfig?.ageFilters && group.filterConfig.ageFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Age Rules</Badge>
                )}
                {(group.filterConfig?.maritalStatusFilters?.length || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Marital Status</Badge>
                )}
                {(group.filterConfig?.employmentStatusFilters?.length || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Employment Status</Badge>
                )}
                {(group.filterConfig?.genderFilters?.length || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Gender</Badge>
                )}
                {(group.filterConfig?.countryFilters?.length || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Country</Badge>
                )}
                {group.filterConfig?.incomeFilters && group.filterConfig.incomeFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Income Range</Badge>
                )}
                {(group.filterConfig?.occupationFilters?.length || 0) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Occupation</Badge>
                )}
                {group.filterConfig?.dependantCountFilters && group.filterConfig.dependantCountFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Dependants</Badge>
                )}
                {group.filterConfig?.retirementAgeFilters && group.filterConfig.retirementAgeFilters.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Retirement Age</Badge>
                )}
            </div>

            {onSelectGroup && (
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={() => onSelectGroup(group)}
              >
                Use This Group
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}