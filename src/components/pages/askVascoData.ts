/**
 * Ask Vasco's shared content: the suggested prompts, Vasco's welcome message
 * and the anonymous visitor id the public chat sends with every question.
 *
 * Both designs of the page read these — the live layout in AskVascoPage.tsx
 * and the Navigator redesign in src/site/pages/NavigatorAskVascoPage.tsx — so
 * the two cannot drift. They were moved here verbatim from AskVascoPage.tsx.
 */
import type { VascoChatMessageType as Message } from '../shared/vasco-chat';

export const SUGGESTED_PROMPTS = [
  'How much life cover do I need?',
  'Explain retirement annuities',
  'Am I saving enough for retirement?',
  'How does estate duty work in SA?',
];

export const VASCO_VISITOR_ID_KEY = 'vasco_visitor_id';

export function getOrCreateVascoVisitorId() {
  try {
    const existing = localStorage.getItem(VASCO_VISITOR_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VASCO_VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return 'anonymous';
  }
}

export const VASCO_WELCOME: Message = {
  role: 'assistant',
  content: `Welcome! I'm **Vasco**, your AI financial navigator at Navigate Wealth.

I can help you explore financial concepts, retirement planning, risk management, tax strategies, and more — all tailored to the South African context.

**Here's what I can help with:**
- Explaining financial products and concepts
- General retirement and savings guidance
- Understanding tax implications
- Rough financial illustrations and calculations
- Learning about Navigate Wealth's services

Tap a suggested topic or ask me anything to get started!`,
  timestamp: new Date(),
};

export function isWelcomeMessage(message: Message) {
  return message.role === 'assistant' && message.content === VASCO_WELCOME.content;
}
