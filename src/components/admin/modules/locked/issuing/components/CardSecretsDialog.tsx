/**
 * Card secrets dialog — reveals the full PAN + CVC for a virtual card. The
 * reveal is fetched on demand (audited server-side at critical severity) and
 * never cached. Closing the dialog discards the secrets from memory.
 */

import { useEffect, useState } from 'react';
import { Check, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import type { CardSecrets, IssuingCard } from '../types';

interface CardSecretsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: IssuingCard | null;
  secrets: CardSecrets | null;
  isLoading: boolean;
  onReveal: () => void;
}

function SecretRow({ label, value }: { label: string; value: string }) {
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
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{value}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
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

export function CardSecretsDialog({
  open,
  onOpenChange,
  card,
  secrets,
  isLoading,
  onReveal,
}: CardSecretsDialogProps) {
  // Reset is handled by the parent clearing `secrets` when the dialog closes.
  useEffect(() => {
    if (!open) return;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Card details</DialogTitle>
          <DialogDescription>
            {card
              ? `Virtual card ending •••• ${card.last4}. Revealing the full number is audit-logged.`
              : 'Virtual card details.'}
          </DialogDescription>
        </DialogHeader>

        {secrets ? (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
            <SecretRow label="Card number" value={secrets.number} />
            <SecretRow label="CVC" value={secrets.cvc} />
            <SecretRow
              label="Expiry"
              value={`${String(secrets.expMonth).padStart(2, '0')} / ${secrets.expYear}`}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              The full card number and CVC are hidden until you reveal them.
            </p>
            <Button onClick={onReveal} disabled={isLoading}>
              <Eye className="h-4 w-4 mr-1" />
              {isLoading ? 'Revealing…' : 'Reveal card number'}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
