/**
 * Shell entry — what the admin frame needs from this module before the
 * module itself is opened. Keep it to light, side-effect-free re-exports: see
 * the "Shell entries" note in
 * `src/components/admin/moduleLoaders.ts`.
 */
import { lazy } from 'react';

// Lazy: the module entry pulls the PDF studio (pdf.js). Keeping it behind
// lazy() means a light consumer importing esignApi or a type from the barrel
// no longer drags pdf.js in — which is exactly what broke VerifyDocumentPage
// with "DOMMatrix is not defined". Render inside <Suspense>.
export const EsignModule = lazy(() =>
  import('./EsignModule').then((m) => ({ default: m.EsignModule })),
);

export { EsignSkeleton } from './components/EsignSkeleton';
