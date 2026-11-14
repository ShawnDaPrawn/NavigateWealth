import React, { useMemo } from 'react';
import { DataTable, Column } from '../../../components/DataTable';
import { Personnel, PermissionSet } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from '../../../../ui/avatar';

import { cn } from '../../../../ui/utils';
import { PermissionSummaryBadge } from './PermissionSummaryBadge';
import { useAllPermissions } from '../hooks';

interface PersonnelTableProps {
  data: Personnel[];
  onRowClick: (person: Personnel) => void;
  roles: Record<string, { label: string; color: string }>;
}

/** Status as the board's pill (PE-List). */
function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { tone: string; label: string }> = {
    active: { tone: 'ok', label: 'Active' },
    suspended: { tone: 'bad', label: 'Suspended' },
    pending: { tone: 'warn', label: 'Pending' },
  };
  const c = config[status] || config.pending;
  return <span className={cn('ds-pill', c.tone)}>{c.label}</span>;
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
          <Avatar className="h-8 w-8">
            <AvatarImage src={`/api/placeholder/32/32`} />
            <AvatarFallback className="bg-nw-violet-100 text-xs font-semibold text-nw-violet-600">
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
        return <span>{roleInfo.label}</span>;
      },
      width: '150px',
    },
    {
      key: 'jobTitle',
      hideOnMobile: true,
      title: 'Title',
      render: (title) =>
        title ? (
          <span className="text-sm text-gray-600 truncate max-w-[180px] inline-block">
            {String(title)}
          </span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
      width: '180px',
    },
    {
      key: 'status',
      hideOnMobile: true,
      title: 'Status',
      render: (status) => <StatusIndicator status={status as string} />,
      width: '110px',
    },
    {
      key: 'id',
      hideOnMobile: true,
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
      hideOnMobile: true,
      title: 'Commission',
      render: (split) =>
        split != null && Number(split) > 0 ? (
          <span className="text-sm font-medium text-gray-700">
            {(Number(split) * 100).toFixed(0)}%
          </span>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        ),
      width: '100px',
    },
  ];

  return (
    <DataTable
      columns={columns as unknown as React.ComponentProps<typeof DataTable>['columns']}
      data={data as unknown as React.ComponentProps<typeof DataTable>['data']}
      onRowClick={onRowClick as unknown as React.ComponentProps<typeof DataTable>['onRowClick']}
      searchable={false}
      exportable={false}
    />
  );
}
