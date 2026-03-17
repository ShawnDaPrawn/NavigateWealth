import React, { useMemo } from 'react';
import { DataTable, Column } from '../../../components/DataTable';
import { Personnel, UserRole, PermissionSet } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from '../../../../ui/avatar';
import { Badge } from '../../../../ui/badge';
import { CheckCircle, XCircle, Clock, Briefcase } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { PermissionSummaryBadge } from './PermissionSummaryBadge';
import { useAllPermissions } from '../hooks';

interface PersonnelTableProps {
  data: Personnel[];
  onRowClick: (person: Personnel) => void;
  roles: Record<string, { label: string; color: string }>;
}

/** Map status to a visual indicator */
function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    active: { icon: CheckCircle, color: 'text-green-500', label: 'Active' },
    suspended: { icon: XCircle, color: 'text-red-500', label: 'Suspended' },
    pending: { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', c.color)} />
      <span className="text-sm capitalize">{c.label}</span>
    </div>
  );
}

export function PersonnelTable({ data, onRowClick, roles }: PersonnelTableProps) {
  // Bulk-fetch all permission sets for the summary column
  const { data: allPermissions = [], isLoading: permissionsLoading } = useAllPermissions();

  // Build a lookup map: personnelId → PermissionSet
  const permissionsMap = useMemo(() => {
    const map = new Map<string, PermissionSet>();
    for (const perm of allPermissions) {
      if (perm?.personnelId) {
        map.set(perm.personnelId, perm);
      }
    }
    return map;
  }, [allPermissions]);

  const columns: Column<Personnel>[] = [
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      render: (_, person) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-gray-200">
            <AvatarImage src={`/api/placeholder/36/36`} />
            <AvatarFallback className="text-xs font-medium bg-purple-50 text-purple-700">
              {(person.firstName?.[0] || '').toUpperCase()}
              {(person.lastName?.[0] || '').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium text-sm text-gray-900 truncate">
              {person.firstName} {person.lastName}
            </div>
            <div className="text-xs text-muted-foreground truncate">{person.email}</div>
          </div>
        </div>
      ),
      width: '260px',
    },
    {
      key: 'role',
      title: 'Role',
      sortable: true,
      render: (role) => {
        const roleInfo = roles[role as string] || {
          label: role as string,
          color: 'bg-gray-100 text-gray-700',
        };
        return (
          <Badge
            variant="secondary"
            className={cn('text-[11px] font-medium border-0 px-2 py-0.5', roleInfo.color)}
          >
            {roleInfo.label}
          </Badge>
        );
      },
      width: '150px',
    },
    {
      key: 'jobTitle',
      title: 'Title',
      render: (title) =>
        title ? (
          <span className="text-sm text-gray-600 truncate max-w-[180px] inline-block">
            {title}
          </span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
      width: '180px',
    },
    {
      key: 'status',
      title: 'Status',
      render: (status) => <StatusIndicator status={status as string} />,
      width: '110px',
    },
    {
      key: 'id',
      title: 'Permissions',
      render: (_, person) => (
        <PermissionSummaryBadge
          email={person.email}
          role={person.role}
          permissionSet={permissionsMap.get(person.id)}
          isLoading={permissionsLoading}
        />
      ),
      width: '160px',
    },
    {
      key: 'commissionSplit',
      title: 'Commission',
      render: (split) =>
        split != null && split > 0 ? (
          <span className="text-sm font-medium text-gray-700">
            {(split * 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
      width: '100px',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowClick={onRowClick}
      searchable={false}
      exportable={false}
    />
  );
}
