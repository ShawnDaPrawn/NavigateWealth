# E-Signature Module

## Purpose

Provides document preparation, field placement, and signature collection workflows for advisers and clients. Integrates PDF rendering via pdf.js with a drag-and-drop field placement studio.

## Architecture

- **Query hooks**: `useEnvelopesQuery.ts` contains the React Query hooks and the authoritative `esignKeys` query key factory. The legacy `useEnvelopes.ts` hook has been migrated to use React Query internally for backward compatibility.
- **Mutation hooks**: `useEnvelopeMutations.ts` handles document upload, field saving, envelope sending, voiding, and OTP-based signing flows.
- **PDF rendering**: `PDFViewer.tsx` uses pdf.js (npm import) with canvas-based rendering. Page dimensions are read from the actual PDF metadata, not hardcoded.
- **Field placement**: `PrepareFormStudio.tsx` is a three-column editor (palette, canvas, properties) with undo/redo history.
- **Creation flow chrome**: `components/wizard/` owns the send-for-signature flow's layout — `EsignWizardShell` (header, progress rail, action bar), `EsignWizardStepper`, `EsignWizardSection`, and the step model in `esignWizardSteps.ts`. Steps (`DocumentUploadStep`, `RecipientsStepView`) render content only and declare their actions; they do not lay out a page of their own. Both entry points use it — `EsignModule` with `layout="fill"`, the client drawer's E-Sign tab with `layout="inline"` — so the flow looks the same wherever it starts.

## Key Constraints

- The pdf.js worker is loaded from CDN (jsdelivr) matching the installed library version to avoid CSP issues.
- Signer colours are assigned by index from `SIGNER_COLORS` in `constants.ts` for consistency across the UI.
- All icon-only buttons in this module carry `aria-label` attributes for WCAG 2.1 AA compliance.
- Wizard steps are controlled: the parent owns `files`/`title`/`message`/`expiryDays`, and `documentStepBlocker` in `components/documentStepModel.ts` is the single rule deciding whether the step can continue. Keep it that way — the shell's Continue button and the step must never disagree about "ready".
- `globals.css` forces every `h3[class*='text-']` to 20px with `!important`. Section headings inside a step therefore use `h4` (as `CardTitle` does); an `h3` there flattens the hierarchy against the step's own heading.
