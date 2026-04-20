/**
 * P8.7 — In-house, dependency-free signer-side translations.
 *
 * The signer experience needs to be localisable for South African
 * recipients without dragging `i18next` into the bundle. We expose a
 * small `t(key, lang)` helper backed by a typed dictionary. Adding a
 * new key requires touching every supported language, which is the
 * point — TypeScript blocks merges where a translation is missing.
 *
 * Supported languages (Phase 8.7):
 *   - `en` — English (default fallback)
 *   - `af` — Afrikaans
 *   - `zu` — isiZulu
 *
 * Anything outside this set transparently falls back to `en`. Keys
 * are flat (no nested namespaces) to keep the lookup cheap and the
 * dictionary obviously diff-able.
 */

export type SignerLang = 'en' | 'af' | 'zu';

export const SUPPORTED_LANGS: SignerLang[] = ['en', 'af', 'zu'];

export const LANG_LABELS: Record<SignerLang, string> = {
  en: 'English',
  af: 'Afrikaans',
  zu: 'isiZulu',
};

/**
 * Translation table. The TypeScript record type forces every language
 * to define every key.
 */
export const SIGNER_DICTIONARY = {
  // Loading / connection states
  'loading.title': {
    en: 'Loading Document',
    af: 'Dokument Laai',
    zu: 'Iyalayisha Idokhumenti',
  },
  'loading.subtitle': {
    en: 'Please wait while we verify your access...',
    af: 'Wag asseblief terwyl ons jou toegang verifieer...',
    zu: 'Sicela ulinde sisaqinisekisa ukufinyelela kwakho...',
  },
  'loading.secure': {
    en: 'Secure connection verified',
    af: 'Veilige verbinding geverifieer',
    zu: 'Uxhumano oluvikelekile luqinisekisiwe',
  },

  // Expired / invalid token
  'expired.title': {
    en: 'Link Unavailable',
    af: 'Skakel Onbeskikbaar',
    zu: 'Isixhumanisi Asitholakali',
  },
  'expired.fallback': {
    en: 'This signing link has expired or is no longer valid. Please contact the sender for a new link.',
    af: 'Hierdie tekenskakel het verval of is nie meer geldig nie. Kontak die sender vir \'n nuwe skakel.',
    zu: 'Lesi sixhumanisi sokusayina siphelelwe yisikhathi noma asisasebenzi. Sicela uxhumane nomthumeli ukuthola isixhumanisi esisha.',
  },
  'expired.return': {
    en: 'Return to Home',
    af: 'Keer Terug Tuis',
    zu: 'Buyela Ekhaya',
  },

  // Rejected / declined
  'rejected.title': {
    en: 'Document Declined',
    af: 'Dokument Geweier',
    zu: 'Idokhumenti Inqatshelwe',
  },
  'rejected.body': {
    en: 'You have declined to sign {title}. The sender has been notified.',
    af: 'Jy het geweier om {title} te teken. Die sender is in kennis gestel.',
    zu: 'Wenqabile ukusayina i-{title}. Umthumeli waziswe.',
  },
  'rejected.close': {
    en: 'Close',
    af: 'Sluit',
    zu: 'Vala',
  },

  // Waiting (sequential)
  'waiting.title': {
    en: 'Waiting for Previous Signers',
    af: 'Wag vir Vorige Tekenaars',
    zu: 'Kulindwe Abasayini Bangaphambili',
  },
  'waiting.body': {
    en: "This document requires signatures in a specific order. You'll receive an email when it's your turn to sign.",
    af: 'Hierdie dokument vereis handtekeninge in \'n spesifieke volgorde. Jy sal \'n e-pos ontvang wanneer dit jou beurt is om te teken.',
    zu: 'Le dokhumenti idinga amasiginesha ngokulandelana okuthile. Uzothola i-imeyili lapho sekuyithuba lakho lokusayina.',
  },
  'waiting.order': {
    en: 'Signing Order',
    af: 'Tekenvolgorde',
    zu: 'Ukulandelana Kokusayina',
  },

  // Common actions
  'common.signNow': {
    en: 'Sign now',
    af: 'Teken nou',
    zu: 'Sayina manje',
  },
  'common.continue': {
    en: 'Continue',
    af: 'Gaan voort',
    zu: 'Qhubeka',
  },
  'common.cancel': {
    en: 'Cancel',
    af: 'Kanselleer',
    zu: 'Khansela',
  },
  'common.decline': {
    en: 'Decline to sign',
    af: 'Weier om te teken',
    zu: 'Yenqaba ukusayina',
  },

  // Footer / support
  'footer.support': {
    en: 'Need help? Contact {email}',
    af: 'Hulp nodig? Kontak {email}',
    zu: 'Udinga usizo? Xhumana ne-{email}',
  },
  'footer.poweredBy': {
    en: 'Powered by Navigate Wealth',
    af: 'Aangedryf deur Navigate Wealth',
    zu: 'Inikwa amandla yi-Navigate Wealth',
  },
} as const;

export type TranslationKey = keyof typeof SIGNER_DICTIONARY;

/**
 * Coerce an arbitrary string into a supported language code. Anything
 * outside the supported set falls back to English.
 */
export function normaliseLang(input: string | undefined | null): SignerLang {
  if (!input) return 'en';
  const lower = input.toLowerCase().slice(0, 2);
  if (lower === 'af' || lower === 'zu' || lower === 'en') return lower;
  return 'en';
}

/**
 * Look up a translation, optionally interpolating `{token}` placeholders
 * with values from `vars`. Falls back to English then to the raw key
 * so even a typo or new key still renders something readable in production.
 */
export function t(
  key: TranslationKey,
  lang: SignerLang = 'en',
  vars?: Record<string, string>,
): string {
  const entry = SIGNER_DICTIONARY[key];
  let template: string;
  if (entry && entry[lang]) {
    template = entry[lang];
  } else if (entry && entry.en) {
    template = entry.en;
  } else {
    return key;
  }
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}
