/**
 * FNA Management View
 * Shows a list of all FNAs for a client with the ability to create new ones
 * Similar UI pattern to the Templates screen in Requests module
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Eye, 
  Download, 
  Calendar,
  Loader2,
  ArrowLeft,
  Zap
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface FNASummary {
  id: string;
  clientId: string;
  clientName: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  version: string;
  createdBy: string;
}

interface FNAManagementViewProps {
  clientId: string;
  clientName: string;
  onCreateNew: () => void;
  onViewFNA: (fnaId: string) => void;
  onClose: () => void;
  title?: string;
  apiUrl?: string;
}

export function FNAManagementView({ 
  clientId, 
  clientName, 
  onCreateNew, 
  onViewFNA,
  onClose,
  title = "Risk Planning FNAs",
  apiUrl
}: FNAManagementViewProps) {
  const [fnas, setFnas] = useState<FNASummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFNAs();
  }, [clientId, apiUrl]);

  const loadFNAs = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
      // Default to Risk Planning URL if no custom API URL is provided
      const url = apiUrl || `${API_BASE}/risk-planning-fna/client/${clientId}/list`;
      
      console.log('Loading FNAs from:', url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('FNA list result:', result);

      let fnaList = [];
      if (Array.isArray(result)) {
        fnaList = result;
      } else if (result.success && Array.isArray(result.data)) {
        fnaList = result.data;
      } else if (result.data && Array.isArray(result.data)) {
         // Fallback for some APIs that might return { data: [] } without success flag
         fnaList = result.data;
      } else {
        throw new Error(result.error || 'Failed to load FNAs');
      }

      // Sort by most recent first
      const sortedFnas = fnaList.sort((a: FNASummary, b: FNASummary) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      console.log('Loaded FNAs:', sortedFnas.length);
      setFnas(sortedFnas);
    } catch (err) {
      console.error('Error loading FNAs:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to load FNAs: ${errorMessage}`);
      setFnas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      published: { label: 'Published', variant: 'default' },
      draft: { label: 'Draft', variant: 'secondary' },
      archived: { label: 'Archived', variant: 'outline' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold tracking-tight">
              {title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            View and manage Financial Needs Analyses for {clientName}
          </p>
        </div>
        
        <Button onClick={onCreateNew} size="lg">
          <Zap className="mr-2 h-4 w-4" />
          Run New FNA
        </Button>
      </div>

      {/* Summary Stats */}
      {!isLoading && fnas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total FNAs</div>
              <div className="text-2xl font-bold">{fnas.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Published</div>
              <div className="text-2xl font-bold text-[#6d28d9]">
                {fnas.filter(f => f.status === 'published').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Drafts</div>
              <div className="text-2xl font-bold text-gray-600">
                {fnas.filter(f => f.status === 'draft').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
            </div>
          ) : fnas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No FNAs Found
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Get started by running your first Risk Planning FNA for this client.
              </p>
              <Button onClick={onCreateNew}>
                <Zap className="mr-2 h-4 w-4" />
                Run New FNA
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fnas.map((fna) => (
                  <TableRow key={fna.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#6d28d9]" />
                        {fna.version}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(fna.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(fna.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(fna.updatedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {fna.publishedAt ? (
                        <div className="text-sm text-muted-foreground">
                          {formatDate(fna.publishedAt)}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {fna.createdBy}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewFNA(fna.id)}
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        {fna.status === 'published' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement PDF export for published FNA
                              toast.info('PDF export coming soon');
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}