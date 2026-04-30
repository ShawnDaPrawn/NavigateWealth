/**
 * Previous FNAs Dialog
 * Shows historical published FNAs for a client
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { Eye, Loader2, FileText, Calendar, User } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

interface PreviousFNAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onViewFNA: (fnaId: string) => void;
  title?: string;
  apiUrl?: string;
}

interface FNASummary {
  id: string;
  clientId: string;
  clientName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  version?: number;
  createdBy: string;
}

export function PreviousFNAsDialog({
  open,
  onOpenChange,
  clientId,
  onViewFNA,
  title = "Previous Risk Planning FNAs",
  apiUrl
}: PreviousFNAsDialogProps) {
  const [fnas, setFnas] = useState<FNASummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && clientId) {
      loadFNAs();
    }
  }, [open, clientId, apiUrl]);

  const loadFNAs = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Default to Risk Planning URL if no custom API URL is provided
      const url = apiUrl || `${API_BASE}/risk-planning-fna/client/${clientId}/list`;
      
      const res = await fetch(
        url,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to load FNAs');
      }

      const result = await res.json();
      
      let fnaList: FNASummary[] = [];
      if (Array.isArray(result)) {
        fnaList = result;
      } else if (result.success && Array.isArray(result.data)) {
        fnaList = result.data;
      } else if (result.data && Array.isArray(result.data)) {
        fnaList = result.data;
      }

      // Filter to only show published FNAs and sort by published date (newest first)
      const publishedFnas = fnaList
        .filter((fna: FNASummary) => fna.status === 'published')
        .sort((a: FNASummary, b: FNASummary) => {
          const dateA = new Date(a.publishedAt || a.updatedAt).getTime();
          const dateB = new Date(b.publishedAt || b.updatedAt).getTime();
          return dateB - dateA;
        });
      
      setFnas(publishedFnas);
    } catch (err) {
      console.error('Error loading previous FNAs:', err);
      toast.error('Failed to load previous FNAs');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6d28d9]" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            View historical Financial Needs Analyses for this client
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
            </div>
          ) : fnas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Previous FNAs Found
              </h3>
              <p className="text-sm text-gray-600">
                There are no published FNAs for this client yet.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published Date</TableHead>
                    <TableHead>Published By</TableHead>
                    <TableHead>Created Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fnas.map((fna) => (
                    <TableRow key={fna.id}>
                      <TableCell className="font-medium">
                        v{fna.version || 'N/A'}
                      </TableCell>
                      <TableCell>{getStatusBadge(fna.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {fna.publishedAt
                            ? new Date(fna.publishedAt).toLocaleDateString('en-ZA', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {fna.publishedBy || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(fna.createdAt).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onViewFNA(fna.id);
                            onOpenChange(false);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PreviousFNAsDialog;
