/**
 * RENEWAL ALERT SCANNER
 *
 * Admin UI for scanning policies for upcoming renewal anniversaries
 * and generating tasks. Follows the dry-run-first pattern (Guidelines §14.1):
 * preview results first, then confirm to create tasks.
 *
 * @module RenewalAlertScanner
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
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
  Bell,
  CalendarClock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ListTodo,
  FileText,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

interface AlertCandidate {
  clientId: string;
  clientName: string;
  policyId: string;
  providerName: string;
  categoryLabel: string;
  policyNumber: string;
  inceptionDate: string;
  nextAnniversary: string;
  daysUntil: number;
  renewalTag: string;
  alreadyHasTask: boolean;
}

interface ScanSummary {
  totalPoliciesScanned: number;
  candidatesFound: number;
  tasksToCreate: number;
  skippedExisting: number;
  tasksCreated: number;
}

interface ScanResult {
  success: boolean;
  dryRun: boolean;
  daysAhead: number;
  summary: ScanSummary;
  candidates: AlertCandidate[];
}

function UrgencyBadge({ daysUntil }: { daysUntil: number }) {
  if (daysUntil <= 7) {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">Urgent</Badge>;
  }
  if (daysUntil <= 14) {
    return <Badge className="bg-red-50 text-red-600 hover:bg-red-50 text-[10px] px-1.5 py-0">High</Badge>;
  }
  if (daysUntil <= 30) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">Medium</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0">Low</Badge>;
}

export function RenewalAlertScanner() {
  const [daysAhead, setDaysAhead] = useState(60);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCandidates, setShowCandidates] = useState(true);

  const getAuthToken = useCallback(async (): Promise<string> => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  }, []);

  const runScan = useCallback(async (dryRun: boolean) => {
    if (dryRun) {
      setIsScanning(true);
    } else {
      setIsCreating(true);
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE}/policy-renewal-alerts/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ daysAhead, dryRun }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Scan failed');
      }

      const data: ScanResult = await res.json();
      setScanResult(data);

      if (dryRun) {
        if (data.summary.candidatesFound === 0) {
          toast.info('No upcoming renewals found within the scan window');
        } else {
          toast.success(`Found ${data.summary.candidatesFound} upcoming renewals (${data.summary.tasksToCreate} new)`);
        }
      } else {
        toast.success(`Created ${data.summary.tasksCreated} renewal alert tasks`);
        setShowConfirmDialog(false);
      }
    } catch (err: unknown) {
      console.error('Renewal scan error:', err);
      toast.error((err as Error)?.message || 'Failed to scan for renewals');
    } finally {
      setIsScanning(false);
      setIsCreating(false);
    }
  }, [daysAhead, getAuthToken]);

  const handlePreview = () => runScan(true);

  const handleCreateTasks = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmCreate = () => {
    runScan(false);
  };

  const newCandidates = scanResult?.candidates.filter(c => !c.alreadyHasTask) || [];
  const existingCandidates = scanResult?.candidates.filter(c => c.alreadyHasTask) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-800">Renewal Alert Scanner</h3>
        </div>
      </div>

      {/* Controls */}
      <Card className="bg-white border border-gray-200 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Scan Window (days ahead)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value) || 60)}
                className="w-24 h-9"
              />
            </div>
            <Button
              onClick={handlePreview}
              disabled={isScanning || isCreating}
              variant="outline"
              className="h-9"
            >
              {isScanning ? (
                <div className="contents">
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Scanning...
                </div>
              ) : (
                <div className="contents">
                  <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
                  Preview Scan
                </div>
              )}
            </Button>
            {scanResult && scanResult.summary.tasksToCreate > 0 && (
              <Button
                onClick={handleCreateTasks}
                disabled={isCreating || isScanning}
                className="bg-amber-600 hover:bg-amber-700 h-9"
              >
                {isCreating ? (
                  <div className="contents">
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <div className="contents">
                    <ListTodo className="h-3.5 w-3.5 mr-1.5" />
                    Create {scanResult.summary.tasksToCreate} Tasks
                  </div>
                )}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Scans all policies for anniversary dates within the next {daysAhead} days.
            Tasks are deduplicated — existing renewal tasks won't be recreated.
          </p>
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResult && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-white border border-gray-200 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{scanResult.summary.totalPoliciesScanned}</p>
                    <p className="text-[10px] text-gray-500">Policies Scanned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-gray-200 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <CalendarClock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{scanResult.summary.candidatesFound}</p>
                    <p className="text-[10px] text-gray-500">Upcoming Renewals</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-gray-200 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                    <ListTodo className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{scanResult.summary.tasksToCreate}</p>
                    <p className="text-[10px] text-gray-500">New Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-gray-200 shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{scanResult.summary.skippedExisting}</p>
                    <p className="text-[10px] text-gray-500">Already Tracked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Applied badge */}
          {!scanResult.dryRun && scanResult.summary.tasksCreated > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">
                {scanResult.summary.tasksCreated} renewal tasks created successfully
              </span>
              <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] ml-auto">Applied</Badge>
            </div>
          )}

          {/* Candidate List */}
          {scanResult.candidates.length > 0 && (
            <Card className="bg-white border border-gray-200 shadow-none overflow-hidden">
              <CardContent className="p-0">
                <button
                  onClick={() => setShowCandidates(!showCandidates)}
                  className="w-full px-4 py-2.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
                >
                  <span className="text-xs font-semibold text-gray-600 uppercase">
                    Renewal Candidates ({scanResult.candidates.length})
                  </span>
                  {showCandidates ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>

                {showCandidates && (
                  <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    {/* New candidates first */}
                    {newCandidates.map(candidate => (
                      <div key={candidate.policyId} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{candidate.providerName}</span>
                            <span className="text-xs text-gray-400">—</span>
                            <span className="text-xs text-gray-600">{candidate.clientName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span>{candidate.categoryLabel}</span>
                            {candidate.policyNumber && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span>#{candidate.policyNumber}</span>
                              </>
                            )}
                            <span className="text-gray-300">|</span>
                            <span>Anniversary: {new Date(candidate.nextAnniversary).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <UrgencyBadge daysUntil={candidate.daysUntil} />
                          <span className="text-xs font-medium text-gray-700 w-16 text-right">
                            {candidate.daysUntil}d
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Existing (already tracked) */}
                    {existingCandidates.length > 0 && (
                      <>
                        <div className="px-4 py-1.5 bg-gray-50">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">Already Tracked</span>
                        </div>
                        {existingCandidates.map(candidate => (
                          <div key={candidate.policyId} className="px-4 py-2 flex items-center gap-3 opacity-50">
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-gray-600">
                                {candidate.providerName} — {candidate.clientName}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">{candidate.daysUntil}d</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {scanResult.candidates.length === 0 && (
            <div className="text-center py-8">
              <CalendarClock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No upcoming renewals</p>
              <p className="text-xs text-gray-400 mt-1">
                No policies have anniversary dates within the next {daysAhead} days.
              </p>
            </div>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Renewal Alert Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              This will create <strong>{scanResult?.summary.tasksToCreate || 0}</strong> new tasks
              in the Task Management board for upcoming policy renewals.
              {scanResult?.summary.skippedExisting ? (
                <span className="block mt-1">
                  {scanResult.summary.skippedExisting} renewals already have tasks and will be skipped.
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCreate}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Create Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
