/**
 * Treasury Manager panel — entry point rendered inside the Locked module's
 * Banking tab (already behind super-admin + access-code gating in
 * LockedModule).
 *
 * Surfaces the Stripe Treasury financial account: real balance, real bank
 * (ABA) details, the standard Stripe payments balance for reconciliation, and
 * recent transactions, plus Deposit (money in) and Send (money out) actions.
 */

import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Check,
  Copy,
  Landmark,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Separator } from '../../../../ui/separator';
import { Skeleton } from '../../../../ui/skeleton';
import { DepositDialog } from './components/DepositDialog';
import { SendDialog } from './components/SendDialog';
import {
  usePlatformBalance,
  useTreasuryBalance,
  useTreasuryFinancialAccount,
  useTreasuryTransactions,
  useDeposit,
  useSend,
} from './hooks/useTreasury';
import { formatMinor, statusLabel } from './constants';
import type { DepositInput, SendInput } from './types';

export function TreasuryManagerPanel() {
  const accountQuery = useTreasuryFinancialAccount();
  const balanceQuery = useTreasuryBalance();
  const platformQuery = usePlatformBalance();
  const transactionsQuery = useTreasuryTransactions();
  const deposit = useDeposit();
  const send = useSend();

  const [depositOpen, setDepositOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const account = accountQuery.data;
  const currency = account?.currency ?? balanceQuery.data?.currency ?? 'usd';

  const handleDeposit = (input: DepositInput) => {
    deposit.mutate(input, { onSuccess: () => setDepositOpen(false) });
  };
  const handleSend = (input: SendInput) => {
    send.mutate(input, { onSuccess: () => setSendOpen(false) });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Manager</h2>
            <p className="text-sm text-muted-foreground">
              Treasury financial account — balance, bank details and money movement.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDepositOpen(true)} disabled={!account}>
            <ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit
          </Button>
          <Button onClick={() => setSendOpen(true)} disabled={!account}>
            <ArrowUpFromLine className="h-4 w-4 mr-1" /> Send
          </Button>
        </div>
      </div>

      {/* Load error */}
      {accountQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load the financial account: {(accountQuery.error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {/* Balances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Treasury balance</span>
              {account ? (
                <Badge variant="secondary" className="ml-auto capitalize">
                  {statusLabel(account.status)}
                </Badge>
              ) : null}
            </div>
            {balanceQuery.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : balanceQuery.data ? (
              (() => {
                const rows =
                  balanceQuery.data.perCurrency && balanceQuery.data.perCurrency.length
                    ? balanceQuery.data.perCurrency
                    : [
                        {
                          currency: balanceQuery.data.currency ?? currency,
                          cash: balanceQuery.data.cash,
                          inboundPending: balanceQuery.data.inboundPending,
                          outboundPending: balanceQuery.data.outboundPending,
                        },
                      ];
                return (
                  <>
                    <p className="text-3xl font-semibold">
                      {rows.map((r) => formatMinor(r.cash, r.currency)).join(' · ')}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        Pending in:{' '}
                        {rows.map((r) => formatMinor(r.inboundPending, r.currency)).join(' · ')}
                      </span>
                      <span>
                        Pending out:{' '}
                        {rows.map((r) => formatMinor(r.outboundPending, r.currency)).join(' · ')}
                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-sm text-muted-foreground">Unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Payments balance</span>
              <span className="ml-auto text-xs text-muted-foreground">Reconciliation</span>
            </div>
            {platformQuery.isLoading ? (
              <Skeleton className="h-9 w-40" />
            ) : platformQuery.data ? (
              <>
                <p className="text-3xl font-semibold">
                  {platformQuery.data.available.length
                    ? platformQuery.data.available
                        .map((r) => formatMinor(r.amount, r.currency))
                        .join(' · ')
                    : formatMinor(0, currency)}
                </p>
                <div className="text-xs text-muted-foreground">
                  Pending:{' '}
                  {platformQuery.data.pending.length
                    ? platformQuery.data.pending
                        .map((r) => formatMinor(r.amount, r.currency))
                        .join(' · ')
                    : formatMinor(0, currency)}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unavailable.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank details */}
      <BankDetailsCard isLoading={accountQuery.isLoading} account={account} />

      {/* Transactions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Recent transactions</span>
          </div>
          {transactionsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (transactionsQuery.data ?? []).length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <ul className="divide-y">
              {transactionsQuery.data!.map((txn) => (
                <li key={txn.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.description || txn.flowType || 'Transaction'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.created * 1000).toLocaleString()} · {statusLabel(txn.status)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      txn.amount < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}
                  >
                    {formatMinor(txn.amount, txn.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        currency={currency}
        onSubmit={handleDeposit}
        isSubmitting={deposit.isPending}
      />
      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        currency={currency}
        onSubmit={handleSend}
        isSubmitting={send.isPending}
      />
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm truncate">{value}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

/** A UK sort code or SEPA BIC must not be labelled "Routing number". */
const ROUTING_LABEL: Record<string, string> = {
  us_bank_account: 'Routing number',
  gb_bank_account: 'Sort code',
  sepa_bank_account: 'BIC / SWIFT',
};

const ACCOUNT_LABEL: Record<string, string> = {
  sepa_bank_account: 'IBAN',
};

function BankDetailsCard({
  isLoading,
  account,
}: {
  isLoading: boolean;
  account: ReturnType<typeof useTreasuryFinancialAccount>['data'];
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Bank account details</span>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : !account || account.bankDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bank details available for this financial account yet.
          </p>
        ) : (
          account.bankDetails.map((bank, idx) => {
            const holder = bank.accountHolderName ?? account.accountHolderName;
            const routingLabel = ROUTING_LABEL[bank.type] ?? 'Routing number';
            const accountLabel = ACCOUNT_LABEL[bank.type] ?? 'Account number';
            return (
              <div key={`${bank.type}-${idx}`} className="space-y-2">
                {idx > 0 ? <Separator /> : null}
                {bank.currency ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="uppercase">
                      {bank.currency}
                    </Badge>
                    {bank.status ? (
                      <span className="text-xs text-muted-foreground capitalize">
                        {bank.status}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {holder ? <CopyableField label="Account holder" value={holder} /> : null}
                {bank.bankName ? <CopyableField label="Bank" value={bank.bankName} /> : null}
                {bank.routingNumber ? (
                  <CopyableField label={routingLabel} value={bank.routingNumber} />
                ) : null}
                {bank.accountNumber ? (
                  <CopyableField label={accountLabel} value={bank.accountNumber} />
                ) : bank.accountNumberLast4 ? (
                  <CopyableField label={accountLabel} value={`•••• ${bank.accountNumberLast4}`} />
                ) : null}
                {bank.supportedNetworks.length ? (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {bank.supportedNetworks.map((n) => (
                      <Badge key={n} variant="outline" className="capitalize">
                        {n.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
