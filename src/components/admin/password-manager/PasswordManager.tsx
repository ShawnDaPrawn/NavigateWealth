import { useCallback, useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../ui/dialog';
import type { VaultLockState, VaultSummary } from '../../../shared/password-manager';
import PortalOperations, { type OpsTab } from './PortalOperations';
import { consentRequest } from './portalApi';
import UnlockGate from './UnlockGate';
import VaultTab from './VaultTab';
import ConnectionsTab from './ConnectionsTab';
import ApprovalsTab from './ApprovalsTab';
import ActivityTab from './ActivityTab';
import { useVaultData } from './useVaultData';
import {
  errorMessage,
  getStatus,
  isVaultLocked,
  listApprovals,
  lockVault,
  onVaultLocked,
} from './vaultApi';
import { TabStrip } from './ui';

type Tab = 'vault' | 'connections' | 'approvals' | 'broker' | 'activity';

export default function PasswordManager({
  onClose,
  userId = null,
}: {
  onClose: () => void;
  /** The signed-in person; the unlock code is sent to them. */
  userId?: string | null;
}) {
  const [linkedRun] = useState(() => new URLSearchParams(window.location.search).get('brokerRun'));
  const [tab, setTab] = useState<Tab>(() => (consentRequest() || linkedRun ? 'broker' : 'vault'));
  const [opsTab, setOpsTab] = useState<OpsTab>(() =>
    linkedRun ? 'Runs' : consentRequest() ? 'AI connections' : 'Workflows',
  );
  const [opsSelected, setOpsSelected] = useState<VaultSummary | null>(null);
  const [opsKey, setOpsKey] = useState(0);
  const [lockState, setLockState] = useState<VaultLockState | null>(null);
  const [statusError, setStatusError] = useState('');
  const [statusCheck, setStatusCheck] = useState(0);
  const [pending, setPending] = useState(0);
  const unlocked = !!lockState?.unlocked;
  const data = useVaultData(unlocked);

  useEffect(() => {
    let active = true;
    setStatusError('');
    getStatus()
      .then((state) => {
        if (active) setLockState(state);
      })
      .catch((e) => {
        if (!active) return;
        if (isVaultLocked(e))
          setLockState({
            unlocked: false,
            twoFactorEnabled: true,
            twoFactorRequired: true,
            expiresAt: null,
          });
        else setStatusError(errorMessage(e, 'Check your access and try again.'));
      });
    return () => {
      active = false;
    };
  }, [statusCheck]);

  useEffect(
    () =>
      onVaultLocked(() =>
        setLockState((state) =>
          state
            ? { ...state, unlocked: false, expiresAt: null }
            : { unlocked: false, twoFactorEnabled: true, twoFactorRequired: true, expiresAt: null },
        ),
      ),
    [],
  );

  const refreshPending = useCallback(() => {
    listApprovals('pending', true)
      .then((rows) => setPending(rows.length))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!unlocked) return;
    refreshPending();
    const timer = setInterval(refreshPending, 30_000);
    return () => clearInterval(timer);
  }, [unlocked, refreshPending]);

  function openBrokerRuns(item: VaultSummary) {
    setOpsSelected(item);
    setOpsTab('Runs');
    setOpsKey((n) => n + 1);
    setTab('broker');
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        aria-labelledby="vault-title"
        aria-describedby="vault-description"
        className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-[#faf8f4] p-0 max-sm:max-h-dvh"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <DialogTitle id="vault-title" className="text-lg font-semibold">
              Password manager
            </DialogTitle>
            <DialogDescription id="vault-description" className="text-sm text-muted-foreground">
              {unlocked && lockState?.expiresAt
                ? 'Locks at ' +
                  new Date(lockState.expiresAt).toLocaleTimeString() +
                  ' if left idle.'
                : 'Firm logins, AI access and broker reporting.'}
            </DialogDescription>
          </div>
          <div className="flex gap-2">
            {unlocked && lockState?.twoFactorRequired !== false && (
              <Button
                variant="outline"
                onClick={() => {
                  setLockState((state) => (state ? { ...state, unlocked: false } : state));
                  void lockVault().catch(() => {});
                }}
              >
                <Lock aria-hidden="true" />
                Lock
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close password manager"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </header>
        {!unlocked ? (
          <UnlockGate
            state={lockState}
            userId={userId}
            loadError={statusError}
            onRetry={() => setStatusCheck((n) => n + 1)}
            onUnlocked={(state) => setLockState({ ...state, unlocked: true })}
          />
        ) : (
          <>
            <TabStrip<Tab>
              label="Password manager"
              className="bg-white px-4 sm:px-6"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'vault', label: 'Vault' },
                { value: 'connections', label: 'AI connections' },
                { value: 'approvals', label: 'Approvals', count: pending },
                { value: 'broker', label: 'Broker reporting' },
                { value: 'activity', label: 'Activity' },
              ]}
            />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
              {tab === 'vault' && <VaultTab data={data} onOpenBrokerRuns={openBrokerRuns} />}
              {tab === 'connections' && (
                <ConnectionsTab items={data.items} collections={data.collections} />
              )}
              {tab === 'approvals' && <ApprovalsTab onCountChange={setPending} />}
              {tab === 'broker' && (
                <div className="mx-auto max-w-4xl">
                  <PortalOperations
                    key={opsKey}
                    linkedRun={linkedRun}
                    initialTab={opsTab}
                    accounts={data.items}
                    selected={opsSelected}
                  />
                </div>
              )}
              {tab === 'activity' && <ActivityTab onOpenApprovals={() => setTab('approvals')} />}
            </main>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
