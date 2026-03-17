import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { 
  History, 
  Mail, 
  MessageSquare, 
  Search, 
  Calendar,
  Users,
  User,
  FileText,
  Paperclip,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ActivityLogEntry, CommunicationChannel, RecipientType } from '../types';
import { communicationApi } from '../api';

interface CommunicationHistoryProps {
  onClose?: () => void;
}

export function CommunicationHistory({ onClose }: CommunicationHistoryProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await communicationApi.getHistory();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Failed to load communication history');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.messagePreview.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.subject && log.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = channelFilter === 'all' || log.channel === channelFilter;
    const matchesRecipient = recipientFilter === 'all' || log.recipientType === recipientFilter;
    const matchesUser = userFilter === 'all' || log.userName === userFilter;

    return matchesSearch && matchesChannel && matchesRecipient && matchesUser;
  });

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChannelIcon = (channel: CommunicationChannel) => {
    return channel === 'email' ? (
      <Mail className="h-4 w-4" />
    ) : (
      <MessageSquare className="h-4 w-4" />
    );
  };

  const getRecipientIcon = (type: RecipientType) => {
    return type === 'group' ? (
      <Users className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'sent':
        return <Badge className="bg-green-600">Sent</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Scheduled</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'sending':
        return <Badge className="bg-blue-600 animate-pulse">Sending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getUniqueUsers = () => {
    const users = Array.from(new Set(logs.map(log => log.userName)));
    return users.sort();
  };

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const currentLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Communication History
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadHistory} disabled={loading} aria-label="Refresh history">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search communications..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>

          <Select value={recipientFilter} onValueChange={(v) => { setRecipientFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="single">Single Client</SelectItem>
              <SelectItem value="group">Client Group</SelectItem>
              <SelectItem value="multiple">Multiple Clients</SelectItem>
            </SelectContent>
          </Select>

          <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {getUniqueUsers().map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {filteredLogs.length} communication{filteredLogs.length !== 1 ? 's' : ''} found
          </span>
          {(searchTerm || channelFilter !== 'all' || recipientFilter !== 'all' || userFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setChannelFilter('all');
                setRecipientFilter('all');
                setUserFilter('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Communications Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Subject/Preview</TableHead>
                <TableHead>Sent By</TableHead>
                <TableHead>Attachments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : currentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {error ? (
                      <span className="text-red-500">{error}</span>
                    ) : (
                      "No communications found matching your filters"
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                currentLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getChannelIcon(log.channel)}
                        <Badge variant={log.channel === 'email' ? 'outline' : 'secondary'}>
                          {log.channel === 'email' ? 'Email' : 'WhatsApp'}
                        </Badge>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRecipientIcon(log.recipientType)}
                        <span className="font-medium">{log.recipientCount}</span>
                        <span className="text-sm text-muted-foreground">
                          {log.recipientType === 'group' ? 'Group' : (log.recipientType === 'multiple' ? 'Clients' : 'Client')}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="max-w-xs">
                      <div className="space-y-1">
                        {log.subject && (
                          <div className="font-medium text-sm line-clamp-1">
                            {log.subject}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {log.messagePreview}
                        </div>
                        {log.templateUsed && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {log.templateUsed}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="font-medium text-sm">{log.userName}</span>
                    </TableCell>
                    
                    <TableCell>
                      {log.attachmentCount > 0 ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                          {log.attachmentCount}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} to{' '}
              {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of{' '}
              {filteredLogs.length} results
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}