/**
 * LockedModule — access-code-gated private workspace.
 *
 * Renders a password gate until the correct access code is entered.
 * The unlocked state lives only in component memory: navigating to
 * another module unmounts this component and re-locks the page, and a
 * page refresh does the same. See ./access.ts for the security model.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldX, Unlock } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';
import { LockedSkeleton } from './components/LockedSkeleton';
import { getLockoutRemaining, verifyAccessCode } from './access';

/** Empty placeholder for a tab whose content is not built yet. */
function TabPlaceholder({ title }: { title: string }) {
  return (
    <div className="border border-dashed rounded-lg p-12 flex items-center justify-center text-center text-sm text-muted-foreground">
      {title} — coming soon.
    </div>
  );
}

export function LockedModule() {
  const { isSuperAdmin, isLoading } = useCurrentUserPermissions();
  const [unlocked, setUnlocked] = useState(false);

  // Sidebar filtering only hides the link — guard direct deep links
  // (/admin?module=locked) here as well. Super admins only.
  if (isLoading) {
    return <LockedSkeleton />;
  }
  if (!isSuperAdmin) {
    return <AccessDenied />;
  }

  if (!unlocked) {
    return <AccessGate onUnlocked={() => setUnlocked(true)} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Unlock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Locked</h1>
          <p className="text-sm text-muted-foreground">
            Private workspace — access re-locks when you leave this tab.
          </p>
        </div>
      </div>

      {/* Top-level tabs: Banking · Accounts · Trading */}
      <Tabs defaultValue="banking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
        </TabsList>

        <TabsContent value="banking">
          <TabPlaceholder title="Banking" />
        </TabsContent>

        <TabsContent value="accounts">
          {/* Accounts sub-tabs: Manager · Refund Clusters · Disbursement Clusters */}
          <Tabs defaultValue="manager" className="space-y-4">
            <TabsList>
              <TabsTrigger value="manager">Manager</TabsTrigger>
              <TabsTrigger value="refund-clusters">Refund Clusters</TabsTrigger>
              <TabsTrigger value="disbursement-clusters">Disbursement Clusters</TabsTrigger>
            </TabsList>

            <TabsContent value="manager">
              <TabPlaceholder title="Manager" />
            </TabsContent>
            <TabsContent value="refund-clusters">
              <TabPlaceholder title="Refund Clusters" />
            </TabsContent>
            <TabsContent value="disbursement-clusters">
              <TabPlaceholder title="Disbursement Clusters" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="trading">
          <TabPlaceholder title="Trading" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <ShieldX className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You do not have permission to view this page.</CardDescription>
        </CardHeader>
      </Card>
    </div>
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
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Restricted Area</CardTitle>
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
