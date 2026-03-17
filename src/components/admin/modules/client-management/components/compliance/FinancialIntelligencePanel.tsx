/**
 * Financial Intelligence Panel
 *
 * Phase 1 endpoints:
 * - Bank Account Verification (real-time): POST /natural-person-account-verification-real-time
 * - Consumer Credit Check: POST /natural-person-consumer-credit
 *
 * Bank verification pre-populates from the client's profile bank accounts.
 * Credit check requires explicit consent acknowledgement.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import {
  Landmark,
  CreditCard,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  Search,
  FileText,
  Home,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';
import { clientApi } from '../../api';
import { HoneycombActionCard } from './HoneycombActionCard';

interface FinancialIntelligencePanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

interface BankAccountData {
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

interface CheckResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  matterId?: string;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

export function FinancialIntelligencePanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  passport,
  hasIdentification,
  onCheckComplete,
}: FinancialIntelligencePanelProps) {
  // ─── Bank Verification State ──────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([]);
  const [selectedBankIdx, setSelectedBankIdx] = useState(0);
  const [customBank, setCustomBank] = useState<BankAccountData>({
    bankName: '',
    accountNumber: '',
    branchCode: '',
    accountType: 'savings',
  });
  const [useCustomBank, setUseCustomBank] = useState(false);
  const [isBankVerifying, setIsBankVerifying] = useState(false);
  const [bankResult, setBankResult] = useState<CheckResult | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);

  // ─── Credit Check State ───────────────────────────────────────────────
  const [consentGiven, setConsentGiven] = useState(false);
  const [isCreditRunning, setIsCreditRunning] = useState(false);
  const [creditResult, setCreditResult] = useState<CheckResult | null>(null);
  const [showCreditDetails, setShowCreditDetails] = useState(false);

  // ─── Load profile bank accounts ───────────────────────────────────────
  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        const result = await clientApi.fetchClientProfile(clientId);
        if (result.success && result.data?.bankAccounts?.length > 0) {
          setBankAccounts(
            result.data.bankAccounts.map((ba: { bankName?: string; customBankName?: string; accountNumber?: string; branchCode?: string; customBranchCode?: string; accountType?: string }) => ({
              bankName: ba.bankName || ba.customBankName || '',
              accountNumber: ba.accountNumber || '',
              branchCode: ba.branchCode || ba.customBranchCode || '',
              accountType: ba.accountType || 'savings',
            }))
          );
        }
      } catch (err) {
        console.warn('[FinancialPanel] Could not load bank accounts:', err);
      }
    };

    if (clientId) loadBankAccounts();
  }, [clientId]);

  // ─── Bank Verification Handler ────────────────────────────────────────
  const handleBankVerify = async () => {
    const bank = useCustomBank ? customBank : bankAccounts[selectedBankIdx];
    if (!bank?.bankName || !bank?.accountNumber || !bank?.branchCode) {
      toast.error('Please provide complete bank details (bank name, account number, branch code).');
      return;
    }

    setIsBankVerifying(true);
    setBankResult(null);
    const toastId = toast.loading('Verifying bank account...');

    try {
      const res = await fetch(`${API_BASE}/financial/bank-verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          firstName,
          lastName,
          idNumber,
          passport,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          branchCode: bank.branchCode,
          accountType: bank.accountType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setBankResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      setBankResult({ success: true, data: data.data, matterId: data.matterId });
      toast.success('Bank account verification completed', { id: toastId });
      onCheckComplete?.();
    } catch (err: unknown) {
      setBankResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
      toast.error(err instanceof Error ? err.message : 'Network error', { id: toastId });
    } finally {
      setIsBankVerifying(false);
    }
  };

  // ─── Credit Check Handler ─────────────────────────────────────────────
  const handleCreditCheck = async () => {
    if (!consentGiven) {
      toast.error('Client consent is required before running a credit check.');
      return;
    }

    setIsCreditRunning(true);
    setCreditResult(null);
    const toastId = toast.loading('Running consumer credit check...');

    try {
      const res = await fetch(`${API_BASE}/financial/credit-check`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          firstName,
          lastName,
          idNumber,
          passport,
          consentGiven: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setCreditResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      setCreditResult({ success: true, data: data.data, matterId: data.matterId });
      toast.success('Consumer credit check completed', { id: toastId });
      onCheckComplete?.();
    } catch (err: unknown) {
      setCreditResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
      toast.error(err instanceof Error ? err.message : 'Network error', { id: toastId });
    } finally {
      setIsCreditRunning(false);
    }
  };

  const activeBankAccount = useCustomBank ? customBank : bankAccounts[selectedBankIdx];

  return (
    <div className="space-y-4">
      {/* ──── Bank Account Verification ──── */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <Landmark className="h-5 w-5 text-blue-600" />
            Bank Account Verification
          </CardTitle>
          <CardDescription>
            Real-time bank account verification via the credit bureau. Confirms the account
            exists, is open, and the holder name matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Bank account selector */}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">Select Bank Account</Label>
              <div className="space-y-1">
                {bankAccounts.map((ba, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      !useCustomBank && selectedBankIdx === idx
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bankAccount"
                      checked={!useCustomBank && selectedBankIdx === idx}
                      onChange={() => { setSelectedBankIdx(idx); setUseCustomBank(false); }}
                      className="rounded-full border-gray-300"
                    />
                    <div>
                      <span className="font-medium">{ba.bankName}</span>
                      <span className="text-gray-500 ml-2">
                        ••••{ba.accountNumber.slice(-4)} ({ba.accountType})
                      </span>
                    </div>
                  </label>
                ))}
                <label
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                    useCustomBank
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="bankAccount"
                    checked={useCustomBank}
                    onChange={() => setUseCustomBank(true)}
                    className="rounded-full border-gray-300"
                  />
                  <span className="text-gray-600">Enter different bank details</span>
                </label>
              </div>
            </div>
          )}

          {/* Custom bank input (shown if no accounts on file or custom selected) */}
          {(bankAccounts.length === 0 || useCustomBank) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bank Name</Label>
                <Input
                  value={customBank.bankName}
                  onChange={(e) => setCustomBank({ ...customBank, bankName: e.target.value })}
                  placeholder="e.g. FNB"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Account Number</Label>
                <Input
                  value={customBank.accountNumber}
                  onChange={(e) => setCustomBank({ ...customBank, accountNumber: e.target.value })}
                  placeholder="Account number"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Branch Code</Label>
                <Input
                  value={customBank.branchCode}
                  onChange={(e) => setCustomBank({ ...customBank, branchCode: e.target.value })}
                  placeholder="e.g. 250655"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Account Type</Label>
                <select
                  value={customBank.accountType}
                  onChange={(e) => setCustomBank({ ...customBank, accountType: e.target.value })}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="savings">Savings</option>
                  <option value="cheque">Cheque / Current</option>
                  <option value="transmission">Transmission</option>
                  <option value="bond">Bond</option>
                </select>
              </div>
            </div>
          )}

          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Client ID/passport required for bank verification.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleBankVerify}
            disabled={isBankVerifying || !hasIdentification || (!activeBankAccount?.accountNumber && !useCustomBank)}
          >
            {isBankVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify Bank Account
          </Button>

          {/* Bank Result */}
          {bankResult && (
            <ResultDisplay
              result={bankResult}
              showDetails={showBankDetails}
              onToggleDetails={() => setShowBankDetails(!showBankDetails)}
            />
          )}
        </CardContent>
      </Card>

      {/* ──── Consumer Credit Check ──── */}
      <Card className="bg-green-50/50 border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            Consumer Credit Check
          </CardTitle>
          <CardDescription>
            Performs a consumer credit check via the XDS credit bureau. Returns credit score,
            active accounts, judgments, and defaults. Requires explicit client consent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Consent gate */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="rounded border-gray-300 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-amber-800">Client Consent Required</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  I confirm that the client ({firstName} {lastName}) has provided explicit
                  consent for a credit bureau enquiry to be performed on their behalf.
                  This enquiry will appear on their credit report.
                </p>
              </div>
            </label>
          </div>

          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Client ID/passport required for credit checks.
              </p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleCreditCheck}
            disabled={isCreditRunning || !consentGiven || !hasIdentification}
          >
            {isCreditRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CreditCard className="mr-2 h-4 w-4" />
            Run Credit Check
          </Button>

          {!consentGiven && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Tick the consent checkbox above to enable this check.
            </p>
          )}

          {/* Credit Result */}
          {creditResult && (
            <ResultDisplay
              result={creditResult}
              showDetails={showCreditDetails}
              onToggleDetails={() => setShowCreditDetails(!showCreditDetails)}
            />
          )}
        </CardContent>
      </Card>

      {/* ──── Phase 2: Consumer Trace & Debt Review ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HoneycombActionCard
          title="Consumer Trace"
          description="Trace the client across credit bureau records to find known addresses, employers, contact numbers, and email addresses linked to their ID."
          icon={<Search className="h-5 w-5 text-indigo-600" />}
          actionLabel="Run Consumer Trace"
          endpoint="financial/consumer-trace"
          requestBody={{ clientId, firstName, lastName, idNumber, passport }}
          variant="default"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />

        <HoneycombActionCard
          title="Debt Review Enquiry"
          description="Check whether the client is currently registered under debt review (debt counselling) via the National Credit Regulator."
          icon={<FileText className="h-5 w-5 text-amber-600" />}
          actionLabel="Run Debt Review Check"
          endpoint="financial/debt-review"
          requestBody={{ clientId, firstName, lastName, idNumber, passport }}
          variant="amber"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />
      </div>

      {/* ──── Phase 3: Lifestyle Audit & Income Predictor ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HoneycombActionCard
          title="Lifestyle Audit"
          description="Profile the client's lifestyle based on property ownership, vehicle registrations, and estimated spending patterns from credit bureau data."
          icon={<Home className="h-5 w-5 text-purple-600" />}
          actionLabel="Run Lifestyle Audit"
          endpoint="financial/lifestyle-audit"
          requestBody={{ clientId, firstName, lastName, idNumber, passport }}
          variant="default"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />

        <HoneycombActionCard
          title="Income Predictor"
          description="Estimate the client's income using credit bureau data and statistical models. Returns a predicted income range with confidence level."
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          actionLabel="Run Income Predictor"
          endpoint="financial/income-predictor"
          requestBody={{ clientId, firstName, lastName, idNumber, passport }}
          variant="green"
          disabled={!hasIdentification}
          disabledReason={!hasIdentification ? 'Client ID/passport required' : undefined}
          onSuccess={onCheckComplete}
        />
      </div>
    </div>
  );
}

// ─── Shared Result Display ────────────────────────────────────────────────────

function ResultDisplay({
  result,
  showDetails,
  onToggleDetails,
}: {
  result: CheckResult;
  showDetails: boolean;
  onToggleDetails: () => void;
}) {
  return (
    <div className={`rounded-lg p-3 text-sm ${
      result.success
        ? 'bg-green-50 border border-green-200'
        : 'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-center gap-2 font-medium">
        {result.success ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        )}
        <span className={result.success ? 'text-green-800' : 'text-red-800'}>
          {result.success ? 'Check Completed' : 'Check Failed'}
        </span>
      </div>

      {result.error && (
        <p className="mt-1 text-red-700 text-xs">{result.error}</p>
      )}

      {result.success && (
        <div className="mt-2 space-y-1">
          {result.matterId && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <span>Matter ID:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {result.matterId}
              </Badge>
            </div>
          )}

          <button
            onClick={onToggleDetails}
            className="flex items-center gap-1 mt-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? 'Hide' : 'Show'} full response
          </button>

          {showDetails && (
            <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}