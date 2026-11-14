/**
 * LockedModule — access-code-gated private workspace.
 *
 * Renders a password gate until the correct access code is entered.
 * The unlocked state lives only in component memory: navigating to
 * another module unmounts this component and re-locks the page, and a
 * page refresh does the same. See ./access.ts for the security model.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  NavTabsList,
  NavTabsTrigger,
  NoAccess,
  PageHeader,
  SoonBadge,
  useUrlState,
} from '../../layout/page';
import { useCurrentUserPermissions } from '../personnel';
import { LockedSkeleton } from './components/LockedSkeleton';
import { Breadcrumb } from './breadcrumb';
import { AccountsPanel } from './refund-clusters/AccountsPanel';
import { CLUSTER_PARAM } from './refund-clusters/constants';
import { TreasuryManagerPanel } from './treasury/TreasuryManagerPanel';
import { IssuingCardsPanel } from './issuing/IssuingCardsPanel';
import { CreateCardholderPage } from './issuing/components/CreateCardholderPage';
import { useCreateCardholder } from './issuing/hooks/useIssuing';
import { getLockoutRemaining, verifyAccessCode } from './access';

/** ?cardholder=new opens the New cardholder page on the Banking tab. */
const CARDHOLDER_PARAM = 'cardholder';

type LockedTab = 'banking' | 'accounts';
const LOCKED_TABS: readonly LockedTab[] = ['banking', 'accounts'];

export function LockedModule() {
  const { isSuperAdmin, isLoading } = useCurrentUserPermissions();
  const [unlocked, setUnlocked] = useState(false);

  // Sidebar filtering only hides the link — guard direct deep links
  // (/admin?module=locked) here as well. Super admins only.
  if (isLoading) {
    return <LockedSkeleton />;
  }
  if (!isSuperAdmin) {
    return (
      <LockedPage description="Private workspace.">
        <AccessDenied />
      </LockedPage>
    );
  }

  if (!unlocked) {
    return (
      <LockedPage description="Private workspace.">
        <AccessGate onUnlocked={() => setUnlocked(true)} />
      </LockedPage>
    );
  }

  return <LockedWorkspace />;
}

/** The page frame: the module's header above one piece of content. */
function LockedPage({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 lg:p-8">
      <PageHeader title="Locked" description={description} />
      {children}
    </div>
  );
}

/**
 * The unlocked workspace. The tab (?tab=accounts), the Accounts section
 * (?section=refund-clusters) and an open cluster (?cluster=<id>) are in the
 * address; the access code is not, so a reload still asks for it first.
 */
function LockedWorkspace() {
  const [tab, setTab] = useUrlState<LockedTab>('tab', 'banking', LOCKED_TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  // An open cluster is a page of its own: the module header and tabs step aside.
  const clusterOpen = tab === 'accounts' && searchParams.has(CLUSTER_PARAM);
  const cardholderOpen = tab === 'banking' && searchParams.get(CARDHOLDER_PARAM) === 'new';
  const createCardholder = useCreateCardholder();

  const setCardholderPage = (open: boolean) =>
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (open) params.set(CARDHOLDER_PARAM, 'new');
      else params.delete(CARDHOLDER_PARAM);
      return params;
    });

  // New cardholder is a page of its own in place of the workspace.
  if (cardholderOpen) {
    return (
      <div className="mx-auto w-full max-w-[1800px] p-6 lg:p-8">
        <Breadcrumb
          trail={[
            { label: 'Banking', onClick: () => setCardholderPage(false) },
            { label: 'New cardholder' },
          ]}
        />
        <CreateCardholderPage
          onClose={() => setCardholderPage(false)}
          isSubmitting={createCardholder.isPending}
          onSubmit={(input) =>
            createCardholder.mutate(input, { onSuccess: () => setCardholderPage(false) })
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 lg:p-8">
      {!clusterOpen && (
        <PageHeader
          title="Locked"
          description="Private workspace — access re-locks when you leave this tab."
        />
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as LockedTab)} className="gap-6">
        {!clusterOpen && (
          <NavTabsList aria-label="Locked sections">
            <NavTabsTrigger value="banking">Banking</NavTabsTrigger>
            <NavTabsTrigger value="accounts">Accounts</NavTabsTrigger>
            <NavTabsTrigger value="trading" disabled className="disabled:opacity-50">
              Trading <SoonBadge />
            </NavTabsTrigger>
          </NavTabsList>
        )}

        <TabsContent value="banking">
          <Breadcrumb trail={[{ label: 'Banking' }]} />
          <div className="space-y-8">
            <TreasuryManagerPanel />
            <IssuingCardsPanel onNewCardholder={() => setCardholderPage(true)} />
          </div>
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccessDenied() {
  return (
    <>
      <Breadcrumb trail={[{ label: 'No access' }]} />
      <NoAccess
        what="Locked"
        howToGetAccess="This private workspace is for the super admin only."
      />
    </>
  );
}

function AccessGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(() => getLockoutRemaining());
  const inputRef = useRef<HTMLInputElement>(null);

  // Tick down an active lockout window once per second.
  useEffect(() => {
    if (lockoutMs <= 0) return;
    const timer = setInterval(() => {
      const remaining = getLockoutRemaining();
      setLockoutMs(remaining);
      if (remaining <= 0) setError(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutMs]);

  const lockedOut = lockoutMs > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedOut || checking || !code) return;

    setChecking(true);
    try {
      const result = await verifyAccessCode(code);
      if (result.ok) {
        onUnlocked();
        return;
      }
      setCode('');
      inputRef.current?.focus();
      if (result.reason === 'locked-out') {
        setLockoutMs(result.remainingMs);
        setError('Too many failed attempts.');
      } else {
        setError(
          `Incorrect access code. ${result.attemptsLeft} attempt${
            result.attemptsLeft === 1 ? '' : 's'
          } remaining.`,
        );
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Breadcrumb trail={[{ label: 'Restricted area' }]} />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Restricted area</CardTitle>
          <CardDescription>Enter the access code to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              ref={inputRef}
              type="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (!lockedOut) setError(null);
              }}
              placeholder="Access code"
              autoComplete="off"
              autoFocus
              disabled={lockedOut || checking}
              aria-label="Access code"
              aria-invalid={!!error}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
                {lockedOut && ` Try again in ${Math.ceil(lockoutMs / 1000)}s.`}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={lockedOut || checking || !code}>
              {checking ? 'Verifying…' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LockedModule;
