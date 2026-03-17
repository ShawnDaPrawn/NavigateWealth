/**
 * Applications Table
 *
 * Data table for listing client applications with search, status filtering,
 * and row-level actions. Follows admin panel table conventions (consistent
 * column sizing, hover states, action visibility).
 *
 * §8.3 — Matches existing table patterns across the admin panel.
 */

import React from 'react';
import { Application, TabStatus } from '../types';
import { formatDate } from '../utils';
import { StatusBadge } from './StatusBadge';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Input } from '../../../../ui/input';
import { Avatar, AvatarFallback } from '../../../../ui/avatar';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Search,
  RefreshCw,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Clock,
  Fingerprint,
  Send,
  MoreHorizontal,
  Hash,
  Inbox,
  RotateCw,
  Target,
  Package,
  ClipboardEdit,
} from 'lucide-react';

interface ApplicationsTableProps {
  loading: boolean;
  refreshing: boolean;
  activeTab: TabStatus;
  applications: Application[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  onReview: (app: Application) => void;
  onApprove: (app: Application) => void;
  onDecline: (app: Application) => void;
  onResendInvite?: (app: Application) => void;
  onCompleteOnBehalf?: (app: Application) => void;
  resendingInviteId?: string | null;
}

/** Tab-specific empty state configuration */
const EMPTY_STATE_CONFIG: Record<TabStatus, { icon: React.ElementType; title: string; description: string }> = {
  pending: {
    icon: Inbox,
    title: 'No pending applications',
    description: 'New client applications will appear here for your review.',
  },
  invited: {
    icon: Send,
    title: 'No invited applicants',
    description: 'Use "Invite Applicant" to send an invitation to a prospective client.',
  },
  approved: {
    icon: CheckCircle2,
    title: 'No approved applications yet',
    description: 'Approved applications will appear here after review.',
  },
  rejected: {
    icon: XCircle,
    title: 'No rejected applications',
    description: 'Rejected applications will be listed here for reference.',
  },
};

const TAB_LABELS: Record<TabStatus, string> = {
  pending: 'Pending Review',
  invited: 'Invited',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function ApplicationsTable({
  loading,
  refreshing,
  activeTab,
  applications,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onReview,
  onApprove,
  onDecline,
  onResendInvite,
  onCompleteOnBehalf,
  resendingInviteId,
}: ApplicationsTableProps) {
  // Filter applications by tab status
  const statusMap: Record<TabStatus, string[]> = {
    pending: ['submitted'],
    approved: ['approved'],
    rejected: ['declined'],
    invited: ['invited'],
  };

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusMap[activeTab]?.includes(app.status);
    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const data = app.application_data;
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.toLowerCase();
    const email = (data.emailAddress || app.user_email || '').toLowerCase();
    const phone = (data.cellphoneNumber || '').toLowerCase();
    const id = (data.idNumber || '').toLowerCase();
    const appNumber = (app.application_number || '').toLowerCase();

    return fullName.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q) || appNumber.includes(q);
  });

  const getInitials = (app: Application) => {
    const first = app.application_data.firstName?.[0] || '';
    const last = app.application_data.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const getFullName = (app: Application) => {
    const parts = [
      app.application_data.title,
      app.application_data.firstName,
      app.application_data.lastName,
    ].filter(Boolean);
    return parts.join(' ') || app.user_name || 'Unknown';
  };

  const getOriginBadge = (app: Application) => {
    if (app.origin === 'admin_invite') {
      return { label: 'Invited', className: 'bg-indigo-50 text-indigo-700 border-indigo-200/60' };
    }
    if (app.origin === 'admin_import') {
      return { label: 'Import', className: 'bg-blue-50 text-blue-700 border-blue-200/60' };
    }
    return { label: 'Self-service', className: 'bg-gray-50 text-gray-600 border-gray-200/60' };
  };

  const getServicesCount = (app: Application) => {
    return (app.application_data.accountReasons || []).length;
  };

  const getExistingProductsCount = (app: Application) => {
    return (app.application_data.existingProducts || []).filter(p => p !== 'None of the above').length;
  };

  const isPendingLike = activeTab === 'pending' || activeTab === 'invited';

  if (loading) {
    return (
      <Card className="overflow-hidden border-gray-200">
        <CardHeader className="border-b border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-72 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-4 py-3 border-b bg-gray-50/30">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-32' : i === 6 ? 'w-16 ml-auto' : 'w-20'}`} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 w-[260px]">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3.5 w-24 font-mono" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <div className="ml-auto flex gap-1">
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const emptyConfig = EMPTY_STATE_CONFIG[activeTab];
  const EmptyIcon = emptyConfig.icon;

  return (
    <Card className="overflow-hidden border-gray-200">
      {/* Table Toolbar */}
      <CardHeader className="border-b border-gray-200 bg-white p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, phone, or application #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-medium text-xs px-2.5 py-1 bg-gray-100 text-gray-600 border border-gray-200">
              {filteredApplications.length} {filteredApplications.length === 1 ? 'result' : 'results'}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onRefresh} variant="outline" size="sm" disabled={refreshing} className="h-8 w-8 p-0 border-gray-200">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      {/* Table */}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/60 hover:bg-gray-50/60 border-b border-gray-200">
              <TableHead className="w-[240px] font-semibold text-[11px] uppercase tracking-wider text-gray-500 pl-4 py-3">
                Applicant
              </TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 py-3">
                Contact
              </TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 py-3">
                ID Number
              </TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 py-3">
                Status
              </TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 py-3">
                {activeTab === 'invited' ? 'Invited' : 'Submitted'}
              </TableHead>
              <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 py-3">
                Origin
              </TableHead>
              <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider text-gray-500 pr-4 py-3">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                      <EmptyIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 text-sm">
                        {searchQuery ? 'No matching applications' : emptyConfig.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {searchQuery
                          ? 'Try adjusting your search query or clearing the filter.'
                          : emptyConfig.description}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredApplications.map((app) => {
                const data = app.application_data;
                const originBadge = getOriginBadge(app);
                const servicesCount = getServicesCount(app);
                const productsCount = getExistingProductsCount(app);

                return (
                  <TableRow
                    key={app.id}
                    className="group hover:bg-purple-50/30 transition-colors cursor-pointer border-b border-gray-100"
                    onClick={() => onReview(app)}
                  >
                    {/* Applicant */}
                    <TableCell className="pl-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-[#6d28d9]/10 to-purple-100 text-[#6d28d9]">
                            {getInitials(app)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{getFullName(app)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {app.application_number && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-0.5 font-mono">
                                <Hash className="h-2.5 w-2.5" />
                                {app.application_number}
                              </span>
                            )}
                            {servicesCount > 0 && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200/60 rounded px-1 py-px flex items-center gap-0.5">
                                      <Target className="h-2.5 w-2.5" />
                                      {servicesCount}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">{servicesCount} service{servicesCount !== 1 ? 's' : ''} requested</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {productsCount > 0 && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[10px] text-orange-600 bg-orange-50 border border-orange-200/60 rounded px-1 py-px flex items-center gap-0.5">
                                      <Package className="h-2.5 w-2.5" />
                                      {productsCount}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">{productsCount} existing product{productsCount !== 1 ? 's' : ''}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="truncate max-w-[180px]">
                            {data.emailAddress || app.user_email || '\u2014'}
                          </span>
                        </div>
                        {data.cellphoneNumber && (
                          <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span>{data.cellphoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* ID Number */}
                    <TableCell className="py-3">
                      {data.idNumber ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                <Fingerprint className="h-3.5 w-3.5 text-gray-400" />
                                <span className="font-mono text-xs">
                                  {data.idNumber.slice(0, 6)}••••{data.idNumber.slice(-2)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {data.idType === 'passport' ? 'Passport' : 'SA ID'}: Partially masked
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-gray-300">&mdash;</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3">
                      <StatusBadge status={app.status} />
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{formatDate(app.submitted_at || app.created_at)}</span>
                      </div>
                    </TableCell>

                    {/* Origin */}
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`text-[10px] font-medium border ${originBadge.className}`}>
                        {originBadge.label}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onReview(app)} className="text-xs">
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            Review Details
                          </DropdownMenuItem>

                          {isPendingLike && (
                            <div className="contents">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onApprove(app)}
                                className="text-xs text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDecline(app)}
                                className="text-xs text-red-700 focus:text-red-700 focus:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </div>
                          )}

                          {activeTab === 'invited' && onResendInvite && (
                            <div className="contents">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onResendInvite(app)}
                                disabled={resendingInviteId === app.id}
                                className="text-xs"
                              >
                                {resendingInviteId === app.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                ) : (
                                  <RotateCw className="h-3.5 w-3.5 mr-2" />
                                )}
                                Resend Invite
                              </DropdownMenuItem>
                            </div>
                          )}

                          {activeTab === 'pending' && onCompleteOnBehalf && (
                            <div className="contents">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onCompleteOnBehalf(app)}
                                className="text-xs"
                              >
                                <ClipboardEdit className="h-3.5 w-3.5 mr-2" />
                                Complete on Behalf
                              </DropdownMenuItem>
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}