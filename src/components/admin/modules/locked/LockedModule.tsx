/**
 * LockedModule — access-code-gated private workspace.
 *
 * Renders a password gate until the correct access code is entered.
 * The unlocked state lives only in component memory: navigating to
 * another module unmounts this component and re-locks the page, and a
 * page refresh does the same. See ./access.ts for the security model.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck, Unlock } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { getLockoutRemaining, verifyAccessCode } from './access';

export function LockedModule() {
  const [unlocked, setUnlocked] = useState(false);

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

      <Card>
        <CardHeader>
          <CardTitle>No modules yet</CardTitle>
          <CardDescription>
            New modules will be built into this page. For now it is an empty, secured shell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-8 w-8" />
            <p className="text-sm">This area is reserved for future modules.</p>
          </div>
        </CardContent>
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
