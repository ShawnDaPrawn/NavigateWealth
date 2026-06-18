/**
 * Issuing — API Layer
 *
 * The only layer that touches the server. All routes are super-admin only and
 * audited server-side. Card secrets are fetched only by the explicit reveal
 * call and are never cached.
 */

import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import { ENDPOINTS } from './constants';
import type { Cardholder, CardholderInput, CardInput, CardSecrets, IssuingCard } from './types';

function rethrow(error: unknown, context: string): never {
  logger.error(`[IssuingAPI] ${context} failed`, error);
  throw error instanceof Error ? error : new Error('An unknown error occurred');
}

export const IssuingAPI = {
  async listCardholders(): Promise<Cardholder[]> {
    try {
      const data = await api.get<{ cardholders: Cardholder[] }>(ENDPOINTS.CARDHOLDERS);
      return data?.cardholders ?? [];
    } catch (error) {
      rethrow(error, 'listCardholders');
    }
  },

  async createCardholder(input: CardholderInput): Promise<Cardholder> {
    try {
      const data = await api.post<{ cardholder: Cardholder }>(ENDPOINTS.CARDHOLDERS, input);
      return data.cardholder;
    } catch (error) {
      rethrow(error, 'createCardholder');
    }
  },

  async listCards(): Promise<IssuingCard[]> {
    try {
      const data = await api.get<{ cards: IssuingCard[] }>(ENDPOINTS.CARDS);
      return data?.cards ?? [];
    } catch (error) {
      rethrow(error, 'listCards');
    }
  },

  async createVirtualCard(input: CardInput): Promise<IssuingCard> {
    try {
      const data = await api.post<{ card: IssuingCard }>(ENDPOINTS.CARDS, input);
      return data.card;
    } catch (error) {
      rethrow(error, 'createVirtualCard');
    }
  },

  /** Reveal the full PAN + CVC for a virtual card. Audited server-side at critical severity. */
  async getCardSecrets(cardId: string): Promise<CardSecrets> {
    try {
      const data = await api.post<{ secrets: CardSecrets }>(ENDPOINTS.CARD_SECRETS(cardId));
      return data.secrets;
    } catch (error) {
      rethrow(error, 'getCardSecrets');
    }
  },
};
