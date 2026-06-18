/**
 * Issuing Cards panel — rendered inside the Locked module's Accounts → Manager
 * tab (already behind super-admin + access-code gating). Lists virtual company
 * cards, creates cardholders and cards, and reveals a card's PAN + CVC.
 */

import { useState } from 'react';
import { CreditCard, Plus, UserPlus } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';
import { CreateCardholderDialog } from './components/CreateCardholderDialog';
import { CreateCardDialog } from './components/CreateCardDialog';
import { CardSecretsDialog } from './components/CardSecretsDialog';
import {
  useCardholders,
  useCards,
  useCardSecrets,
  useCreateCardholder,
  useCreateVirtualCard,
} from './hooks/useIssuing';
import { statusLabel } from './constants';
import type { CardholderInput, CardInput, IssuingCard } from './types';

export function IssuingCardsPanel() {
  const cardholdersQuery = useCardholders();
  const cardsQuery = useCards();
  const createCardholder = useCreateCardholder();
  const createCard = useCreateVirtualCard();
  const cardSecrets = useCardSecrets();

  const [cardholderOpen, setCardholderOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [secretsCard, setSecretsCard] = useState<IssuingCard | null>(null);

  const handleCreateCardholder = (input: CardholderInput) => {
    createCardholder.mutate(input, { onSuccess: () => setCardholderOpen(false) });
  };
  const handleCreateCard = (input: CardInput) => {
    createCard.mutate(input, { onSuccess: () => setCardOpen(false) });
  };

  const cards = cardsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Company cards</h2>
            <p className="text-sm text-muted-foreground">
              Issue and manage virtual cards backed by the financial account.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCardholderOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> New cardholder
          </Button>
          <Button
            onClick={() => setCardOpen(true)}
            disabled={(cardholdersQuery.data ?? []).length === 0}
          >
            <Plus className="h-4 w-4 mr-1" /> Create card
          </Button>
        </div>
      </div>

      {cardsQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to load cards: {(cardsQuery.error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {cardsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          No virtual cards yet. Create a cardholder, then issue a card.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => (
            <Card key={card.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <Badge variant={card.status === 'active' ? 'secondary' : 'outline'}>
                    {statusLabel(card.status)}
                  </Badge>
                </div>
                <div>
                  <p className="font-mono text-sm">•••• •••• •••• {card.last4}</p>
                  <p className="text-xs text-muted-foreground">
                    {card.cardholderName ?? 'Cardholder'} · {String(card.expMonth).padStart(2, '0')}
                    /{String(card.expYear).slice(-2)} · {card.brand}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    cardSecrets.reset();
                    setSecretsCard(card);
                  }}
                >
                  View details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateCardholderDialog
        open={cardholderOpen}
        onOpenChange={setCardholderOpen}
        onSubmit={handleCreateCardholder}
        isSubmitting={createCardholder.isPending}
      />
      <CreateCardDialog
        open={cardOpen}
        onOpenChange={setCardOpen}
        cardholders={cardholdersQuery.data ?? []}
        onSubmit={handleCreateCard}
        isSubmitting={createCard.isPending}
      />
      <CardSecretsDialog
        open={!!secretsCard}
        onOpenChange={(o) => {
          if (!o) {
            setSecretsCard(null);
            cardSecrets.reset();
          }
        }}
        card={secretsCard}
        secrets={cardSecrets.data ?? null}
        isLoading={cardSecrets.isPending}
        onReveal={() => secretsCard && cardSecrets.mutate(secretsCard.id)}
      />
    </div>
  );
}
