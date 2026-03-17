/**
 * Bulk Action Dialogs for E-Signature Module
 *
 * Implements dry-run-first pattern (§14.1):
 *   - First run is always a preview (dryRun=true)
 *   - User reviews the preview results
 *   - User confirms to apply the action (dryRun=false)
 */

import React, { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Loader2,
  Send,
  Ban,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { esignApi } from '../api';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// BULK REMIND DIALOG
// ============================================================================

interface BulkRemindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelopeIds: string[];
  onComplete: () => void;
}

export function BulkRemindDialog({
  open,
  onOpenChange,
  envelopeIds,
  onComplete,
}: BulkRemindDialogProps) {
  const [phase, setPhase] = useState<'confirm' | 'preview' | 'applying' | 'done'>('confirm');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalPendingSigners: number;
    results: Array<{
      envelopeId: string;
      title: string;
      pendingSigners: Array<{ name: string; email: string }>;
      error?: string;
    }>;
  } | null>(null);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await esignApi.bulkRemind(envelopeIds, true);
      setPreviewData({
        totalPendingSigners: result.totalPendingSigners,
        results: result.results,
      });
      setPhase('preview');
    } catch (err) {
      toast.error('Failed to generate preview');
      console.error('Bulk remind preview error:', err);
    } finally {
      setLoading(false);
    }
  }, [envelopeIds]);

  const handleApply = useCallback(async () => {
    setPhase('applying');
    setLoading(true);
    try {
      const result = await esignApi.bulkRemind(envelopeIds, false);
      toast.success(`Sent ${result.totalRemindersSent} reminders across ${result.envelopeCount} envelopes`);
      setPhase('done');
      onComplete();
    } catch (err) {
      toast.error('Failed to send reminders');
      console.error('Bulk remind apply error:', err);
      setPhase('preview');
    } finally {
      setLoading(false);
    }
  }, [envelopeIds, onComplete]);

  const handleClose = () => {
    setPhase('confirm');
    setPreviewData(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Bulk Send Reminders
          </AlertDialogTitle>
          <AlertDialogDescription>
            {phase === 'confirm' && `Send reminders to all pending signers across ${envelopeIds.length} selected envelope(s).`}
            {phase === 'preview' && 'Review the preview below, then confirm to send.'}
            {phase === 'applying' && 'Sending reminders...'}
            {phase === 'done' && 'Reminders sent successfully.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Preview Results Table */}
        {phase === 'preview' && previewData && (
          <div className="space-y-3 my-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Badge>
              <span className="text-sm text-muted-foreground">
                {previewData.totalPendingSigners} pending signer(s) will receive a reminder
              </span>
            </div>

            <div className="rounded-md border max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Envelope</TableHead>
                    <TableHead>Pending Signers</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.results.map((r) => (
                    <TableRow key={r.envelopeId}>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {r.title}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.error ? (
                          <span className="text-red-600 text-xs">{r.error}</span>
                        ) : (
                          r.pendingSigners.map((s) => s.name).join(', ') || 'None'
                        )}
                      </TableCell>
                      <TableCell>
                        {r.error ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : r.pendingSigners.length > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Skip</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {phase === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {phase === 'confirm' && (
            <Button onClick={handlePreview} disabled={loading}>
              {loading ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Preview...
                </div>
              ) : (
                <div className="contents">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </div>
              )}
            </Button>
          )}
          {phase === 'preview' && (
            <Button onClick={handleApply} disabled={loading || (previewData?.totalPendingSigners ?? 0) === 0}>
              {loading ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </div>
              ) : (
                <div className="contents">
                  <Send className="h-4 w-4 mr-2" />
                  Send {previewData?.totalPendingSigners ?? 0} Reminders
                </div>
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// BULK VOID DIALOG
// ============================================================================

interface BulkVoidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelopeIds: string[];
  onComplete: () => void;
}

export function BulkVoidDialog({
  open,
  onOpenChange,
  envelopeIds,
  onComplete,
}: BulkVoidDialogProps) {
  const [phase, setPhase] = useState<'confirm' | 'preview' | 'applying' | 'done'>('confirm');
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [previewData, setPreviewData] = useState<{
    voidedCount: number;
    results: Array<{
      envelopeId: string;
      title: string;
      previousStatus: string;
      error?: string;
    }>;
  } | null>(null);

  const handlePreview = useCallback(async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }
    setLoading(true);
    try {
      const result = await esignApi.bulkVoid(envelopeIds, reason, true);
      setPreviewData({
        voidedCount: result.voidedCount,
        results: result.results,
      });
      setPhase('preview');
    } catch (err) {
      toast.error('Failed to generate preview');
      console.error('Bulk void preview error:', err);
    } finally {
      setLoading(false);
    }
  }, [envelopeIds, reason]);

  const handleApply = useCallback(async () => {
    setPhase('applying');
    setLoading(true);
    try {
      const result = await esignApi.bulkVoid(envelopeIds, reason, false);
      toast.success(`Voided ${result.voidedCount} envelope(s)`);
      setPhase('done');
      onComplete();
    } catch (err) {
      toast.error('Failed to void envelopes');
      console.error('Bulk void apply error:', err);
      setPhase('preview');
    } finally {
      setLoading(false);
    }
  }, [envelopeIds, reason, onComplete]);

  const handleClose = () => {
    setPhase('confirm');
    setPreviewData(null);
    setReason('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Bulk Void Envelopes
          </AlertDialogTitle>
          <AlertDialogDescription>
            {phase === 'confirm' && (
              <span>
                Void {envelopeIds.length} selected envelope(s). This action cannot be undone.
              </span>
            )}
            {phase === 'preview' && 'Review the preview below, then confirm to void.'}
            {phase === 'applying' && 'Voiding envelopes...'}
            {phase === 'done' && 'Envelopes voided successfully.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Reason Input */}
        {phase === 'confirm' && (
          <div className="space-y-2 my-2">
            <Label htmlFor="void-reason">Reason for voiding</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Documents superseded by updated versions"
              className="w-full"
            />
          </div>
        )}

        {/* Preview Results Table */}
        {phase === 'preview' && previewData && (
          <div className="space-y-3 my-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Preview — Destructive
              </Badge>
              <span className="text-sm text-muted-foreground">
                {previewData.voidedCount} envelope(s) will be voided
              </span>
            </div>

            <div className="rounded-md border max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Envelope</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.results.map((r) => (
                    <TableRow key={r.envelopeId}>
                      <TableCell className="text-sm font-medium max-w-[250px] truncate">
                        {r.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.previousStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.error ? (
                          <span className="text-red-600 text-xs">{r.error}</span>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 text-xs">Void</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Reason: "{reason}"</span>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {phase === 'done' ? 'Close' : 'Cancel'}
          </Button>
          {phase === 'confirm' && (
            <Button onClick={handlePreview} disabled={loading || !reason.trim()} variant="destructive">
              {loading ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Preview...
                </div>
              ) : (
                <div className="contents">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </div>
              )}
            </Button>
          )}
          {phase === 'preview' && (
            <Button onClick={handleApply} disabled={loading || previewData?.voidedCount === 0} variant="destructive">
              {loading ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Voiding...
                </div>
              ) : (
                <div className="contents">
                  <Ban className="h-4 w-4 mr-2" />
                  Void {previewData?.voidedCount ?? 0} Envelopes
                </div>
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
