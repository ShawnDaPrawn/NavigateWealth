import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Clock, Shield, Monitor, MapPin, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

import { ActivityLogEntry } from '../../utils/auth/securityTypes';

interface ActivityLogTableProps {
  logs: ActivityLogEntry[];
  isLoading?: boolean;
  title?: string;
  description?: string;
}

export function ActivityLogTable({ 
  logs, 
  isLoading = false, 
  title = "Activity Log",
  description = "Recent security events and account activity"
}: ActivityLogTableProps) {

  const formatEventType = (type: string) => {
    return type.split('_').map(word => {
      // Preserve well-known acronyms
      if (word.toLowerCase() === '2fa') return '2FA';
      if (word.toLowerCase() === 'ip') return 'IP';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const getEventIcon = (type: string, success: boolean) => {
    if (!success) return <XCircle className="h-4 w-4 text-red-500" />;
    
    if (type.includes('login')) return <Monitor className="h-4 w-4 text-blue-500" />;
    if (type.includes('password')) return <Shield className="h-4 w-4 text-purple-500" />;
    if (type.includes('signup')) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (type.includes('locked')) return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  const getDeviceName = (userAgent?: string) => {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPad')) return 'iPad';
    return 'Browser';
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading activity...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent activity found.</div>
        ) : (
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Device / IP</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEventIcon(log.type, log.success)}
                        <span className="font-medium text-sm">
                          {formatEventType(log.type)}
                        </span>
                      </div>
                      {log.errorMessage && !log.success && (
                        <p className="text-xs text-red-500 mt-1 pl-6">
                          {log.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.success ? 'outline' : 'destructive'}
                        className={log.success 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : 'bg-red-50 text-red-700 border-red-200'
                        }
                      >
                        {log.success ? 'Success' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                           <Monitor className="h-3 w-3" />
                           {getDeviceName(log.userAgent)}
                        </div>
                        {log.ip && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {log.ip}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}