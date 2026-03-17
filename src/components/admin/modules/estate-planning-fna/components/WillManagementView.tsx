/**
 * Will Management View
 * Shows a list of all wills (Last Will & Testament and Living Wills) for a client.
 * Supports attaching scanned signed copies to finalized/published wills.
 * Similar UI pattern to FNA Management View.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Eye, 
  Download, 
  Calendar,
  Loader2,
  ArrowLeft,
  Scroll,
  Heart,
  Pencil,
  Trash2,
  Bot,
  Upload,
  Paperclip,
  CheckCircle2,
  FileDown,
  X,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { downloadWillPdf, type WillRecord } from '../utils/will-pdf-generator';
import { WillChatInterface } from './WillChatInterface';

interface WillSummary {
  id: string;
  clientId: string;
  clientName: string;
  type: 'last_will' | 'living_will';
  status: 'draft' | 'published' | 'finalized' | 'signed' | 'archived';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  signedDocumentPath?: string;
  signedDocumentFileName?: string;
  signedDocumentFileSize?: number;
  signedAt?: string;
  signedBy?: string;
  version: string;
  createdBy?: string;
}

interface WillManagementViewProps {
  clientId: string;
  clientName: string;
  onDraftLastWill: () => void;
  onDraftLivingWill: () => void;
  onViewWill: (willId: string) => void;
  onResumeDraft: (willId: string, willType: 'last_will' | 'living_will') => void;
  onClose: () => void;
  /** Optional callback for opening the AI Will Builder from a parent */
  onAIWillBuilder?: () => void;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

export function WillManagementView({ 
  clientId, 
  clientName, 
  onDraftLastWill,
  onDraftLivingWill,
  onViewWill,
  onResumeDraft,
  onClose,
  onAIWillBuilder,
}: WillManagementViewProps) {
  const [wills, setWills] = useState<WillSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingWillId, setDownloadingWillId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'last_will' | 'living_will'>('all');
  const [discardTarget, setDiscardTarget] = useState<WillSummary | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [showAIWillBuilder, setShowAIWillBuilder] = useState(false);

  // Signed document upload state
  const [attachTarget, setAttachTarget] = useState<WillSummary | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [downloadingSignedId, setDownloadingSignedId] = useState<string | null>(null);
  const [removeSignedTarget, setRemoveSignedTarget] = useState<WillSummary | null>(null);
  const [isRemovingSigned, setIsRemovingSigned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWills = typeFilter === 'all'
    ? wills
    : wills.filter((w) => w.type === typeFilter);

  useEffect(() => {
    loadWills();
  }, [clientId]);

  const loadWills = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const url = `${API_BASE}/estate-planning-fna/wills/client/${clientId}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load wills');
      }

      // Sort by most recent first
      const sortedWills = (result.data || []).sort((a: WillSummary, b: WillSummary) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      setWills(sortedWills);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      // Only show toast error if it's not a network connectivity issue
      if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError')) {
        toast.error(`Failed to load wills: ${errorMessage}`);
      }
      
      setWills([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (willId: string): Promise<void> => {
    setDownloadingWillId(willId);
    try {
      const resp = await fetch(`${API_BASE}/estate-planning-fna/wills/${willId}`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`Failed to fetch will: ${resp.status}`);
      const result = await resp.json();
      if (!result.success || !result.data) throw new Error(result.error || 'Will not found');

      downloadWillPdf(result.data as WillRecord);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to download PDF: ${errorMessage}`);
      console.error('Error downloading will PDF:', err);
    } finally {
      setDownloadingWillId(null);
    }
  };

  // ── Signed Document Handlers ───────────────────────────────────

  const handleAttachSignedDocument = async (): Promise<void> => {
    if (!attachTarget || !attachFile) return;

    setIsAttaching(true);
    try {
      const formData = new FormData();
      formData.append('file', attachFile);

      const resp = await fetch(
        `${API_BASE}/estate-planning-fna/wills/${attachTarget.id}/attach-signed`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          body: formData,
        }
      );

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${resp.status}`);
      }

      const result = await resp.json();
      if (!result.success) throw new Error(result.error || 'Failed to attach signed document');

      toast.success('Signed document attached successfully', {
        description: `${attachFile.name} linked to ${getDiscardTypeLabel(attachTarget)}`,
      });

      // Update local state with the updated will record
      setWills(prev =>
        prev.map(w => (w.id === attachTarget.id ? { ...w, ...result.data } : w))
      );

      // Reset dialog state
      setAttachTarget(null);
      setAttachFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to attach signed document: ${errorMessage}`);
      console.error('Error attaching signed document:', err);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDownloadSignedDocument = async (will: WillSummary): Promise<void> => {
    setDownloadingSignedId(will.id);
    try {
      const resp = await fetch(
        `${API_BASE}/estate-planning-fna/wills/${will.id}/signed-document`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!resp.ok) throw new Error('Failed to get download URL');

      const result = await resp.json();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err) {
      console.error('Error downloading signed document:', err);
      toast.error('Failed to download signed document');
    } finally {
      setDownloadingSignedId(null);
    }
  };

  const handleRemoveSignedDocument = async (): Promise<void> => {
    if (!removeSignedTarget) return;

    setIsRemovingSigned(true);
    try {
      const resp = await fetch(
        `${API_BASE}/estate-planning-fna/wills/${removeSignedTarget.id}/signed-document`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!resp.ok) throw new Error('Failed to remove signed document');

      const result = await resp.json();
      toast.success('Signed document removed');

      setWills(prev =>
        prev.map(w => (w.id === removeSignedTarget.id ? { ...w, ...result.data } : w))
      );
      setRemoveSignedTarget(null);
    } catch (err) {
      console.error('Error removing signed document:', err);
      toast.error('Failed to remove signed document');
    } finally {
      setIsRemovingSigned(false);
    }
  };

  // ── Status Helpers ─────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
      published: { label: 'Published', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
      finalized: { label: 'Finalized', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
      signed: { label: 'Signed', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      archived: { label: 'Archived', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
      last_will: { label: 'Last Will & Testament', icon: Scroll, color: 'text-purple-600' },
      living_will: { label: 'Living Will', icon: Heart, color: 'text-blue-600' },
    };

    const config = typeConfig[type] || { label: type, icon: FileText, color: 'text-gray-600' };
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span>{config.label}</span>
      </div>
    );
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

  const handleDiscardDraft = async (): Promise<void> => {
    if (!discardTarget) return;
    setIsDiscarding(true);
    try {
      const resp = await fetch(`${API_BASE}/estate-planning-fna/wills/${discardTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const errorBody = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errorBody}`);
      }

      const result = await resp.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to discard draft');
      }

      const typeLabel = discardTarget.type === 'living_will' ? 'Living Will' : 'Last Will & Testament';
      toast.success(`Draft ${typeLabel} discarded`, {
        description: `Version ${discardTarget.version} has been permanently removed.`,
      });

      // Refresh the list
      await loadWills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to discard draft: ${errorMessage}`);
      console.error('Error discarding draft will:', err);
    } finally {
      setIsDiscarding(false);
      setDiscardTarget(null);
    }
  };

  const getDiscardTypeLabel = (will: WillSummary): string => {
    return will.type === 'living_will' ? 'Living Will' : 'Last Will & Testament';
  };

  /** Can a signed document be attached to this will? */
  const canAttachSigned = (will: WillSummary): boolean => {
    return ['published', 'finalized', 'signed'].includes(will.status);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  // ── AI Will Builder view ────────────────────────────────────────
  if (showAIWillBuilder) {
    return (
      <WillChatInterface
        clientId={clientId}
        clientName={clientName}
        onClose={() => setShowAIWillBuilder(false)}
        onWillSaved={() => loadWills()}
      />
    );
  }

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
            <h2 className="text-2xl font-semibold">Will Management</h2>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Manage wills and testaments for {clientName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onAIWillBuilder ?? (() => setShowAIWillBuilder(true))}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Bot className="h-4 w-4 mr-2" />
            AI Will Builder
          </Button>
          <Button onClick={onDraftLivingWill} variant="outline">
            <Heart className="h-4 w-4 mr-2" />
            Draft New Living Will
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {wills.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter by type:</span>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'last_will' | 'living_will')}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Will Types ({wills.length})</SelectItem>
              <SelectItem value="last_will">Last Will &amp; Testament ({wills.filter(w => w.type === 'last_will').length})</SelectItem>
              <SelectItem value="living_will">Living Will ({wills.filter(w => w.type === 'living_will').length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Wills Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9]" />
            </div>
          ) : filteredWills.length === 0 && wills.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Wills Drafted</h3>
              <p className="text-sm text-gray-600 mb-6">
                Start by drafting a Last Will & Testament or Living Will for {clientName}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={onAIWillBuilder ?? (() => setShowAIWillBuilder(true))}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  AI Will Builder
                </Button>
                <Button onClick={onDraftLivingWill} variant="outline">
                  <Heart className="h-4 w-4 mr-2" />
                  Draft New Living Will
                </Button>
              </div>
            </div>
          ) : filteredWills.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Matching Wills</h3>
              <p className="text-sm text-gray-600 mb-4">
                No {typeFilter === 'last_will' ? 'Last Will & Testament' : 'Living Will'} documents found for this client.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTypeFilter('all')}
              >
                Show All Will Types
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Copy</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWills.map((will) => (
                  <TableRow key={will.id}>
                    <TableCell>{getTypeBadge(will.type)}</TableCell>
                    <TableCell>{getStatusBadge(will.status)}</TableCell>
                    <TableCell>
                      {will.signedDocumentPath ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-700 font-medium">Attached</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{will.signedDocumentFileName}</p>
                              {will.signedAt && (
                                <p className="text-xs text-muted-foreground">
                                  Attached {formatDate(will.signedAt)}
                                </p>
                              )}
                              {will.signedDocumentFileSize && (
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(will.signedDocumentFileSize)}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : canAttachSigned(will) ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-gray-600">{will.version}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(will.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(will.updatedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {will.createdBy || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {/* Resume draft */}
                        {will.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onResumeDraft(will.id, will.type)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Resume
                          </Button>
                        )}

                        {/* View system-generated will */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewWill(will.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>

                        {/* Download system-generated PDF */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(will.id)}
                          disabled={downloadingWillId === will.id}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          {downloadingWillId === will.id ? '...' : 'PDF'}
                        </Button>

                        {/* Attach or replace signed document */}
                        {canAttachSigned(will) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setAttachTarget(will)}
                                  className={will.signedDocumentPath
                                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                    : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  }
                                >
                                  <Paperclip className="h-4 w-4 mr-1" />
                                  {will.signedDocumentPath ? 'Replace' : 'Attach'}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {will.signedDocumentPath
                                  ? 'Replace the signed copy with a new scan'
                                  : 'Attach scanned signed copy'
                                }
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Download signed document */}
                        {will.signedDocumentPath && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadSignedDocument(will)}
                                  disabled={downloadingSignedId === will.id}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  {downloadingSignedId === will.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileDown className="h-4 w-4 mr-1" />
                                  )}
                                  Signed
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download signed copy</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Remove signed document */}
                        {will.signedDocumentPath && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRemoveSignedTarget(will)}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove signed copy</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Discard draft */}
                        {will.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDiscardTarget(will)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Discard
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

      {/* Summary Cards */}
      {!isLoading && wills.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Scroll className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Will & Testament</p>
                  <p className="text-2xl font-bold">
                    {wills.filter(w => w.type === 'last_will').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Living Wills</p>
                  <p className="text-2xl font-bold">
                    {wills.filter(w => w.type === 'living_will').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Finalized</p>
                  <p className="text-2xl font-bold">
                    {wills.filter(w => ['published', 'finalized', 'signed'].includes(w.status)).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Signed Copies</p>
                  <p className="text-2xl font-bold">
                    {wills.filter(w => w.signedDocumentPath).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Attach Signed Document Dialog ──────────────────────────── */}
      <Dialog
        open={!!attachTarget}
        onOpenChange={(open) => {
          if (!open) {
            setAttachTarget(null);
            setAttachFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {attachTarget?.signedDocumentPath ? 'Replace Signed Copy' : 'Attach Signed Copy'}
            </DialogTitle>
            <DialogDescription>
              Upload the scanned signed original of this{' '}
              {attachTarget?.type === 'living_will' ? 'Living Will' : 'Last Will & Testament'}
              {attachTarget?.signedDocumentPath && (
                <span className="block mt-1 text-amber-600">
                  This will replace the currently attached file ({attachTarget.signedDocumentFileName}).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center relative">
              {attachFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{attachFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachFile.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAttachFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to select or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPEG, or PNG (max 50MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className={attachFile ? 'hidden' : 'absolute inset-0 w-full h-full opacity-0 cursor-pointer'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAttachFile(file);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAttachTarget(null);
                setAttachFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAttachSignedDocument}
              disabled={isAttaching || !attachFile}
            >
              {isAttaching ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </div>
              ) : (
                <div className="contents">
                  <Upload className="h-4 w-4 mr-2" />
                  {attachTarget?.signedDocumentPath ? 'Replace Signed Copy' : 'Attach Signed Copy'}
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Signed Document Confirmation ───────────────────── */}
      <AlertDialog
        open={!!removeSignedTarget}
        onOpenChange={(open) => { if (!open) setRemoveSignedTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Signed Copy?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will remove the signed copy ({removeSignedTarget?.signedDocumentFileName}) from this{' '}
                {removeSignedTarget ? getDiscardTypeLabel(removeSignedTarget) : ''}.
              </span>
              <span className="block text-muted-foreground">
                The will status will revert to &ldquo;Finalized&rdquo;. You can re-attach a signed copy later.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingSigned}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveSignedDocument}
              disabled={isRemovingSigned}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRemovingSigned ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </div>
              ) : (
                <div className="contents">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Signed Copy
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Discard Draft Confirmation Dialog ─────────────────────── */}
      <AlertDialog open={!!discardTarget} onOpenChange={(open) => { if (!open) setDiscardTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Draft {discardTarget ? getDiscardTypeLabel(discardTarget) : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently delete the draft{' '}
                <strong>{discardTarget ? getDiscardTypeLabel(discardTarget) : ''}</strong>{' '}
                (version {discardTarget?.version}) for {clientName}.
              </span>
              <span className="block text-red-600 font-medium">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardDraft}
              disabled={isDiscarding}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDiscarding ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Discarding...
                </div>
              ) : (
                <div className="contents">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard Draft
                </div>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}